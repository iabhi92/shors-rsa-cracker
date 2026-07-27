import pytest


def test_hadamard_gate_gives_uniform_superposition(client):
    r = client.post("/api/quantum/gate-demo", json={"n_qubits": 1, "qubit": 0, "gate": "H", "initial_value": 0})
    assert r.status_code == 200
    amps = {a["basis_state"]: a["probability"] for a in r.json()["amplitudes"]}
    assert amps["0"] == pytest.approx(0.5)
    assert amps["1"] == pytest.approx(0.5)


def test_x_gate_is_a_bit_flip(client):
    r = client.post("/api/quantum/gate-demo", json={"n_qubits": 1, "qubit": 0, "gate": "X", "initial_value": 0})
    assert r.status_code == 200
    amps = {a["basis_state"]: a["probability"] for a in r.json()["amplitudes"]}
    assert amps["1"] == pytest.approx(1.0)


def test_gate_demo_rejects_qubit_out_of_range(client):
    r = client.post("/api/quantum/gate-demo", json={"n_qubits": 1, "qubit": 5, "gate": "X", "initial_value": 0})
    assert r.status_code == 400


def test_bell_state_is_maximally_entangled(client):
    r = client.post("/api/quantum/bell-state")
    assert r.status_code == 200
    amps = {a["basis_state"]: a["probability"] for a in r.json()["amplitudes"]}
    assert amps["00"] == pytest.approx(0.5)
    assert amps["11"] == pytest.approx(0.5)
    assert amps["01"] == pytest.approx(0.0, abs=1e-9)
    assert amps["10"] == pytest.approx(0.0, abs=1e-9)


def test_qft_demo_matches_exact_dft_matrix(client):
    r = client.post("/api/quantum/qft-demo", json={"n_qubits": 3, "initial_value": 1, "inverse": False})
    assert r.status_code == 200
    body = r.json()
    assert body["matches_exact_dft_matrix"] is True
    assert body["max_amplitude_error_vs_dft_matrix"] < 1e-9
