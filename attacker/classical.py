"""Classical factoring attacks against an RSA modulus n = p*q.

These are the algorithms a real attacker without a quantum computer would reach for,
implemented from scratch (no sympy). The point isn't just "classical factoring is slow" —
it's showing *which* classical algorithm applies to *which* weakness, and measuring how
each one actually scales, so the "quantum is exponentially better" claim in
quantum/shor.py has real evidence behind it rather than being asserted.

Attack -> weakness it exploits:
  trial_division        any n; only fast if n has a small factor
  fermat_factorization   fast only if p and q are close together (a real historical bug
                          class: some early RSA implementations picked p, q too close)
  pollards_rho            general purpose; expected O(n^{1/4}) vs trial division's O(n^{1/2})
  pollards_p_minus_1      fast only if p-1 (or q-1) is "smooth" (all small prime factors) —
                          another real weakness class, defended against by choosing "safe" primes
"""

import math
import secrets
import time
from dataclasses import dataclass
from typing import Callable, Optional


@dataclass
class FactorAttemptResult:
    n: int
    method: str
    factor: Optional[int]
    other_factor: Optional[int]
    operations: int
    elapsed_seconds: float
    succeeded: bool
    timed_out: bool = False

    def __post_init__(self) -> None:
        if self.succeeded:
            assert self.factor is not None and self.other_factor is not None
            assert self.factor * self.other_factor == self.n, "factor result must actually divide n"


def _sieve_primes_up_to(limit: int) -> list[int]:
    """Simple sieve of Eratosthenes, used by pollards_p_minus_1's smoothness bound."""
    if limit < 2:
        return []
    is_composite = bytearray(limit + 1)
    primes = []
    for candidate in range(2, limit + 1):
        if not is_composite[candidate]:
            primes.append(candidate)
            for multiple in range(candidate * candidate, limit + 1, candidate):
                is_composite[multiple] = 1
    return primes


def trial_division(n: int, timeout: Optional[float] = None) -> FactorAttemptResult:
    """Try every odd divisor up to sqrt(n). O(sqrt(n)) time, O(1) space."""
    start = time.perf_counter()
    operations = 0

    if n % 2 == 0:
        return FactorAttemptResult(n, "trial_division", 2, n // 2, 1, time.perf_counter() - start, True)

    limit = math.isqrt(n)
    d = 3
    while d <= limit:
        operations += 1
        if n % d == 0:
            elapsed = time.perf_counter() - start
            return FactorAttemptResult(n, "trial_division", d, n // d, operations, elapsed, True)
        if timeout is not None and operations % 200_000 == 0 and time.perf_counter() - start > timeout:
            elapsed = time.perf_counter() - start
            return FactorAttemptResult(n, "trial_division", None, None, operations, elapsed, False, timed_out=True)
        d += 2
    elapsed = time.perf_counter() - start
    return FactorAttemptResult(n, "trial_division", None, None, operations, elapsed, False)


def fermat_factorization(
    n: int, timeout: Optional[float] = None, max_iterations: Optional[int] = None
) -> FactorAttemptResult:
    """Express n = a^2 - b^2 = (a-b)(a+b). Fast iff p and q are close (|p-q| small)."""
    start = time.perf_counter()
    operations = 0

    if n % 2 == 0:
        return FactorAttemptResult(n, "fermat", 2, n // 2, 0, time.perf_counter() - start, True)

    a = math.isqrt(n)
    if a * a < n:
        a += 1
    while True:
        b_squared = a * a - n
        b = math.isqrt(b_squared)
        operations += 1
        if b * b == b_squared:
            p, q = a - b, a + b
            elapsed = time.perf_counter() - start
            if p == 1:
                # n itself is a perfect square's neighbour in a degenerate way; not a real split
                return FactorAttemptResult(n, "fermat", None, None, operations, elapsed, False)
            return FactorAttemptResult(n, "fermat", p, q, operations, elapsed, True)
        a += 1
        if timeout is not None and operations % 50_000 == 0 and time.perf_counter() - start > timeout:
            elapsed = time.perf_counter() - start
            return FactorAttemptResult(n, "fermat", None, None, operations, elapsed, False, timed_out=True)
        if max_iterations is not None and operations >= max_iterations:
            elapsed = time.perf_counter() - start
            return FactorAttemptResult(n, "fermat", None, None, operations, elapsed, False)


def pollards_rho(
    n: int, timeout: Optional[float] = None, max_attempts: int = 100
) -> FactorAttemptResult:
    """Floyd-cycle-detection variant of Pollard's rho. Expected O(n^{1/4})."""
    start = time.perf_counter()
    operations = 0

    if n % 2 == 0:
        return FactorAttemptResult(n, "pollards_rho", 2, n // 2, 0, time.perf_counter() - start, True)

    def f(x: int, c: int) -> int:
        return (x * x + c) % n

    for _ in range(max_attempts):
        c = secrets.randbelow(n - 1) + 1
        x = y = secrets.randbelow(n - 2) + 2
        d = 1
        while d == 1:
            x = f(x, c)
            y = f(f(y, c), c)
            d = math.gcd(abs(x - y), n)
            operations += 1
            if timeout is not None and operations % 20_000 == 0 and time.perf_counter() - start > timeout:
                elapsed = time.perf_counter() - start
                return FactorAttemptResult(n, "pollards_rho", None, None, operations, elapsed, False, timed_out=True)
        if d != n:
            elapsed = time.perf_counter() - start
            return FactorAttemptResult(n, "pollards_rho", d, n // d, operations, elapsed, True)
        # d == n: this (x0, c) pair cycled without splitting n; retry with a fresh one

    elapsed = time.perf_counter() - start
    return FactorAttemptResult(n, "pollards_rho", None, None, operations, elapsed, False)


def pollards_p_minus_1(
    n: int, bound: int = 200_000, timeout: Optional[float] = None
) -> FactorAttemptResult:
    """Succeeds iff (p-1) or (q-1) is B-smooth for B = bound. Fails otherwise, cleanly."""
    start = time.perf_counter()
    operations = 0
    a = 2

    for prime in _sieve_primes_up_to(bound):
        prime_power = prime
        while prime_power <= bound:
            a = pow(a, prime, n)
            prime_power *= prime
            operations += 1
        d = math.gcd(a - 1, n)
        if 1 < d < n:
            elapsed = time.perf_counter() - start
            return FactorAttemptResult(n, "pollards_p_minus_1", d, n // d, operations, elapsed, True)
        if d == n:
            # every prime factor's -1 was smooth simultaneously; bound was too loose to split them
            elapsed = time.perf_counter() - start
            return FactorAttemptResult(n, "pollards_p_minus_1", None, None, operations, elapsed, False)
        if timeout is not None and operations % 5_000 == 0 and time.perf_counter() - start > timeout:
            elapsed = time.perf_counter() - start
            return FactorAttemptResult(
                n, "pollards_p_minus_1", None, None, operations, elapsed, False, timed_out=True
            )

    elapsed = time.perf_counter() - start
    return FactorAttemptResult(n, "pollards_p_minus_1", None, None, operations, elapsed, False)


ATTACK_METHODS: dict[str, Callable[..., FactorAttemptResult]] = {
    "trial_division": trial_division,
    "fermat": fermat_factorization,
    "pollards_rho": pollards_rho,
    "pollards_p_minus_1": pollards_p_minus_1,
}


def attempt_all(n: int, timeout_per_method: Optional[float] = None) -> list[FactorAttemptResult]:
    """Run every classical method in turn, cheapest-first, and record every result.

    Stops early only once one method succeeds (a real attacker would too), but always
    returns the full trail of what was tried — useful for the "watch it fail" narrative.
    """
    results = []
    for method in (trial_division, fermat_factorization, pollards_p_minus_1, pollards_rho):
        result = method(n, timeout=timeout_per_method)
        results.append(result)
        if result.succeeded:
            break
    return results
