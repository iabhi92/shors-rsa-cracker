import numpy as np
import pytest

from quantum.qft import apply_inverse_qft, apply_qft, dft_matrix
from quantum.statevector import H, X, Y, Z, QuantumRegister

SQRT2_INV = 1 / np.sqrt(2)


def _random_state(n_qubits: int, rng: np.random.Generator) -> np.ndarray:
    dim = 2**n_qubits
    vec = rng.normal(size=dim) + 1j * rng.normal(size=dim)
    return vec / np.linalg.norm(vec)


# --- basic single/multi-qubit gates -----------------------------------------------------


def test_hadamard_on_zero_gives_uniform_superposition():
    reg = QuantumRegister(1, 0)
    reg.apply_gate(H, 0)
    assert np.allclose(reg.state, [SQRT2_INV, SQRT2_INV])


def test_pauli_x_is_a_bit_flip():
    reg = QuantumRegister(1, 0)
    reg.apply_gate(X, 0)
    assert np.allclose(reg.state, [0, 1])


def test_pauli_z_flips_phase_of_one_only():
    reg = QuantumRegister(1, 1)
    reg.apply_gate(Z, 0)
    assert np.allclose(reg.state, [0, -1])


def test_pauli_y_matches_standard_definition_on_zero():
    reg = QuantumRegister(1, 0)
    reg.apply_gate(Y, 0)
    assert np.allclose(reg.state, [0, 1j])


def test_apply_gate_on_one_qubit_of_a_pair_leaves_the_other_alone():
    reg = QuantumRegister(2, 0)  # |00>
    reg.apply_gate(X, 1)  # flip qubit 1 only -> |01>
    assert np.allclose(reg.state, [0, 1, 0, 0])


def test_hadamard_twice_is_identity():
    reg = QuantumRegister(1, 0)
    reg.apply_gate(H, 0)
    reg.apply_gate(H, 0)
    assert np.allclose(reg.state, [1, 0])


# --- controlled gates, entanglement -------------------------------------------------------


def test_controlled_x_is_cnot_truth_table():
    for control_val, target_val in [(0, 0), (0, 1), (1, 0), (1, 1)]:
        initial = (control_val << 1) | target_val
        reg = QuantumRegister(2, initial)
        reg.apply_controlled_gate(X, control=0, target=1)
        expected_target = target_val ^ control_val
        expected = (control_val << 1) | expected_target
        result_index = int(np.argmax(np.abs(reg.state)))
        assert result_index == expected


def test_controlled_gate_with_target_index_less_than_control():
    # exercises the sub_target_axis shift branch (target < control). Convention: qubit 0
    # is the MSB, so 0b01 means qubit0=0 (target), qubit1=1 (control).
    reg = QuantumRegister(2, 0b01)
    reg.apply_controlled_gate(X, control=1, target=0)
    assert np.allclose(reg.state, QuantumRegister(2, 0b11).state)


def test_controlled_gate_rejects_same_control_and_target():
    reg = QuantumRegister(2, 0)
    with pytest.raises(ValueError):
        reg.apply_controlled_gate(X, control=0, target=0)


def test_bell_state_entanglement():
    reg = QuantumRegister(2, 0)
    reg.apply_gate(H, 0)
    reg.apply_controlled_gate(X, control=0, target=1)
    expected = np.array([SQRT2_INV, 0, 0, SQRT2_INV])
    assert np.allclose(reg.state, expected)
    assert reg.is_normalized()


def test_ghz_state_three_qubits():
    reg = QuantumRegister(3, 0)
    reg.apply_gate(H, 0)
    reg.apply_controlled_gate(X, control=0, target=1)
    reg.apply_controlled_gate(X, control=0, target=2)
    expected = np.zeros(8, dtype=complex)
    expected[0b000] = SQRT2_INV
    expected[0b111] = SQRT2_INV
    assert np.allclose(reg.state, expected)


# --- swap, marginals, measurement ---------------------------------------------------------


def test_swap_qubits():
    reg = QuantumRegister(2, 0b01)  # qubit0=0, qubit1=1
    reg.apply_swap(0, 1)
    assert np.allclose(reg.state, QuantumRegister(2, 0b10).state)


def test_marginal_probabilities_independent_qubit():
    reg = QuantumRegister(2, 0)
    reg.apply_gate(H, 0)  # qubit0 in superposition, qubit1 untouched
    marginal = reg.marginal_probabilities([0])
    assert np.allclose(marginal, [0.5, 0.5])


def test_marginal_probabilities_preserves_correlation_in_ghz():
    reg = QuantumRegister(3, 0)
    reg.apply_gate(H, 0)
    reg.apply_controlled_gate(X, control=0, target=1)
    reg.apply_controlled_gate(X, control=0, target=2)
    # qubit 1 marginalized out; qubits 0 and 2 should still show perfect correlation
    marginal = reg.marginal_probabilities([0, 2])
    assert np.allclose(marginal, [0.5, 0, 0, 0.5])


def test_measure_on_deterministic_state_always_returns_that_state():
    rng = np.random.default_rng(0)
    reg = QuantumRegister(3, 5)
    assert reg.measure(rng) == 5


def test_measure_on_bell_state_only_ever_returns_00_or_11():
    rng = np.random.default_rng(1)
    outcomes = set()
    for _ in range(200):
        reg = QuantumRegister(2, 0)
        reg.apply_gate(H, 0)
        reg.apply_controlled_gate(X, control=0, target=1)
        outcomes.add(reg.measure(rng))
    assert outcomes == {0b00, 0b11}


def test_normalization_preserved_after_random_gate_sequence():
    rng = np.random.default_rng(42)
    reg = QuantumRegister(4, 0)
    gates = [H, X, Y, Z]
    for _ in range(50):
        gate = gates[rng.integers(0, len(gates))]
        qubit = int(rng.integers(0, 4))
        reg.apply_gate(gate, qubit)
    assert reg.is_normalized()


# --- QFT correctness, verified against the exact DFT matrix (ground truth) ---------------


@pytest.mark.parametrize("n_qubits", [1, 2, 3, 4, 5, 6])
def test_qft_matches_dft_matrix_on_random_states(n_qubits):
    rng = np.random.default_rng(123 + n_qubits)
    initial = _random_state(n_qubits, rng)
    reg = QuantumRegister.from_statevector(initial)
    apply_qft(reg, list(range(n_qubits)))
    expected = dft_matrix(n_qubits) @ initial
    assert np.allclose(reg.state, expected, atol=1e-8)


@pytest.mark.parametrize("n_qubits", [1, 2, 3, 4, 5])
def test_qft_matches_dft_matrix_on_every_basis_state(n_qubits):
    dim = 2**n_qubits
    matrix = dft_matrix(n_qubits)
    for x in range(dim):
        reg = QuantumRegister(n_qubits, x)
        apply_qft(reg, list(range(n_qubits)))
        assert np.allclose(reg.state, matrix[:, x], atol=1e-8)


@pytest.mark.parametrize("n_qubits", [1, 2, 3, 4, 5, 6])
def test_inverse_qft_undoes_qft(n_qubits):
    rng = np.random.default_rng(999 + n_qubits)
    initial = _random_state(n_qubits, rng)
    reg = QuantumRegister.from_statevector(initial)
    qubits = list(range(n_qubits))
    apply_qft(reg, qubits)
    apply_inverse_qft(reg, qubits)
    assert np.allclose(reg.state, initial, atol=1e-8)


def test_qft_is_unitary_norm_preserving():
    rng = np.random.default_rng(7)
    for n_qubits in [1, 2, 3, 4, 5]:
        initial = _random_state(n_qubits, rng)
        reg = QuantumRegister.from_statevector(initial)
        apply_qft(reg, list(range(n_qubits)))
        assert reg.is_normalized()


def test_qft_on_subset_of_a_larger_register_leaves_spectator_qubits_alone():
    # 5-qubit register: qubit 0 and 4 are spectators, QFT applied only to qubits [1,2,3]
    n_sub = 3
    reg = QuantumRegister(5, 0)
    reg.apply_gate(X, 0)  # spectator qubit0 = 1
    reg.apply_gate(X, 4)  # spectator qubit4 = 1
    # set the middle 3 qubits to |5> (binary 101) by flipping qubit1 and qubit3
    reg.apply_gate(X, 1)
    reg.apply_gate(X, 3)

    apply_qft(reg, [1, 2, 3])

    # spectators should be unaffected: marginal on qubit0 and qubit4 stays deterministic
    assert np.allclose(reg.marginal_probabilities([0]), [0, 1])
    assert np.allclose(reg.marginal_probabilities([4]), [0, 1])

    middle_marginal_state_via_matrix = dft_matrix(n_sub) @ QuantumRegister(n_sub, 0b101).state
    # reconstruct the middle-register reduced statevector directly (not just probabilities),
    # valid here because qubits 0/4 are unentangled product-state spectators
    full = reg.state.reshape(2, 2, 2, 2, 2)
    middle = full[1, :, :, :, 1].reshape(-1)
    assert np.allclose(middle, middle_marginal_state_via_matrix, atol=1e-8)
