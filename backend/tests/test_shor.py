def test_honest_backend_factors_15(client):
    r = client.post("/api/shor/run", json={"n": 15, "backend": "honest", "seed": 1})
    assert r.status_code == 200
    body = r.json()
    assert body["succeeded"] is True
    assert set(body["factors"]) == {3, 5}
    assert len(body["attempts"]) >= 1


def test_fast_backend_factors_51(client):
    r = client.post("/api/shor/run", json={"n": 51, "backend": "fast", "seed": 1, "max_attempts": 15})
    assert r.status_code == 200
    body = r.json()
    assert body["succeeded"] is True
    assert set(body["factors"]) == {3, 17}


def test_gate_level_backend_caps_n_count_and_notes_it(client):
    r = client.post("/api/shor/run", json={"n": 15, "backend": "gate_level", "seed": 1, "max_attempts": 5})
    assert r.status_code == 200
    body = r.json()
    assert body["note"] is not None
    assert body["n_count_used"] <= 6


def test_gate_level_backend_rejects_n_outside_its_own_smaller_allowed_set(client):
    # N=65's ancilla cost (driven by N.bit_length(), not n_count) made this take minutes
    # during development -- must be rejected up front with a clear message, not left to hang
    # a web request.
    r = client.post("/api/shor/run", json={"n": 65, "backend": "gate_level"})
    assert r.status_code == 400
    assert "gate-level" in r.json()["detail"].lower()


def test_rejects_n_outside_the_supported_demo_set(client):
    r = client.post("/api/shor/run", json={"n": 100, "backend": "honest"})
    assert r.status_code == 400


def test_rejects_non_coprime_a(client):
    r = client.post("/api/shor/run", json={"n": 15, "a": 3, "backend": "honest"})
    assert r.status_code == 400


def test_explicit_coprime_a_produces_a_single_attempt(client):
    r = client.post("/api/shor/run", json={"n": 15, "a": 7, "backend": "honest", "seed": 1})
    assert r.status_code == 200
    assert len(r.json()["attempts"]) == 1
    assert r.json()["attempts"][0]["a"] == 7


def test_backends_endpoint_lists_all_four(client):
    r = client.get("/api/shor/backends")
    assert r.status_code == 200
    assert set(r.json()["descriptions"].keys()) == {"honest", "gate_level", "fast", "cirq"}
