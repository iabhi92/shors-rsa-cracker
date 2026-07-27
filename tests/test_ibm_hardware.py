import numpy as np
import pytest
from qiskit.quantum_info import Statevector

from quantum.ibm_hardware import build_compiled_circuit, compiled_target_qubit_count
from quantum.modexp import apply_modular_exponentiation
from quantum.qft import apply_inverse_qft
from quantum.statevector import H, QuantumRegister

# --- build_compiled_circuit: cross-validated exactly against the project's own permutation
# simulator, before any of this is trusted to spend real IBM hardware time on -------------


def _ground_truth_counting_distribution(a: int, N: int, n_count: int) -> np.ndarray:
    n_target = N.bit_length()
    reg = QuantumRegister(n_count + n_target, initial_value=1)
    for q in range(n_count):
        reg.apply_gate(H, q)
    apply_modular_exponentiation(reg, n_count, n_target, a, N)
    apply_inverse_qft(reg, list(range(n_count)))
    return reg.marginal_probabilities(list(range(n_count)))


def _compiled_counting_distribution(a: int, N: int, n_count: int) -> np.ndarray:
    qc = build_compiled_circuit(a, N, n_count)
    qc.remove_final_measurements()  # read exact amplitudes instead of sampling
    sv = Statevector.from_instruction(qc)
    probs_full = sv.probabilities_dict()

    counting_probs = np.zeros(2**n_count)
    for bitstring, p in probs_full.items():
        # Qiskit's overall bitstring: leftmost char = highest-index qubit. Counting qubits
        # are circuit qubits 0..n_count-1 (the lowest indices), i.e. the rightmost n_count
        # characters; reversed to match this project's MSB-first convention.
        counting_bits = bitstring[-n_count:]
        x = int(counting_bits[::-1], 2)
        counting_probs[x] += p
    return counting_probs


@pytest.mark.parametrize(
    "a,n_count",
    [(7, 3), (7, 4), (7, 8), (11, 3), (11, 5), (2, 4), (4, 3), (13, 5), (14, 4), (8, 6)],
)
def test_compiled_circuit_matches_ground_truth_exactly(a, n_count):
    # N=15 is used everywhere in this module (and project) specifically because every valid
    # a mod 15 has an order that's a power of two -- see quantum/ibm_hardware.py's docstring.
    compiled = _compiled_counting_distribution(a, 15, n_count)
    ground_truth = _ground_truth_counting_distribution(a, 15, n_count)
    assert np.allclose(compiled, ground_truth, atol=1e-9)


def test_compiled_target_qubit_count_matches_log2_of_order():
    assert compiled_target_qubit_count(7, 15) == 2  # order 4
    assert compiled_target_qubit_count(11, 15) == 1  # order 2
    assert compiled_target_qubit_count(4, 15) == 1  # order 2


def test_build_compiled_circuit_rejects_non_coprime_a():
    with pytest.raises(ValueError):
        build_compiled_circuit(3, 15, n_count=3)  # gcd(3, 15) = 3


def test_build_compiled_circuit_is_shallow():
    # The entire point of this compiled circuit is to be shallow enough to survive real NISQ
    # noise -- pin down a generous upper bound so a future edit that accidentally reintroduces
    # circuit depth (e.g. swapping back to a generic/non-compiled construction) fails loudly.
    qc = build_compiled_circuit(7, 15, n_count=3)
    assert qc.depth() < 15
    assert qc.size() < 25
