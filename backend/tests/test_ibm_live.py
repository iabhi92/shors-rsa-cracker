"""Tests for backend/app/routers/ibm_live.py -- the live, credentialed real-hardware submission
path. Never touches actual IBM Quantum: quantum.ibm_hardware.submit_to_hardware is monkeypatched
with a fake job whose .status()/.result() are fully under the test's control, so these exercise
the real request/response/state-machine logic without spending real hardware time or needing
real credentials in CI."""

import time
from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient

from backend.app.routers import ibm_live
from quantum.ibm_hardware import SubmittedJob


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
    result_delay_s: float = 0.0

    def status(self) -> str:
        # Real qiskit_ibm_runtime.RuntimeJobV2.status() returns a plain string directly (see
        # ibm_live.py's own comment on this) -- this fake matches that real contract, not an
        # invented enum-like wrapper.
        i = min(self._calls, len(self.statuses) - 1)
        self._calls += 1
        return self.statuses[i]

    def job_id(self) -> str:
        return self._job_id

    def result(self) -> _FakeResult:
        if self.result_delay_s:
            time.sleep(self.result_delay_s)
        return _FakeResult(self.counts)


def _patch_submit(
    monkeypatch: pytest.MonkeyPatch, job: _FakeJob, backend_name: str = "fake_backend", submit_delay_s: float = 0.0
) -> None:
    def _fake_submit_to_hardware(a: int, n: int, n_count: int, shots: int = 1000, backend_name_arg: str | None = None) -> SubmittedJob:
        if submit_delay_s:
            time.sleep(submit_delay_s)
        return SubmittedJob(job=job, backend_name=backend_name, shots=shots)

    monkeypatch.setattr(ibm_live, "submit_to_hardware", _fake_submit_to_hardware)


def _poll_until(client: TestClient, run_id: str, target_statuses: set[str], max_tries: int = 60, delay: float = 0.05) -> dict:
    """Submission and result-fetching both now happen on background threads (see ibm_live.py's
    own module docstring for why), so exactly which intermediate status a given poll lands on
    (submitting/queued/running) is inherently timing-dependent -- tests poll until reaching one
    of the statuses that actually matters, rather than asserting a fixed call count."""
    last = None
    for _ in range(max_tries):
        last = client.get(f"/api/ibm-hardware/live/status/{run_id}").json()
        if last["status"] in target_statuses:
            return last
        time.sleep(delay)
    raise AssertionError(f"never reached one of {target_statuses}; last response was {last}")


def test_submit_rejects_a_not_coprime_or_wrong_order(client: TestClient) -> None:
    # 3 and 5 both share a factor with 15; 1 is coprime but trivial (order 1, not a power of
    # two greater than 1) -- none of these are in AllowedLiveA.
    for bad_a in (1, 3, 5, 6, 15):
        r = client.post("/api/ibm-hardware/live/submit", json={"a": bad_a})
        assert r.status_code == 422, bad_a


def test_submit_returns_submitting_immediately(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    # Deliberately slow: submit_to_hardware (real IBM auth + backend selection + job submission)
    # must never block the /submit request itself -- see ibm_live.py's own module docstring for
    # the real production bug this is a regression test for.
    job = _FakeJob(statuses=["QUEUED"], counts={})
    _patch_submit(monkeypatch, job, submit_delay_s=2.0)

    start = time.monotonic()
    r = client.post("/api/ibm-hardware/live/submit", json={"a": 7})
    elapsed = time.monotonic() - start

    assert elapsed < 1.0, f"the request blocked on the slow submit_to_hardware() call ({elapsed:.2f}s)"
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "submitting"
    assert body["a"] == 7
    assert body["N"] == 15
    assert body["r"] == 4
    assert "backend_name" not in body
    assert "job_id" not in body


def test_status_progresses_from_submitting_to_done(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    # a=7 mod 15 has order 4 (2^7=128=8*15+8 ... ord_15(7)=4); exact peaks at k*8/4 = 0,2,4,6.
    job = _FakeJob(statuses=["QUEUED", "RUNNING", "DONE"], counts={"000": 250, "010": 250, "100": 250, "110": 250})
    _patch_submit(monkeypatch, job)

    run_id = client.post("/api/ibm-hardware/live/submit", json={"a": 7}).json()["run_id"]

    queued_or_later = _poll_until(client, run_id, {"queued", "running", "done"})
    assert queued_or_later["backend_name"] in (None, "fake_backend")

    done = _poll_until(client, run_id, {"done", "error"})
    assert done["status"] == "done"
    assert done["backend_name"] == "fake_backend"
    assert done["job_id"] == "fake-job-123"
    assert done["total_variation_distance"] == pytest.approx(0.0, abs=1e-9)
    assert done["counts"] == {"0": 250, "2": 250, "4": 250, "6": 250}

    # Polling again after completion must not re-invoke job.result() -- served from cache.
    calls_before = job._calls
    again = client.get(f"/api/ibm-hardware/live/status/{run_id}").json()
    assert again == done
    assert job._calls == calls_before


def test_status_unknown_run_id_404s(client: TestClient) -> None:
    r = client.get("/api/ibm-hardware/live/status/does-not-exist")
    assert r.status_code == 404


def test_a_slow_result_fetch_never_blocks_the_status_request(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    # Regression test for a real production bug: job.result() used to be called synchronously
    # inside the request handler, so a slow real-hardware result fetch could exceed the
    # deployment's own proxy timeout, making a genuinely successful run look like "could not
    # reach the backend" to a visitor. It must now run on a background thread instead.
    job = _FakeJob(statuses=["DONE"], counts={"0": 1000}, result_delay_s=2.0)
    _patch_submit(monkeypatch, job)

    run_id = client.post("/api/ibm-hardware/live/submit", json={"a": 7}).json()["run_id"]

    # Once the (fast, fake) submission resolves, job.status() reports DONE immediately, so the
    # very next poll kicks off the slow result() fetch in the background -- assert THAT request
    # still returns almost instantly.
    not_done_yet = _poll_until(client, run_id, {"running", "done"})
    if not_done_yet["status"] != "done":
        start = time.monotonic()
        r = client.get(f"/api/ibm-hardware/live/status/{run_id}")
        elapsed = time.monotonic() - start
        assert elapsed < 1.0, f"the request blocked on the slow result() call ({elapsed:.2f}s)"
        assert r.json()["status"] in ("running", "done")

    done = _poll_until(client, run_id, {"done", "error"})
    assert done["status"] == "done"
    assert done["counts"] == {"0": 1000}


def test_status_reports_error_when_hardware_not_configured(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    # /submit itself no longer fails synchronously for this -- get_service() only actually runs
    # once the background submission executes, so the error now surfaces via /status instead.
    def _raise(*args: object, **kwargs: object) -> SubmittedJob:
        raise RuntimeError("IBM_QUANTUM_API_KEY and IBM_QUANTUM_CRN must be set")

    monkeypatch.setattr(ibm_live, "submit_to_hardware", _raise)
    run_id = client.post("/api/ibm-hardware/live/submit", json={"a": 7}).json()["run_id"]

    errored = _poll_until(client, run_id, {"error"})
    assert "IBM_QUANTUM_API_KEY" in errored["error_message"]


def test_per_ip_limit_blocks_submissions_past_its_budget(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.app.rate_limit import ibm_hardware_per_ip_limiter

    job = _FakeJob(statuses=["QUEUED"], counts={})
    _patch_submit(monkeypatch, job)

    for _ in range(ibm_hardware_per_ip_limiter.max_requests):
        r = client.post("/api/ibm-hardware/live/submit", json={"a": 7})
        assert r.status_code == 200

    exhausted = client.post("/api/ibm-hardware/live/submit", json={"a": 8})
    assert exhausted.status_code == 429


def test_job_ending_in_error_status_is_reported_as_error(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    job = _FakeJob(statuses=["QUEUED", "ERROR"], counts={})
    _patch_submit(monkeypatch, job)

    run_id = client.post("/api/ibm-hardware/live/submit", json={"a": 7}).json()["run_id"]
    errored = _poll_until(client, run_id, {"error"})
    assert errored["error_message"]
