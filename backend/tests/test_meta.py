def test_meta_reports_a_real_test_count(client):
    r = client.get("/api/meta")
    assert r.status_code == 200
    body = r.json()
    # loose bound rather than pinning the exact number, so this doesn't need updating every
    # time a test is added -- the real check is that it's computed, not a suspiciously round
    # hardcoded number like 0 or 100
    assert body["test_count"] > 200
    assert len(body["classical_attack_methods"]) == 4
    assert len(body["quantum_backends"]) == 4
    assert body["ibm_hardware_validated"] is True


def test_health_endpoint(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
