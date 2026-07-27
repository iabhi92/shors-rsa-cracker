import os


def test_ibm_hardware_results_returns_the_stored_run(client):
    r = client.get("/api/ibm-hardware/results")
    assert r.status_code == 200
    body = r.json()
    assert len(body["runs"]) >= 1
    run = body["runs"][0]
    assert run["backend_name"]
    assert run["total_variation_distance"] < 0.1


def test_ibm_hardware_response_contains_no_credentials(client):
    r = client.get("/api/ibm-hardware/results")
    text = r.text
    for forbidden in ("IBM_QUANTUM_API_KEY", "IBM_QUANTUM_CRN", "crn:v1:bluemix"):
        assert forbidden not in text
    real_key = os.environ.get("IBM_QUANTUM_API_KEY")
    if real_key:
        assert real_key not in text


def test_backend_process_never_imports_qiskit_ibm_runtime():
    # Structural guarantee, not just a policy: the module that can actually submit a hardware
    # job must not even be importable from within the web backend's process.
    import sys

    import backend.app.main  # noqa: F401

    assert "qiskit_ibm_runtime" not in sys.modules
