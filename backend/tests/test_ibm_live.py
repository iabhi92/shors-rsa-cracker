"""Tests for backend/app/routers/ibm_live.py -- the live, credentialed real-hardware submission
path. Never touches actual IBM Quantum: quantum.ibm_hardware.submit_to_hardware is monkeypatched
with a fake job whose .status()/.result() are fully under the test's control, so these exercise
the real request/response/state-machine logic without spending real hardware time or needing
real credentials in CI."""

from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient

from backend.app.routers import ibm_live
from quantum.ibm_hardware import SubmittedJob


class _FakeStatus:
    def __init__(self, name: str) -> None:
        self.name = name


class _FakeResult:
    """Mimics SamplerV2's result[0].data.c.get_counts() shape."""

    def __init__(self, counts: dict[str, int]) -> None:
        self._counts = counts

    def __getitem__(self, index: int) -> "_FakeResult":
        assert index == 0
        return self

    @property
    def data(self) -> "_FakeResult":
        return self

    @property
    def c(self) -> "_FakeResult":
        return self

    def get_counts(self) -> dict[str, int]:
        return self._counts


@dataclass
class _FakeJob:
    """A scripted sequence of statuses -- each call to .status() advances one step and holds on
    the last entry, so a test can assert queued -> running -> done across repeated polls."""

    statuses: list[str]
    counts: dict[str, int]
    _job_id: str = "fake-job-123"
    _calls: int = 0

    def status(self) -> _FakeStatus:
        i = min(self._calls, len(self.statuses) - 1)
        self._calls += 1
        return _FakeStatus(self.statuses[i])

    def job_id(self) -> str:
        return self._job_id

    def result(self) -> _FakeResult:
        return _FakeResult(self.counts)


def _patch_submit(monkeypatch: pytest.MonkeyPatch, job: _FakeJob, backend_name: str = "fake_backend") -> None:
    def _fake_submit_to_hardware(a: int, n: int, n_count: int, shots: int = 1000, backend_name_arg: str | None = None) -> SubmittedJob:
        return SubmittedJob(job=job, backend_name=backend_name, shots=shots)

    monkeypatch.setattr(ibm_live, "submit_to_hardware", _fake_submit_to_hardware)


def test_submit_rejects_a_not_coprime_or_wrong_order(client: TestClient) -> None:
    # 3 and 5 both share a factor with 15; 1 is coprime but trivial (order 1, not a power of
    # two greater than 1) -- none of these are in AllowedLiveA.
    for bad_a in (1, 3, 5, 6, 15):
        r = client.post("/api/ibm-hardware/live/submit", json={"a": bad_a})
        assert r.status_code == 422, bad_a


def test_submit_returns_queued_and_status_progresses_to_done(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    # a=7 mod 15 has order 4 (2^7=128=8*15+8 ... ord_15(7)=4); exact peaks at k*8/4 = 0,2,4,6.
    job = _FakeJob(statuses=["QUEUED", "RUNNING", "DONE"], counts={"000": 250, "010": 250, "100": 250, "110": 250})
    _patch_submit(monkeypatch, job)

    submit_r = client.post("/api/ibm-hardware/live/submit", json={"a": 7})
    assert submit_r.status_code == 200
    body = submit_r.json()
    assert body["status"] == "queued"
    assert body["a"] == 7
    assert body["N"] == 15
    assert body["r"] == 4
    run_id = body["run_id"]

    first = client.get(f"/api/ibm-hardware/live/status/{run_id}")
    assert first.json()["status"] == "queued"

    second = client.get(f"/api/ibm-hardware/live/status/{run_id}")
    assert second.json()["status"] == "running"

    third = client.get(f"/api/ibm-hardware/live/status/{run_id}")
    done = third.json()
    assert done["status"] == "done"
    assert done["total_variation_distance"] == pytest.approx(0.0, abs=1e-9)
    assert done["counts"] == {"0": 250, "2": 250, "4": 250, "6": 250}

    # Polling again after completion must not re-invoke job.result() -- served from cache.
    calls_before = job._calls
    fourth = client.get(f"/api/ibm-hardware/live/status/{run_id}")
    assert fourth.json() == done
    assert job._calls == calls_before


def test_status_unknown_run_id_404s(client: TestClient) -> None:
    r = client.get("/api/ibm-hardware/live/status/does-not-exist")
    assert r.status_code == 404


def test_submit_returns_400_when_hardware_not_configured(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    # Deliberately not 503 -- see ibm_live.py's own comment on why: the frontend auto-retries
    # 502/503/504 as a Render cold-start, which would hide a real missing-credential error
    # behind ~50s of silent retries instead of surfacing it immediately.
    def _raise(*args: object, **kwargs: object) -> SubmittedJob:
        raise RuntimeError("IBM_QUANTUM_API_KEY and IBM_QUANTUM_CRN must be set")

    monkeypatch.setattr(ibm_live, "submit_to_hardware", _raise)
    r = client.post("/api/ibm-hardware/live/submit", json={"a": 7})
    assert r.status_code == 400


def test_per_ip_limit_blocks_a_second_submission(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    job = _FakeJob(statuses=["QUEUED"], counts={})
    _patch_submit(monkeypatch, job)

    first = client.post("/api/ibm-hardware/live/submit", json={"a": 7})
    assert first.status_code == 200
    second = client.post("/api/ibm-hardware/live/submit", json={"a": 8})
    assert second.status_code == 429


def test_job_ending_in_error_status_is_reported_as_error(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    job = _FakeJob(statuses=["QUEUED", "ERROR"], counts={})
    _patch_submit(monkeypatch, job)

    run_id = client.post("/api/ibm-hardware/live/submit", json={"a": 7}).json()["run_id"]
    client.get(f"/api/ibm-hardware/live/status/{run_id}")  # queued
    errored = client.get(f"/api/ibm-hardware/live/status/{run_id}").json()
    assert errored["status"] == "error"
    assert errored["error_message"]
