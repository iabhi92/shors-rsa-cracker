"""Real rate limiting on the endpoints that actually cost meaningful CPU (RSA keygen,
classical factoring, Shor's algorithm) -- fixed-window, per-client-IP, in-process.

Named, honest limitation up front: this is in-memory and single-process. It correctly
demonstrates the mechanism (and is genuinely effective against a single abusive client hitting
this exact process) but does NOT provide a real limit across multiple backend replicas behind
a load balancer -- that needs shared state (Redis, a database, or an API-gateway-level
limiter). Scaling this backend horizontally without also moving the limiter state out of
process would silently multiply the effective limit by the replica count. Documented here
rather than left as a surprise, the same way quantum/fast_sim.py documents what its own
shortcut is not a substitute for.
"""

import time
from collections.abc import Callable
from dataclasses import dataclass

from fastapi import Request

from backend.app.errors import AppError


@dataclass
class _Window:
    count: int
    window_start: float


class RateLimitExceededError(AppError):
    def __init__(self, retry_after_seconds: float) -> None:
        self.retry_after_seconds = retry_after_seconds
        retry_after_int = max(1, round(retry_after_seconds))
        super().__init__(
            f"Rate limit exceeded. Try again in {retry_after_int}s.",
            status_code=429,
            headers={"Retry-After": str(retry_after_int)},
        )


class RateLimiter:
    """max_requests per window_seconds, keyed by an arbitrary string (this module always
    keys by client IP, but the class itself doesn't assume that -- unit-testable directly
    without going through a real HTTP request)."""

    def __init__(self, max_requests: int, window_seconds: float):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._state: dict[str, _Window] = {}

    def check(self, key: str) -> None:
        now = time.monotonic()
        w = self._state.get(key)
        if w is None or now - w.window_start >= self.window_seconds:
            self._state[key] = _Window(count=1, window_start=now)
            return
        if w.count >= self.max_requests:
            raise RateLimitExceededError(self.window_seconds - (now - w.window_start))
        w.count += 1

    def reset(self) -> None:
        """Test-only: clear all state between test cases so they don't interfere with
        each other via TestClient's shared 'testclient' source IP."""
        self._state.clear()


def _client_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def limiter_dependency(limiter: RateLimiter) -> Callable[[Request], None]:
    def _dep(request: Request) -> None:
        limiter.check(_client_key(request))

    return _dep


_GLOBAL_KEY = "global"


def global_limiter_dependency(limiter: RateLimiter) -> Callable[[Request], None]:
    """Same RateLimiter class, but keyed by one fixed constant instead of client IP -- every
    caller shares a single budget. Real IBM Quantum hardware time is a shared account-wide
    resource (unlike CPU, which is cheap and per-request), so a per-IP limit alone can't stop
    many different visitors from collectively draining it; this caps the total regardless of
    who's asking."""

    def _dep(request: Request) -> None:
        limiter.check(_GLOBAL_KEY)

    return _dep


# One limiter instance per expensive endpoint family -- separate budgets, so hammering the
# classical attack lab doesn't also lock you out of RSA keygen.
rsa_keygen_limiter = RateLimiter(max_requests=20, window_seconds=60)
classical_attack_limiter = RateLimiter(max_requests=20, window_seconds=60)
shor_run_limiter = RateLimiter(max_requests=15, window_seconds=60)

# A tiny, deliberately separate budget so the Security Dashboard's live rate-limit demo can
# actually trip a 429 in front of a visitor within a few seconds, without spending down the
# budget any other page's real functionality depends on.
dashboard_demo_limiter = RateLimiter(max_requests=5, window_seconds=15)

# Real IBM Quantum hardware time is a genuinely limited, account-wide resource (not cheap CPU
# like every other limiter above) -- two separate caps, both must pass: one visitor can't burn
# through the whole day's global budget alone (per-IP), and the account's total real-hardware
# exposure per day is bounded no matter how many different visitors ask (global).
ibm_hardware_per_ip_limiter = RateLimiter(max_requests=3, window_seconds=3600)
ibm_hardware_global_limiter = RateLimiter(max_requests=15, window_seconds=86400)
