from fractions import Fraction

import numpy as np
import pytest

from quantum.shor import (
    continued_fraction_convergents,
    extract_period_from_measurement,
    find_period_quantum,
    shors_algorithm,
)
from rsa.core import decrypt_int, encrypt_int
from rsa.keygen import KeyPair, PrivateKey, PublicKey, mod_inverse

# Composites with small factors, deliberately picked so the *honest* full statevector
# simulation stays cheap (n_count + n_target qubits, dense 2^n-length state vector).
SMALL_COMPOSITES = [15, 21, 33, 35, 51, 55, 65]


# --- continued fractions -----------------------------------------------------------------


def test_continued_fraction_convergents_final_term_reconstructs_exact_fraction():
    numerator, denominator = 3, 8
    convergents = continued_fraction_convergents(numerator, denominator)
    assert convergents[-1] == Fraction(numerator, denominator)


def test_continued_fraction_convergents_of_zero_over_n():
    assert continued_fraction_convergents(0, 5) == [Fraction(0, 1)]


@pytest.mark.parametrize("num,den", [(1, 1), (5, 7), (192, 256), (853, 4096), (1, 1000)])
def test_continued_fraction_convergents_are_strictly_better_approximations(num, den):
    convergents = continued_fraction_convergents(num, den)
    target = num / den
    errors = [abs(float(c) - target) for c in convergents]
    assert errors == sorted(errors, reverse=True)  # non-increasing approximation error


# --- extract_period_from_measurement -------------------------------------------------------


def test_extract_period_returns_none_for_uninformative_zero_measurement():
    assert extract_period_from_measurement(0, 8, 7, 15) is None


@pytest.mark.parametrize("measured", [64, 192])
def test_extract_period_recovers_known_period_at_exact_peaks(measured):
    # N=15, a=7: 7^1=7, 7^2=4, 7^3=13, 7^4=1 mod 15 -> r=4, and 4 | 256 exactly, so the
    # peaks in the measurement distribution sit at exact multiples of 256/4 = 64. Peaks
    # correspond to measured = k*256/4 for k=0..3; only k coprime to r=4 (k=1,3, i.e.
    # measured=64,192) actually reduce back to r=4 via continued fractions.
    assert extract_period_from_measurement(measured, 8, 7, 15) == 4


def test_extract_period_fails_on_the_known_gcd_collision_peak():
    # measured=128 corresponds to k=2 (k/r = 2/4 = 1/2 in lowest terms) — since
    # gcd(k, r) = 2 != 1, continued fractions can only ever recover r/gcd(k,r) = 2, and
    # verification (7^2 mod 15 = 4 != 1) correctly rejects that. This is Shor's algorithm's
    # real, expected per-shot failure mode when k and r aren't coprime — not a bug.
    assert extract_period_from_measurement(128, 8, 7, 15) is None


# --- find_period_quantum: exact special case (r divides 2^n_count exactly) ----------------


def test_period_finding_distribution_matches_theory_exactly_for_power_of_two_period():
    # This is a strong end-to-end correctness check: it only passes if superposition
    # creation, the modexp permutation, and the inverse QFT are all simultaneously correct.
    # Of the 4 exact peaks, only measured in {64, 192} (k coprime to r=4) actually let
    # continued fractions recover r=4; {0, 128} are expected, real failure modes.
    rng = np.random.default_rng(0)
    n_count = 8
    shots = 300
    counts: dict[int, int] = {}
    for _ in range(shots):
        result = find_period_quantum(7, 15, rng, n_count=n_count)
        counts[result.measured] = counts.get(result.measured, 0) + 1
        if result.measured in (64, 192):
            assert result.period == 4
        else:
            assert result.period is None

    assert set(counts.keys()) == {0, 64, 128, 192}
    for count in counts.values():
        assert count / shots == pytest.approx(0.25, abs=0.08)


# --- shors_algorithm: classical pre-checks --------------------------------------------------


def test_shors_algorithm_rejects_prime_N():
    with pytest.raises(ValueError):
        shors_algorithm(17, np.random.default_rng(0))


def test_shors_algorithm_even_N_is_a_free_classical_shortcut():
    result = shors_algorithm(46, np.random.default_rng(0))  # 2 * 23
    assert result.factors == (2, 23)
    assert len(result.attempts) == 1
    assert "quantum" in result.attempts[0].outcome


@pytest.mark.parametrize("N,expected_base", [(27, 3), (49, 7), (125, 5)])
def test_shors_algorithm_perfect_power_is_a_free_classical_shortcut(N, expected_base):
    result = shors_algorithm(N, np.random.default_rng(0))
    assert expected_base in result.factors
    assert result.factors[0] * result.factors[1] == N
    assert len(result.attempts) == 1


# --- shors_algorithm: the real quantum path --------------------------------------------------


@pytest.mark.parametrize("N", SMALL_COMPOSITES)
def test_shors_algorithm_recovers_correct_factors(N):
    rng = np.random.default_rng(42)
    result = shors_algorithm(N, rng, max_attempts=20)
    assert result.factors is not None
    p, q = result.factors
    assert p * q == N
    assert 1 < p < N and 1 < q < N


def test_shors_algorithm_success_rate_is_reliably_high_across_seeds():
    N = 21
    successes = 0
    trials = 15
    for seed in range(trials):
        result = shors_algorithm(N, np.random.default_rng(seed), max_attempts=20)
        if result.factors is not None:
            successes += 1
            assert result.factors[0] * result.factors[1] == N
    assert successes / trials >= 0.9


def test_shors_algorithm_attempt_log_shows_the_known_failure_modes_eventually():
    # Not every seed hits every failure mode, but running enough seeds should surface at
    # least one odd-period retry and one gcd(a,N)!=1 shortcut somewhere in the trail —
    # confirming those code paths are actually exercised, not just present but dead.
    seen_notes = set()
    for seed in range(30):
        result = shors_algorithm(35, np.random.default_rng(seed), max_attempts=20)
        for attempt in result.attempts:
            seen_notes.add(attempt.outcome)
    assert any("odd" in note for note in seen_notes)


# --- The full circle: break real (tiny) RSA with the quantum simulator --------------------


def _small_keypair(p: int, q: int, e: int) -> KeyPair:
    n = p * q
    phi = (p - 1) * (q - 1)
    d = mod_inverse(e, phi)
    return KeyPair(public=PublicKey(n=n, e=e), private=PrivateKey(n=n, d=d), p=p, q=q)


def test_shors_algorithm_breaks_real_rsa_end_to_end():
    # N=35 is far too small to hold even one byte of text (rsa/core.py correctly refuses
    # that — see test_encrypt_bytes_on_modulus_too_small_for_one_byte_raises_clear_error),
    # so this uses the integer RSA primitive directly, exactly like a real textbook-RSA demo
    # on a toy key would: encrypt an integer secret, break the key, decrypt it back.
    kp = _small_keypair(p=5, q=7, e=5)  # N=35
    secret = 13
    ciphertext = encrypt_int(secret, kp.public)

    result = shors_algorithm(kp.public.n, np.random.default_rng(7), max_attempts=20)
    assert result.factors is not None
    p, q = result.factors
    assert {p, q} == {kp.p, kp.q}

    phi = (p - 1) * (q - 1)
    recovered_d = mod_inverse(kp.public.e, phi)
    assert recovered_d == kp.private.d

    cracked_key = PrivateKey(n=kp.public.n, d=recovered_d)
    assert decrypt_int(ciphertext, cracked_key) == secret


@pytest.mark.slow
def test_shors_algorithm_breaks_larger_rsa_keypair():
    # N=143=11*13 (an 8-bit RSA modulus, 4-bit primes) with a reduced control-register
    # precision to keep the honest full-statevector simulation fast (18 qubits vs. the
    # default 24); success probability per attempt is lower but retries cover it.
    kp = _small_keypair(p=11, q=13, e=7)
    secret = 42
    ciphertext = encrypt_int(secret, kp.public)

    result = shors_algorithm(kp.public.n, np.random.default_rng(3), max_attempts=20, n_count=10)
    assert result.factors is not None
    assert {result.factors[0], result.factors[1]} == {kp.p, kp.q}

    phi = (kp.p - 1) * (kp.q - 1)
    cracked_key = PrivateKey(n=kp.public.n, d=mod_inverse(kp.public.e, phi))
    assert decrypt_int(ciphertext, cracked_key) == secret
