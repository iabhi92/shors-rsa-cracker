import numpy as np
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from quantum.modexp import apply_modular_exponentiation
from quantum.modexp_circuit import (
    ancilla_qubit_count,
    apply_controlled_multiply_mod_N,
    apply_modular_add_constant,
    apply_modular_exponentiation_circuit,
    apply_modular_subtract_constant,
)
from quantum.statevector import H, QuantumRegister

# --- apply_modular_add_constant: brute-force against every valid (N, a, b) ----------------


@pytest.mark.parametrize("N", range(2, 20))
def test_modular_add_constant_matches_classical_modular_addition(N):
    n_b = N.bit_length() + 1
    for a in range(N):
        for b in range(N):
            reg = QuantumRegister(n_b + 1, initial_value=(b << 1))
            apply_modular_add_constant(reg, list(range(n_b)), n_b, a, N)
            expected_idx = ((b + a) % N) << 1
            assert abs(reg.state[expected_idx] - 1.0) < 1e-7


@pytest.mark.parametrize("N", [3, 5, 7, 9, 11, 13, 15])
def test_controlled_modular_add_is_a_no_op_when_control_is_zero(N):
    n_b = N.bit_length() + 1
    for a in range(N):
        for b in range(N):
            total = 1 + n_b + 1
            reg = QuantumRegister(total, initial_value=(b << 1))
            apply_modular_add_constant(reg, list(range(1, 1 + n_b)), total - 1, a, N, controls=[0])
            assert abs(reg.state[b << 1] - 1.0) < 1e-7


@settings(max_examples=100, deadline=None)
@given(data=st.data())
def test_modular_add_constant_property_matches_classical_addition(data):
    # Complements the exhaustive N<20 test above by sampling N up to 60 instead of exhausting
    # every (N, a, b) triple — reaches moduli the exhaustive loop doesn't cover, at the cost
    # of not covering every value for a given N.
    N = data.draw(st.integers(min_value=2, max_value=60))
    a = data.draw(st.integers(min_value=0, max_value=N - 1))
    b = data.draw(st.integers(min_value=0, max_value=N - 1))
    n_b = N.bit_length() + 1
    reg = QuantumRegister(n_b + 1, initial_value=(b << 1))
    apply_modular_add_constant(reg, list(range(n_b)), n_b, a, N)
    expected_idx = ((b + a) % N) << 1
    assert abs(reg.state[expected_idx] - 1.0) < 1e-7


def test_modular_subtract_constant_is_the_exact_adjoint_of_add():
    rng = np.random.default_rng(30)
    for N in range(2, 16):
        n_b = N.bit_length() + 1
        for _ in range(15):
            b0 = int(rng.integers(0, N))
            a = int(rng.integers(0, N))
            reg = QuantumRegister(n_b + 1, initial_value=(b0 << 1))
            apply_modular_add_constant(reg, list(range(n_b)), n_b, a, N)
            apply_modular_subtract_constant(reg, list(range(n_b)), n_b, a, N)
            assert abs(reg.state[b0 << 1] - 1.0) < 1e-7


# --- apply_controlled_multiply_mod_N: brute-force against classical (a*x) mod N -----------


@pytest.mark.parametrize("N", [3, 5, 7, 9, 11, 13, 15])
def test_controlled_multiply_mod_n_matches_classical_multiplication(N):
    n = N.bit_length()
    n_b = n + 1
    for a in range(2, N):
        if np.gcd(a, N) != 1:
            continue
        for x in range(N):
            for control in (0, 1):
                total = 1 + n + n_b + 1
                x_qubits = list(range(1, 1 + n))
                b_qubits = list(range(1 + n, 1 + n + n_b))
                flag_qubit = total - 1
                reg = QuantumRegister(total, initial_value=(control << (n + n_b + 1)) | (x << (n_b + 1)))
                apply_controlled_multiply_mod_N(reg, 0, x_qubits, b_qubits, flag_qubit, a, N)

                expected_x = (a * x) % N if control == 1 else x
                expected_idx = (control << (n + n_b + 1)) | (expected_x << (n_b + 1))
                assert abs(reg.state[expected_idx] - 1.0) < 1e-6
                # ancilla (b register + flag) must be exactly restored to |0>
                assert np.sum(np.abs(reg.state) ** 2) - abs(reg.state[expected_idx]) ** 2 < 1e-10


# --- the full circuit: cross-validated statevector-exact against modexp.py's permutation --


def _compare_against_permutation_ground_truth(N: int, a: int, n_count: int) -> tuple[bool, float]:
    n_target = N.bit_length()
    n_ancilla = ancilla_qubit_count(n_target)

    ref = QuantumRegister(n_count + n_target, initial_value=1)
    for q in range(n_count):
        ref.apply_gate(H, q)
    apply_modular_exponentiation(ref, n_count, n_target, a, N)

    total = n_count + n_target + n_ancilla
    gate = QuantumRegister(total, initial_value=1 << n_ancilla)
    for q in range(n_count):
        gate.apply_gate(H, q)
    apply_modular_exponentiation_circuit(gate, n_count, n_target, a, N)

    tensor = gate.state.reshape([2] * total)
    idx = tuple([slice(None)] * (n_count + n_target) + [0] * n_ancilla)
    projected = np.ascontiguousarray(tensor[idx]).reshape(-1)
    leaked_probability = 1 - float(np.sum(np.abs(projected) ** 2))
    return bool(np.allclose(projected, ref.state, atol=1e-7)), leaked_probability


@pytest.mark.parametrize(
    "N,a,n_count",
    [
        (15, 2, 4),
        (15, 7, 4),
        (15, 11, 3),
        (9, 2, 4),
        (9, 5, 3),
        (21, 2, 5),
        (7, 3, 3),
        (5, 2, 3),
    ],
)
def test_gate_level_modexp_matches_permutation_shortcut_statevector_exact(N, a, n_count):
    # This is the load-bearing cross-validation: quantum/modexp.py documents computing U_a
    # directly as the permutation it mathematically is, as an explicit scope boundary
    # against building the reversible-arithmetic circuit gate by gate. This test proves that
    # boundary can be crossed and the two agree to floating-point precision — both on the
    # control+target subspace (the physically meaningful result) *and* that the ancilla this
    # circuit needed to get there comes back out exactly |0> (no leaked entanglement, which
    # would otherwise silently break the interference the rest of Shor's algorithm relies on).
    matches, leaked_probability = _compare_against_permutation_ground_truth(N, a, n_count)
    assert matches
    assert leaked_probability < 1e-8


def test_gate_level_modexp_rejects_wrong_ancilla_sized_register():
    N, n_count = 15, 4
    n_target = N.bit_length()
    reg = QuantumRegister(n_count + n_target, initial_value=1)  # missing ancilla
    with pytest.raises(ValueError):
        apply_modular_exponentiation_circuit(reg, n_count, n_target, 2, N)


# --- input validation on apply_controlled_multiply_mod_N -----------------------------------


def test_controlled_multiply_rejects_mismatched_b_qubits_length():
    N = 15
    n = N.bit_length()
    total = 1 + n + (n + 1) + 1
    reg = QuantumRegister(total, initial_value=1 << (n + 2))
    x_qubits = list(range(1, 1 + n))
    b_qubits_too_short = list(range(1 + n, 1 + n + n))  # missing the +1 overflow qubit
    with pytest.raises(ValueError):
        apply_controlled_multiply_mod_N(reg, 0, x_qubits, b_qubits_too_short, total - 1, 2, N)


def test_controlled_multiply_rejects_overlapping_qubits():
    N = 15
    n = N.bit_length()
    total = 1 + n + (n + 1) + 1
    reg = QuantumRegister(total, initial_value=1 << (n + 2))
    x_qubits = list(range(1, 1 + n))
    b_qubits = list(range(1 + n, 1 + n + n + 1))
    flag_qubit = total - 1
    # control collides with the first x qubit
    with pytest.raises(ValueError):
        apply_controlled_multiply_mod_N(reg, x_qubits[0], x_qubits, b_qubits, flag_qubit, 2, N)
