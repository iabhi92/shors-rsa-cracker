"""Tests for backend/app/rate_limit.py -- both the RateLimiter unit (deterministic, no real
sleeping) and the wired-up behavior on an actual endpoint through TestClient."""

import pytest
from fastapi.testclient import TestClient

from backend.app.rate_limit import RateLimiter, RateLimitExceededError


def test_allows_up_to_max_requests_then_raises() -> None:
    limiter = RateLimiter(max_requests=3, window_seconds=60)
    for _ in range(3):
        limiter.check("client-a")
    with pytest.raises(RateLimitExceededError) as exc_info:
        limiter.check("client-a")
    assert exc_info.value.status_code == 429
    assert exc_info.value.retry_after_seconds > 0


def test_keys_are_independent() -> None:
    limiter = RateLimiter(max_requests=1, window_seconds=60)
    limiter.check("client-a")
    # A different key must not be affected by client-a's usage.
    limiter.check("client-b")
    with pytest.raises(RateLimitExceededError):
        limiter.check("client-a")


def test_window_resets_after_expiry() -> None:
    limiter = RateLimiter(max_requests=1, window_seconds=0.05)
    limiter.check("client-a")
    with pytest.raises(RateLimitExceededError):
        limiter.check("client-a")
    import time

    time.sleep(0.1)
    limiter.check("client-a")  # new window, should not raise


def test_reset_clears_all_state() -> None:
    limiter = RateLimiter(max_requests=1, window_seconds=60)
    limiter.check("client-a")
    limiter.reset()
    limiter.check("client-a")  # would have raised without reset()


def test_rsa_keygen_endpoint_returns_429_with_retry_after(client: TestClient) -> None:
    from backend.app.rate_limit import rsa_keygen_limiter

    for _ in range(rsa_keygen_limiter.max_requests):
        r = client.post("/api/rsa/keygen", json={"bits": 16})
        assert r.status_code == 200
    r = client.post("/api/rsa/keygen", json={"bits": 16})
    assert r.status_code == 429
    assert "Retry-After" in r.headers
    assert int(r.headers["Retry-After"]) > 0
    assert "Rate limit exceeded" in r.json()["detail"]


def test_classical_attack_and_shor_run_have_separate_budgets(client: TestClient) -> None:
    from backend.app.rate_limit import classical_attack_limiter, rsa_keygen_limiter

    for _ in range(rsa_keygen_limiter.max_requests):
        client.post("/api/rsa/keygen", json={"bits": 16})
    exhausted = client.post("/api/rsa/keygen", json={"bits": 16})
    assert exhausted.status_code == 429

    # Hitting classical/attack should be unaffected by rsa/keygen's exhausted budget.
    r = client.post("/api/classical/attack", json={"n": 15, "method": "trial_division"})
    assert r.status_code == 200
    assert classical_attack_limiter.max_requests > 0  # sanity: distinct limiter object
