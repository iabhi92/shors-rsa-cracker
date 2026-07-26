import time

import numpy as np
import pytest

from quantum.fast_sim import find_period_quantum_fast, multiplicative_order
from quantum.shor import find_period_quantum, shors_algorithm

SMALL_COMPOSITES = [15, 21, 33, 35, 51, 55, 65]


# --- multiplicative_order ------------------------------------------------------------------


@pytest.mark.parametrize(
    "a,N,expected_r",
    [(7, 15, 4), (2, 15, 4), (4, 15, 2), (2, 21, 6), (10, 21, 6), (17, 35, 12)],
)
def test_multiplicative_order_matches_known_values(a, N, expected_r):
    r = multiplicative_order(a, N)
    assert r == expected_r
    assert pow(a, r, N) == 1
    for smaller in range(1, r):
        assert pow(a, smaller, N) != 1  # r must be the *smallest* such exponent


def test_multiplicative_order_rejects_non_coprime_a():
    with pytest.raises(ValueError):
        multiplicative_order(6, 21)  # gcd(6,21) = 3


# --- cross-validation: fast sampler vs. the honest full-statevector simulator -------------


def test_fast_sampler_reproduces_exact_peak_distribution():
    # Same exact-peak case as tests/test_quantum_shor.py's honest-simulator version — the
    # fast sampler should match it precisely here since r=4 divides 2^n_count=256 exactly.
    rng = np.random.default_rng(0)
    n_count = 8
    shots = 300
    counts: dict[int, int] = {}
    for _ in range(shots):
        result = find_period_quantum_fast(7, 15, rng, n_count=n_count)
        counts[result.measured] = counts.get(result.measured, 0) + 1

    assert set(counts.keys()) == {0, 64, 128, 192}
    for count in counts.values():
        assert count / shots == pytest.approx(0.25, abs=0.08)


def _total_variation_distance(counts_a: dict, counts_b: dict, shots: int) -> float:
    outcomes = set(counts_a) | set(counts_b)
    return 0.5 * sum(abs(counts_a.get(m, 0) / shots - counts_b.get(m, 0) / shots) for m in outcomes)


def test_fast_sampler_matches_honest_simulator_when_period_divides_2_pow_n_count():
    # r=4 divides 2^n_count=256 exactly here, so the honest simulator's peaks are exact
    # delta functions and the fast sampler's "round to nearest peak" approximation is exact
    # too -> the two distributions should agree tightly, not just approximately.
    rng_honest = np.random.default_rng(1)
    rng_fast = np.random.default_rng(1)
    shots = 300

    honest_counts: dict[int, int] = {}
    fast_counts: dict[int, int] = {}
    for _ in range(shots):
        m = find_period_quantum(7, 15, rng_honest).measured
        honest_counts[m] = honest_counts.get(m, 0) + 1
    for _ in range(shots):
        m = find_period_quantum_fast(7, 15, rng_fast).measured
        fast_counts[m] = fast_counts.get(m, 0) + 1

    assert _total_variation_distance(honest_counts, fast_counts, shots) < 0.12


@pytest.mark.parametrize("N,a", [(21, 2), (35, 17)])
def test_fast_sampler_approximates_honest_simulator_when_period_does_not_divide_evenly(N, a):
    # r does NOT divide 2^n_count exactly for these (r=6, r=12) -> the honest simulator's
    # peaks have some real spread, while the fast sampler collapses each to a single point
    # (see quantum/fast_sim.py's module docstring on this approximation). The two
    # distributions are expected to be similar in *shape* (same peak locations, comparable
    # weight) but not near-identical the way the exact-divisor case above is — hence the
    # looser bound. What actually matters for this project (successfully factoring N) is
    # checked separately and more tightly in the success-rate tests below.
    rng_honest = np.random.default_rng(1)
    rng_fast = np.random.default_rng(1)
    shots = 100  # honest simulator is the bottleneck here; kept small to keep tests fast

    honest_counts: dict[int, int] = {}
    fast_counts: dict[int, int] = {}
    for _ in range(shots):
        m = find_period_quantum(a, N, rng_honest).measured
        honest_counts[m] = honest_counts.get(m, 0) + 1
    for _ in range(shots):
        m = find_period_quantum_fast(a, N, rng_fast).measured
        fast_counts[m] = fast_counts.get(m, 0) + 1

    assert _total_variation_distance(honest_counts, fast_counts, shots) < 0.4


def test_fast_sampler_success_rate_matches_honest_simulator_ballpark():
    N = 21
    trials = 15
    honest_successes = sum(
        1
        for seed in range(trials)
        if shors_algorithm(N, np.random.default_rng(seed), max_attempts=20).factors is not None
    )
    fast_successes = sum(
        1
        for seed in range(trials)
        if shors_algorithm(
            N, np.random.default_rng(seed), max_attempts=20, period_finder=find_period_quantum_fast
        ).factors
        is not None
    )
    assert honest_successes / trials >= 0.85
    assert fast_successes / trials >= 0.85


# --- shors_algorithm with the fast period finder plugged in --------------------------------


@pytest.mark.parametrize("N", SMALL_COMPOSITES)
def test_shors_algorithm_with_fast_sampler_recovers_correct_factors(N):
    rng = np.random.default_rng(42)
    result = shors_algorithm(N, rng, max_attempts=20, period_finder=find_period_quantum_fast)
    assert result.factors is not None
    p, q = result.factors
    assert p * q == N
    assert 1 < p < N and 1 < q < N


def test_fast_sampler_handles_N_far_too_large_for_the_honest_simulator():
    # N=10403=101*103: n_target=14 bits, honest default n_count=28 -> 42 qubits, a dense
    # statevector of 2^42 complex numbers (tens of terabytes) — utterly infeasible here.
    # The fast sampler only needs multiplicative_order's O(r) classical loop, r | phi(N).
    N = 101 * 103
    rng = np.random.default_rng(5)
    start = time.perf_counter()
    result = shors_algorithm(N, rng, max_attempts=20, period_finder=find_period_quantum_fast)
    elapsed = time.perf_counter() - start

    assert result.factors is not None
    assert set(result.factors) == {101, 103}
    assert elapsed < 5.0
