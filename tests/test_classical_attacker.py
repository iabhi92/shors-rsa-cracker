import math

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from attacker.classical import (
    attempt_all,
    fermat_factorization,
    pollards_p_minus_1,
    pollards_rho,
    trial_division,
)
from rsa.keygen import generate_keypair
from rsa.primes import generate_prime, is_prime

METHODS_THAT_FACTOR_ANY_SEMIPRIME = [trial_division, pollards_rho]


# --- Helpers to construct composites that specifically exercise each method's strength --


def _semiprime(bits_each: int) -> tuple[int, int, int]:
    """Returns (p, q, n) with p, q distinct primes of ~bits_each bits, like a real RSA n."""
    p = generate_prime(bits_each)
    q = generate_prime(bits_each)
    while q == p:
        q = generate_prime(bits_each)
    return p, q, p * q


def _close_prime_semiprime(bits: int) -> tuple[int, int, int]:
    """A semiprime whose factors are close together — Fermat's method's best case."""
    p = generate_prime(bits)
    q = p + 2
    while not is_prime(q):
        q += 2
    return p, q, p * q


def _smooth_minus_one_prime(smooth_base: int, search_limit: int = 2000) -> int:
    """Find a prime p such that p - 1 = smooth_base * k for small k (p-1 is B-smooth)."""
    for k in range(1, search_limit):
        candidate = smooth_base * k + 1
        if is_prime(candidate):
            return candidate
    raise RuntimeError("could not find a smooth-predecessor prime in search_limit")


# --- trial_division ---------------------------------------------------------------------


def test_trial_division_finds_small_factor():
    result = trial_division(2 * 7919)  # 7919 is prime; smallest factor 2 found instantly
    assert result.succeeded
    assert result.factor == 2
    assert result.other_factor == 7919


def test_trial_division_on_prime_finds_nothing():
    result = trial_division(7919)
    assert not result.succeeded
    assert result.factor is None


def test_trial_division_respects_timeout_on_large_semiprime():
    _, _, n = _semiprime(20)  # smallest factor ~2^20 away; trial division has to grind
    result = trial_division(n, timeout=0.0)
    assert result.timed_out
    assert not result.succeeded


# --- fermat_factorization ----------------------------------------------------------------


def test_fermat_succeeds_fast_when_primes_are_close():
    p, q, n = _close_prime_semiprime(64)
    result = fermat_factorization(n, timeout=5.0)
    assert result.succeeded
    assert {result.factor, result.other_factor} == {p, q}
    assert result.operations < 1000  # this is the whole point of the method


def test_fermat_is_much_slower_when_primes_are_far_apart():
    # Not asserting failure (Fermat *will* terminate eventually) — asserting it costs
    # far more steps than the close-primes case, which is the actual pedagogical point.
    p, q, n = _semiprime(20)
    close_p, close_q, close_n = _close_prime_semiprime(20)
    far_result = fermat_factorization(n, max_iterations=2_000_000)
    close_result = fermat_factorization(close_n, max_iterations=2_000_000)
    assert close_result.succeeded
    if far_result.succeeded:
        assert far_result.operations > close_result.operations


# --- pollards_rho ---------------------------------------------------------------------


@pytest.mark.parametrize("bits_each", [16, 24, 32])
def test_pollards_rho_factors_random_semiprimes(bits_each):
    p, q, n = _semiprime(bits_each)
    result = pollards_rho(n, timeout=10.0)
    assert result.succeeded
    assert {result.factor, result.other_factor} == {p, q}


def test_pollards_rho_on_even_number_is_instant():
    result = pollards_rho(2 * 104729)
    assert result.succeeded
    assert result.factor == 2
    assert result.operations == 0


# --- pollards_p_minus_1 ------------------------------------------------------------------


def test_pollards_p_minus_1_succeeds_when_p_minus_1_is_smooth():
    smooth_base = 2 * 3 * 5 * 7 * 11 * 13  # 30030; any prime factor of p-1 divides this
    p = _smooth_minus_one_prime(smooth_base)
    q = generate_prime(32)
    n = p * q
    result = pollards_p_minus_1(n, bound=20)
    assert result.succeeded
    assert result.factor in (p, q)
    assert n % result.factor == 0


def test_pollards_p_minus_1_fails_cleanly_when_bound_too_small():
    p, q, n = _semiprime(24)  # generic random primes; p-1 unlikely to be smooth under tiny bound
    result = pollards_p_minus_1(n, bound=5)
    assert result.succeeded is False
    assert result.timed_out is False  # must fail cleanly, not hang or crash


# --- attempt_all ----------------------------------------------------------------------


def test_attempt_all_stops_at_first_success_and_finds_correct_factors():
    p, q, n = _close_prime_semiprime(48)  # trial_division will be hopeless, fermat will win
    results = attempt_all(n, timeout_per_method=5.0)
    assert results[-1].succeeded
    assert {results[-1].factor, results[-1].other_factor} == {p, q}
    # every method before the winning one should have been recorded as a real attempt
    for earlier in results[:-1]:
        assert earlier.n == n


def test_attempt_all_on_generic_semiprime_eventually_succeeds():
    p, q, n = _semiprime(20)
    results = attempt_all(n, timeout_per_method=5.0)
    assert results[-1].succeeded
    assert {results[-1].factor, results[-1].other_factor} == {p, q}


# --- Property-based: any *successful* result must be a genuine factorization -----------


@settings(max_examples=15, deadline=None, suppress_health_check=[HealthCheck.too_slow])
@given(bits_each=st.sampled_from([12, 16, 20]))
def test_pollards_rho_result_always_multiplies_back_to_n(bits_each):
    _, _, n = _semiprime(bits_each)
    result = pollards_rho(n, timeout=5.0)
    if result.succeeded:
        assert result.factor * result.other_factor == n
        assert 1 < result.factor < n
