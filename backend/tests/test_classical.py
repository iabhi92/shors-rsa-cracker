import math

import pytest


def test_trial_division_finds_a_small_factor(client):
    r = client.post("/api/classical/attack", json={"n": 91, "method": "trial_division"})  # 7 * 13
    assert r.status_code == 200
    body = r.json()
    assert body["succeeded"] is True
    assert body["factor"] * body["other_factor"] == 91


def test_fermat_succeeds_on_close_primes(client):
    r = client.post("/api/classical/attack", json={"n": 8051, "method": "fermat"})  # 83 * 97
    assert r.status_code == 200
    body = r.json()
    assert body["succeeded"] is True
    assert {body["factor"], body["other_factor"]} == {83, 97}


def test_compare_runs_all_four_methods(client):
    r = client.post("/api/classical/compare", json={"n": 8051})
    assert r.status_code == 200
    results = r.json()["results"]
    assert len(results) == 4
    assert {res["method"] for res in results} == {"trial_division", "fermat", "pollards_rho", "pollards_p_minus_1"}


def test_time_estimate_at_reference_bits_matches_the_real_measured_row(client):
    bench = client.get("/api/classical/benchmark").json()
    rows = bench["rows"]
    reference = max(rows, key=lambda row: row["bits"])

    r = client.post("/api/classical/time-estimate", json={"bits": reference["bits"]})
    assert r.status_code == 200
    body = r.json()
    assert body["reference_bits"] == reference["bits"]
    # At the exact reference point, the extrapolation should reproduce the real measurement.
    assert body["trial_division_log10_seconds"] == pytest.approx(math.log10(reference["trial_division_seconds"]), abs=1e-9)


def test_time_estimate_at_rsa_2048_is_astronomically_larger_than_at_small_bits(client):
    small = client.post("/api/classical/time-estimate", json={"bits": 48}).json()
    real = client.post("/api/classical/time-estimate", json={"bits": 2048}).json()
    assert real["trial_division_log10_seconds"] > small["trial_division_log10_seconds"] + 100
    assert "age of the universe" in real["trial_division_human"]


def test_time_estimate_rejects_bits_outside_range(client):
    assert client.post("/api/classical/time-estimate", json={"bits": 4}).status_code == 422
    assert client.post("/api/classical/time-estimate", json={"bits": 5000}).status_code == 422


def test_trial_division_trace_replays_every_real_divisor(client):
    r = client.post("/api/classical/trial-division-trace", json={"n": 91})  # 7 * 13
    assert r.status_code == 200
    body = r.json()
    assert body["succeeded"] is True
    assert body["factor"] * body["other_factor"] == 91
    assert [step["divisor"] for step in body["steps"]] == [3, 5, 7]
    assert body["steps"][-1]["is_factor"] is True
    assert len(body["steps"]) == body["operations"]


def test_trial_division_trace_rejects_n_above_maximum(client):
    r = client.post("/api/classical/trial-division-trace", json={"n": 10**20})
    assert r.status_code == 422


def test_attack_rejects_n_below_minimum(client):
    r = client.post("/api/classical/attack", json={"n": 1, "method": "trial_division"})
    assert r.status_code == 422


def test_attack_rejects_n_above_maximum(client):
    r = client.post("/api/classical/attack", json={"n": 10**20, "method": "trial_division"})
    assert r.status_code == 422


def test_attack_rejects_unknown_method(client):
    r = client.post("/api/classical/attack", json={"n": 91, "method": "quantum_computer"})
    assert r.status_code == 422


def test_benchmark_endpoint_loads_existing_csv_without_regenerating(client):
    r = client.get("/api/classical/benchmark")
    assert r.status_code == 200
    body = r.json()
    assert len(body["rows"]) > 0
    assert body["source_file"] == "classical_benchmark.csv"
