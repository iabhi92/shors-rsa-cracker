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
