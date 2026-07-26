"""A from-scratch quantum statevector simulator: registers, standard gates, measurement.

No Qiskit/Cirq here — this is the actual linear algebra. A register of n qubits is a
length-2^n complex vector; gates are unitary matrices applied via tensor contraction on
a reshaped [2]*n view of that vector (avoids ever materializing a 2^n x 2^n matrix).

Qubit-index convention: qubit 0 is the most significant bit of the register's integer
value. A register in computational basis state |x> for integer x has all its amplitude at
index x, i.e. reading qubits 0..n-1 left to right gives x's binary digits MSB-first. This
is the convention used everywhere else in quantum/ (modexp.py, shor.py).
"""

import numpy as np

I2 = np.eye(2, dtype=complex)
H = (1 / np.sqrt(2)) * np.array([[1, 1], [1, -1]], dtype=complex)
X = np.array([[0, 1], [1, 0]], dtype=complex)
Y = np.array([[0, -1j], [1j, 0]], dtype=complex)
Z = np.array([[1, 0], [0, -1]], dtype=complex)


def phase(theta: float) -> np.ndarray:
    """R(theta) = diag(1, e^{i theta}) — a single-qubit relative-phase gate."""
    return np.array([[1, 0], [0, np.exp(1j * theta)]], dtype=complex)


class QuantumRegister:
    def __init__(self, n_qubits: int, initial_value: int = 0):
        if n_qubits < 1:
            raise ValueError("n_qubits must be >= 1")
        if not (0 <= initial_value < 2**n_qubits):
            raise ValueError("initial_value out of range for n_qubits")
        self.n_qubits = n_qubits
        self.state = np.zeros(2**n_qubits, dtype=complex)
        self.state[initial_value] = 1.0

    @property
    def dim(self) -> int:
        return 2**self.n_qubits

    @classmethod
    def from_statevector(cls, state: np.ndarray) -> "QuantumRegister":
        n_qubits = int(round(np.log2(len(state))))
        if 2**n_qubits != len(state):
            raise ValueError("state length must be a power of two")
        reg = cls(n_qubits)
        reg.state = np.array(state, dtype=complex)
        return reg

    def probabilities(self) -> np.ndarray:
        return np.abs(self.state) ** 2

    def apply_gate(self, gate: np.ndarray, qubit: int) -> None:
        """Apply a 2x2 unitary to a single qubit, leaving all others untouched."""
        tensor = self.state.reshape([2] * self.n_qubits)
        tensor = np.tensordot(gate, tensor, axes=([1], [qubit]))
        tensor = np.moveaxis(tensor, 0, qubit)
        self.state = np.ascontiguousarray(tensor).reshape(-1)

    def apply_controlled_gate(self, gate: np.ndarray, control: int, target: int) -> None:
        """Apply a 2x2 unitary to `target`, only on the subspace where `control` is |1>."""
        if control == target:
            raise ValueError("control and target must differ")
        tensor = self.state.reshape([2] * self.n_qubits)
        idx = [slice(None)] * self.n_qubits
        idx[control] = 1
        idx = tuple(idx)
        sub = tensor[idx]  # shape [2] * (n_qubits - 1); `control` axis is gone
        sub_target_axis = target if target < control else target - 1
        sub = np.tensordot(gate, sub, axes=([1], [sub_target_axis]))
        sub = np.moveaxis(sub, 0, sub_target_axis)
        tensor[idx] = sub
        self.state = np.ascontiguousarray(tensor).reshape(-1)

    def apply_swap(self, qubit_a: int, qubit_b: int) -> None:
        if qubit_a == qubit_b:
            return
        tensor = self.state.reshape([2] * self.n_qubits)
        tensor = np.swapaxes(tensor, qubit_a, qubit_b)
        self.state = np.ascontiguousarray(tensor).reshape(-1)

    def marginal_probabilities(self, qubits: list[int]) -> np.ndarray:
        """Probability distribution over just `qubits` (order preserved), summing out the rest."""
        tensor = self.probabilities().reshape([2] * self.n_qubits)
        axes_to_sum = tuple(q for q in range(self.n_qubits) if q not in qubits)
        marginal = tensor.sum(axis=axes_to_sum)
        remaining_ascending = [q for q in range(self.n_qubits) if q in qubits]
        order = [remaining_ascending.index(q) for q in qubits]
        marginal = np.transpose(marginal, axes=order)
        return np.ascontiguousarray(marginal).reshape(-1)

    def measure(self, rng: np.random.Generator) -> int:
        """Collapse the whole register onto a basis state, weighted by |amplitude|^2."""
        probs = self.probabilities()
        probs = probs / probs.sum()  # renormalize away tiny float drift
        outcome = int(rng.choice(self.dim, p=probs))
        self.state = np.zeros(self.dim, dtype=complex)
        self.state[outcome] = 1.0
        return outcome

    def is_normalized(self, atol: float = 1e-9) -> bool:
        return bool(np.isclose(np.sum(self.probabilities()), 1.0, atol=atol))
