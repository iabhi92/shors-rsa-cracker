"""A broad sweep across every endpoint: nothing in any response body should ever contain
IBM credentials, environment variable names, or a raw Python traceback -- regardless of
whether the request succeeded or failed."""

import os

FORBIDDEN_SUBSTRINGS = ["IBM_QUANTUM_API_KEY", "IBM_QUANTUM_CRN", "Traceback (most recent call last)", "crn:v1:bluemix"]


def _assert_clean(resp) -> None:
    text = resp.text
    for forbidden in FORBIDDEN_SUBSTRINGS:
        assert forbidden not in text, f"found forbidden substring {forbidden!r} in response from {resp.request.url}"
    real_key = os.environ.get("IBM_QUANTUM_API_KEY")
    if real_key:
        assert real_key not in text


def test_no_secrets_leak_across_every_endpoint(client):
    endpoints = [
        ("get", "/api/health", None),
        ("get", "/api/meta", None),
        ("post", "/api/rsa/keygen", {"bits": 16}),
        ("post", "/api/classical/attack", {"n": 91, "method": "trial_division"}),
        ("get", "/api/classical/benchmark", None),
        ("post", "/api/quantum/bell-state", None),
        ("post", "/api/shor/run", {"n": 15, "backend": "honest"}),
        ("get", "/api/shor/backends", None),
        ("post", "/api/circuit/metadata", {"n": 15}),
        ("get", "/api/simulators/compare", None),
        ("post", "/api/resource-estimate", {"bits": 512}),
        ("get", "/api/ibm-hardware/results", None),
        ("get", "/api/docs", None),
        ("get", "/api/docs/security", None),
        # deliberately-invalid requests too -- error paths must stay clean
        ("post", "/api/rsa/keygen", {"bits": -1}),
        ("post", "/api/shor/run", {"n": 999999, "backend": "honest"}),
        ("get", "/api/docs/does-not-exist", None),
    ]
    for method, path, payload in endpoints:
        resp = client.get(path) if method == "get" else client.post(path, json=payload)
        _assert_clean(resp)
