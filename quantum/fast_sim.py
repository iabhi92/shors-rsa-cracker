"""A fast, statistically faithful sampler for Shor's period-finding measurement outcome —
for N too large for the honest full-statevector simulator (quantum/shor.py's
find_period_quantum) to run on a classical laptop in reasonable time/memory.

This is the standard shortcut essentially every Shor's-algorithm demo capable of handling
more than a handful of qubits relies on (see e.g. Craig Gidney's
https://algassert.com/post/1718, which this project's mentor specifically pointed to as the
quality bar to aim for). The idea: since we're simulating on a classical computer anyway,
and the *quantum* part of Shor's algorithm produces measurement outcomes drawn from a
specific, known probability distribution (a function of a, N, r, and n_count alone — see
below), we can sample directly from that distribution instead of paying the
O(2^(n_count+n_target)) cost of actually building and evolving the statevector.

IMPORTANT — what this is and isn't:
  - It IS a legitimate way to demo the algorithm's *output behaviour* (measurement
    statistics, the retry loop hitting the same real failure modes, successfully factoring)
    for N well beyond the honest simulator's qubit budget, cross-validated statistically
    against the honest simulator wherever both can run (tests/test_quantum_fast_sim.py).
  - It is NOT a scalability result. Sampling requires classically computing a's
    multiplicative order r first (`multiplicative_order` below) — and for genuinely large N
    (hundreds+ bits, i.e. real RSA sizes), computing r classically is exactly as hard as
    factoring N in the first place. This module is only useful in the *middle* zone: N too
    big to honestly simulate with a handful of qubits, but still small enough that brute-
    force order-finding is classically cheap. That gap is a demo convenience, not a claim
    that the quantum-hardness barrier has been worked around classically.

Approximation used: the exact post-QFT distribution has its probability mass concentrated
very close to r evenly-spaced peaks (one per k in [0, r)), with peak k centered near
measured = round(k * 2^n_count / r); when r happens to divide 2^n_count exactly, this is
exact (as verified in tests/test_quantum_shor.py's power-of-two-period test). When it
doesn't divide exactly, the true distribution spreads a small amount of mass onto integers
adjacent to that rounded peak; this sampler places all of a peak's probability mass exactly
at the rounded integer instead of modelling that spread. Downstream continued-fractions
recovery is intentionally robust to being off by a small amount (n_count is chosen with
extra precision bits specifically for this reason), which is why this approximation doesn't
change the algorithm's success-rate behaviour in practice — checked empirically in the tests
by comparing this sampler's and the honest simulator's overall shors_algorithm success rates.
"""

import math

import numpy as np

from quantum.shor import PeriodFindingResult, default_n_count, extract_period_from_measurement


def multiplicative_order(a: int, N: int) -> int:
    """Classically compute ord_N(a) by brute force. Only used here so this module has a
    known-correct r to sample against — see the module docstring for why this specifically
    does NOT generalize to real RSA-sized N (that's the whole point of the algorithm)."""
    if math.gcd(a, N) != 1:
        raise ValueError(f"a={a} must be coprime with N={N}")
    r, value = 1, a % N
    while value != 1:
        value = (value * a) % N
        r += 1
    return r


def find_period_quantum_fast(
    a: int, N: int, rng: np.random.Generator, n_count: int | None = None
) -> PeriodFindingResult:
    """Sample a control-register measurement from the idealized theoretical distribution,
    without simulating any statevector. Same signature/return type as
    quantum.shor.find_period_quantum so the two are interchangeable as `period_finder` in
    quantum.shor.shors_algorithm."""
    if math.gcd(a, N) != 1:
        raise ValueError("a must be coprime with N")
    n_target = N.bit_length()
    if n_count is None:
        n_count = default_n_count(N)

    r = multiplicative_order(a, N)
    k = int(rng.integers(0, r))
    denom = 2**n_count
    # integer rounding of k * denom / r, to avoid float precision loss once denom is large
    measured = ((k * denom + r // 2) // r) % denom

    period = extract_period_from_measurement(measured, n_count, a, N)

    return PeriodFindingResult(
        N=N,
        a=a,
        n_count=n_count,
        n_target=n_target,
        measured=measured,
        measured_probability=1.0 / r,  # idealized peak weight; see module docstring
        period=period,
    )
