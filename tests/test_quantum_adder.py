import numpy as np
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from quantum.adder import apply_fourier_add_constant, apply_fourier_subtract_constant
from quantum.qft import apply_inverse_qft, apply_qft
from quantum.statevector import QuantumRegister

# --- unconditional add, checked against plain classical addition (ground truth) -----------


@pytest.mark.parametrize("n_qubits", [1, 2, 3, 4, 5, 6])
def test_fourier_add_constant_matches_classical_addition_for_every_x(n_qubits):
    rng = np.random.default_rng(20)
    dim = 2**n_qubits
    for x in range(dim):
        a = int(rng.integers(0, dim))
        reg = QuantumRegister(n_qubits, initial_value=x)
        qubits = list(range(n_qubits))
        apply_qft(reg, qubits)
        apply_fourier_add_constant(reg, qubits, a)
        apply_inverse_qft(reg, qubits)
        expected = (x + a) % dim
        assert abs(reg.state[expected] - 1.0) < 1e-8


@settings(max_examples=100, deadline=None)
@given(n_qubits=st.integers(min_value=1, max_value=10), data=st.data())
def test_fourier_add_constant_property_matches_classical_addition(n_qubits, data):
    # Complements the exhaustive-x test above (capped at n_qubits<=6, every x) by sampling
    # instead of exhausting — reaches register sizes the exhaustive loop doesn't cover.
    dim = 2**n_qubits
    x = data.draw(st.integers(min_value=0, max_value=dim - 1))
    a = data.draw(st.integers(min_value=0, max_value=dim - 1))
    qubits = list(range(n_qubits))
    reg = QuantumRegister(n_qubits, initial_value=x)
    apply_qft(reg, qubits)
    apply_fourier_add_constant(reg, qubits, a)
    apply_inverse_qft(reg, qubits)
    expected = (x + a) % dim
    assert abs(reg.state[expected] - 1.0) < 1e-7


def test_fourier_subtract_constant_undoes_fourier_add_constant():
    rng = np.random.default_rng(21)
    n_qubits = 5
    dim = 2**n_qubits
    qubits = list(range(n_qubits))
    for _ in range(30):
        x = int(rng.integers(0, dim))
        a = int(rng.integers(0, dim))
        reg = QuantumRegister(n_qubits, initial_value=x)
        apply_qft(reg, qubits)
        apply_fourier_add_constant(reg, qubits, a)
        apply_fourier_subtract_constant(reg, qubits, a)
        apply_inverse_qft(reg, qubits)
        assert abs(reg.state[x] - 1.0) < 1e-8


# --- controlled add: control=0 must be identity, control=1 must add -----------------------


def test_controlled_fourier_add_is_a_no_op_when_control_is_zero():
    n_qubits = 4
    qubits = [1, 2, 3, 4]
    reg = QuantumRegister(1 + n_qubits, initial_value=(0 << n_qubits) | 3)
    apply_qft(reg, qubits)
    apply_fourier_add_constant(reg, qubits, 5, controls=[0])
    apply_inverse_qft(reg, qubits)
    assert abs(reg.state[(0 << n_qubits) | 3] - 1.0) < 1e-8


def test_controlled_fourier_add_adds_when_control_is_one():
    n_qubits = 4
    qubits = [1, 2, 3, 4]
    reg = QuantumRegister(1 + n_qubits, initial_value=(1 << n_qubits) | 3)
    apply_qft(reg, qubits)
    apply_fourier_add_constant(reg, qubits, 5, controls=[0])
    apply_inverse_qft(reg, qubits)
    assert abs(reg.state[(1 << n_qubits) | 8] - 1.0) < 1e-8
