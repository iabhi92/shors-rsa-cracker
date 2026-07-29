def test_resource_estimate_at_2048_bits(client):
    r = client.post("/api/resource-estimate", json={"bits": 2048})
    assert r.status_code == 200
    body = r.json()
    assert body["this_project"]["total_qubits"] > 0
    assert body["gidney_ekera_2019"]["logical_qubits"] > 0
    # sanity: this project's qubit count and the published estimate should be the same order
    # of magnitude at 2048 bits (see notes/04) -- not off by 100x in either direction
    ratio = body["this_project"]["total_qubits"] / body["gidney_ekera_2019"]["logical_qubits"]
    assert 0.1 < ratio < 10


def test_resource_curve_is_monotonically_increasing(client):
    r = client.get("/api/resource-estimate/curve")
    assert r.status_code == 200
    points = r.json()["points"]
    assert len(points) >= 10
    assert points[0]["bits"] < points[-1]["bits"]
    assert points[-1]["bits"] >= 2048  # actually reaches a real RSA-2048-sized point
    # Both qubits and gates should grow monotonically with bits -- the actual "cliff" the
    # Resource Estimation page's chart exists to show, not just asserted in a sentence.
    for a, b in zip(points, points[1:]):
        assert a["total_qubits"] <= b["total_qubits"]
        assert a["toffoli_equivalent_gates"] <= b["toffoli_equivalent_gates"]


def test_resource_estimate_rejects_bits_outside_range(client):
    assert client.post("/api/resource-estimate", json={"bits": 1}).status_code == 422
    assert client.post("/api/resource-estimate", json={"bits": 10_000_000}).status_code == 422


def test_circuit_metadata_for_n15(client):
    r = client.post("/api/circuit/metadata", json={"n": 15})
    assert r.status_code == 200
    body = r.json()
    assert body["n_target"] == 4
    assert body["total_qubits"] == body["n_count"] + body["n_target"] + body["n_ancilla"]
    assert body["measured_not_estimated"] is True


def test_circuit_metadata_rejects_unsupported_n(client):
    r = client.post("/api/circuit/metadata", json={"n": 999})
    assert r.status_code == 400


def test_simulator_comparison_lists_all_five(client):
    r = client.get("/api/simulators/compare")
    assert r.status_code == 200
    assert len(r.json()["simulators"]) == 5
