import numpy as np
import pytest

from quantum.cirq_shor import build_circuit, find_period_quantum_cirq
from quantum.modexp import apply_modular_exponentiation
from quantum.qft import apply_inverse_qft
from quantum.shor import find_period_quantum, shors_algorithm
from quantum.statevector import H, QuantumRegister

cirq = pytest.importorskip("cirq")

# Cirq's general-purpose simulator has much higher constant-factor overhead per shot than our
# own direct-permutation statevector.py (~10s for an 18-qubit circuit vs. ~0.1s measured for
# the same problem in tests/test_quantum_shor.py) — expected, since it's a general framework
# built for far more than this one demo, not a correctness issue. So unlike the honest-vs-fast
# comparison in tests/test_quantum_fast_sim.py, this file deliberately does NOT mirror the full
# SMALL_COMPOSITES sweep: the exact statevector match below already gives the strongest
# possible cross-validation (bit-for-bit agreement on the actual quantum state, not just
# measurement statistics), so the remaining tests only need a couple of small, fast cases to
# additionally confirm the full measure-and-postprocess pipeline agrees end to end.
FAST_COMPOSITES = [15, 21]


# --- Direct statevector comparison: our from-scratch simulator vs. an independent framework -


@pytest.mark.parametrize("N,a,n_count", [(15, 7, 6), (15, 2, 8), (21, 2, 6), (35, 17, 5)])
def test_full_circuit_statevector_matches_cirq_exactly(N, a, n_count):
    n_target = N.bit_length()

    # our own simulator
    reg = QuantumRegister(n_count + n_target, initial_value=1)
    for q in range(n_count):
        reg.apply_gate(H, q)
    apply_modular_exponentiation(reg, n_count, n_target, a, N)
    apply_inverse_qft(reg, list(range(n_count)))

    # Cirq, independently
    circuit, _ = build_circuit(a, N, n_count)
    unmeasured = circuit[:-1]  # drop the final measurement to inspect the statevector
    cirq_state = cirq.Simulator().simulate(unmeasured).final_state_vector

    assert np.allclose(reg.state, cirq_state, atol=1e-6)


# --- shors_algorithm with Cirq as the period_finder (small N only, see module note above) --


@pytest.mark.parametrize("N", FAST_COMPOSITES)
def test_shors_algorithm_with_cirq_period_finder_recovers_correct_factors(N):
    rng = np.random.default_rng(42)
    result = shors_algorithm(N, rng, max_attempts=10, period_finder=find_period_quantum_cirq)
    assert result.factors is not None
    p, q = result.factors
    assert p * q == N
    assert 1 < p < N and 1 < q < N


def test_cirq_period_finder_success_rate_matches_our_own_simulator():
    N = 15  # fastest case for both simulators, keeps this statistical check cheap
    trials = 8
    ours = sum(
        1
        for seed in range(trials)
        if shors_algorithm(N, np.random.default_rng(seed), max_attempts=10).factors is not None
    )
    via_cirq = sum(
        1
        for seed in range(trials)
        if shors_algorithm(
            N, np.random.default_rng(seed), max_attempts=10, period_finder=find_period_quantum_cirq
        ).factors
        is not None
    )
    assert ours / trials >= 0.75
    assert via_cirq / trials >= 0.75


# --- Measurement distribution: both are exact full simulations, so this should match tightly -


def test_cirq_and_our_own_simulator_measurement_distributions_match_closely():
    N, a, n_count = 15, 7, 8
    shots = 150

    ours: dict[int, int] = {}
    rng_ours = np.random.default_rng(3)
    for _ in range(shots):
        m = find_period_quantum(a, N, rng_ours, n_count=n_count).measured
        ours[m] = ours.get(m, 0) + 1

    via_cirq: dict[int, int] = {}
    rng_cirq = np.random.default_rng(3)
    for _ in range(shots):
        m = find_period_quantum_cirq(a, N, rng_cirq, n_count=n_count).measured
        via_cirq[m] = via_cirq.get(m, 0) + 1

    outcomes = set(ours) | set(via_cirq)
    tv_distance = 0.5 * sum(
        abs(ours.get(m, 0) / shots - via_cirq.get(m, 0) / shots) for m in outcomes
    )
    # Both are exact simulations of the identical circuit (unlike fast_sim's approximation),
    # so unlike tests/test_quantum_fast_sim.py, this is held to a tight bound.
    assert tv_distance < 0.15
    assert set(ours.keys()) == {0, 64, 128, 192}
    assert set(via_cirq.keys()) == {0, 64, 128, 192}
