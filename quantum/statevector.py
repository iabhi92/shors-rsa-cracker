"""A from-scratch quantum statevector simulator: registers, standard gates, measurement.

No Qiskit/Cirq here — this is the actual linear algebra. A register of n qubits is a
length-2^n complex vector; gates are unitary matrices applied via tensor contraction on
a reshaped [2]*n view of that vector (avoids ever materializing a 2^n x 2^n matrix).

Qubit-index convention: qubit 0 is the most significant bit of the register's integer
value. A register in computational basis state |x> for integer x has all its amplitude at
index x, i.e. reading qubits 0..n-1 left to right gives x's binary digits MSB-first. This
is the convention used everywhere else in quantum/ (modexp.py, shor.py).
"""

from typing import Any, Protocol, runtime_checkable

import numpy as np

I2 = np.eye(2, dtype=complex)
H = (1 / np.sqrt(2)) * np.array([[1, 1], [1, -1]], dtype=complex)
X = np.array([[0, 1], [1, 0]], dtype=complex)
Y = np.array([[0, -1j], [1j, 0]], dtype=complex)
Z = np.array([[1, 0], [0, -1]], dtype=complex)


def phase(theta: float) -> np.ndarray:
    """R(theta) = diag(1, e^{i theta}) — a single-qubit relative-phase gate."""
    return np.array([[1, 0], [0, np.exp(1j * theta)]], dtype=complex)


@runtime_checkable
class GateSink(Protocol):
    """The structural interface every gate-emitting function in quantum/ actually needs:
    apply a handful of gate shapes to qubit indices, and know how many qubits there are.
    QuantumRegister satisfies this by construction (no inheritance declared — Protocol
    matching is structural). quantum/resource_estimate.py's CountingRegister is the other
    implementation: same interface, but it counts gate emissions instead of simulating
    amplitudes, so it never allocates a 2^n_qubits state array — which is what lets
    quantum/adder.py, quantum/qft.py, and quantum/modexp_circuit.py's *real, unmodified*
    circuit-emission code run unchanged against qubit counts far too large to honestly
    simulate (thousands of qubits, for real RSA key sizes), producing exact resource counts
    for that real logic rather than a hand-derived formula trusted separately."""

    n_qubits: int

    def apply_gate(self, gate: np.ndarray, qubit: int) -> None: ...
    def apply_controlled_gate(self, gate: np.ndarray, control: int, target: int) -> None: ...
    def apply_multi_controlled_gate(self, gate: np.ndarray, controls: list[int], target: int) -> None: ...
    def apply_swap(self, qubit_a: int, qubit_b: int) -> None: ...
    def apply_controlled_swap(self, control: int, qubit_a: int, qubit_b: int) -> None: ...


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

    def _check_index(self, qubit: int, name: str = "qubit") -> None:
        # Plain Python list/array indexing accepts negative indices as "count from the end"
        # rather than rejecting them, so a caller-side off-by-one that goes negative would
        # otherwise silently apply a gate to the wrong qubit instead of raising — the worst
        # kind of bug (silently wrong, not crashing) for a correctness-focused simulator.
        if not (0 <= qubit < self.n_qubits):
            raise ValueError(f"{name}={qubit} out of range for a {self.n_qubits}-qubit register")

    def apply_gate(self, gate: np.ndarray, qubit: int) -> None:
        """Apply a 2x2 unitary to a single qubit, leaving all others untouched."""
        self._check_index(qubit)
        tensor = self.state.reshape([2] * self.n_qubits)
        tensor = np.tensordot(gate, tensor, axes=([1], [qubit]))
        tensor = np.moveaxis(tensor, 0, qubit)
        self.state = np.ascontiguousarray(tensor).reshape(-1)

    def apply_controlled_gate(self, gate: np.ndarray, control: int, target: int) -> None:
        """Apply a 2x2 unitary to `target`, only on the subspace where `control` is |1>."""
        self._check_index(control, "control")
        self._check_index(target, "target")
        if control == target:
            raise ValueError("control and target must differ")
        tensor = self.state.reshape([2] * self.n_qubits)
        idx: list[Any] = [slice(None)] * self.n_qubits
        idx[control] = 1
        idx_t = tuple(idx)
        sub = tensor[idx_t]  # shape [2] * (n_qubits - 1); `control` axis is gone
        sub_target_axis = target if target < control else target - 1
        sub = np.tensordot(gate, sub, axes=([1], [sub_target_axis]))
        sub = np.moveaxis(sub, 0, sub_target_axis)
        tensor[idx_t] = sub
        self.state = np.ascontiguousarray(tensor).reshape(-1)

    def apply_multi_controlled_gate(self, gate: np.ndarray, controls: list[int], target: int) -> None:
        """Apply a 2x2 unitary to `target`, only on the subspace where every qubit in
        `controls` is |1>. `apply_controlled_gate` is the controls=[c] special case."""
        self._check_index(target, "target")
        for c in controls:
            self._check_index(c, "control")
        if target in controls:
            raise ValueError("target must not also be a control")
        if len(set(controls)) != len(controls):
            raise ValueError("controls must be distinct")
        tensor = self.state.reshape([2] * self.n_qubits)
        idx: list[Any] = [slice(None)] * self.n_qubits
        for c in controls:
            idx[c] = 1
        idx_t = tuple(idx)
        sub = tensor[idx_t]  # shape [2] * (n_qubits - len(controls)); control axes gone
        removed_before_target = sum(1 for c in controls if c < target)
        sub_target_axis = target - removed_before_target
        sub = np.tensordot(gate, sub, axes=([1], [sub_target_axis]))
        sub = np.moveaxis(sub, 0, sub_target_axis)
        tensor[idx_t] = sub
        self.state = np.ascontiguousarray(tensor).reshape(-1)

    def apply_swap(self, qubit_a: int, qubit_b: int) -> None:
        self._check_index(qubit_a, "qubit_a")
        self._check_index(qubit_b, "qubit_b")
        if qubit_a == qubit_b:
            return
        tensor = self.state.reshape([2] * self.n_qubits)
        tensor = np.swapaxes(tensor, qubit_a, qubit_b)
        self.state = np.ascontiguousarray(tensor).reshape(-1)

    def apply_controlled_swap(self, control: int, qubit_a: int, qubit_b: int) -> None:
        """Swap qubit_a and qubit_b, only on the subspace where `control` is |1>."""
        self._check_index(control, "control")
        self._check_index(qubit_a, "qubit_a")
        self._check_index(qubit_b, "qubit_b")
        if len({control, qubit_a, qubit_b}) != 3:
            raise ValueError("control, qubit_a, qubit_b must be distinct")
        if qubit_a == qubit_b:
            return
        tensor = self.state.reshape([2] * self.n_qubits)
        idx: list[Any] = [slice(None)] * self.n_qubits
        idx[control] = 1
        idx_t = tuple(idx)
        sub = tensor[idx_t]
        sub_a = qubit_a - (1 if qubit_a > control else 0)
        sub_b = qubit_b - (1 if qubit_b > control else 0)
        sub = np.swapaxes(sub, sub_a, sub_b)
        tensor[idx_t] = sub
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
