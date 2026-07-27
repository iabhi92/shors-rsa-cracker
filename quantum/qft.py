"""The Quantum Fourier Transform, built from H + controlled-phase gates on a QuantumRegister.

Definition (ground truth, used only to test the circuit below against, never to implement
it — the whole point is that the circuit reproduces this from elementary gates):

    QFT|x> = (1/sqrt(2^n)) * sum_{y=0}^{2^n - 1} exp(2*pi*i * x * y / 2^n) |y>

applied to the `qubits` given (in the order given — qubits[0] is the most-significant bit
of the sub-register being transformed).
"""

import numpy as np

from quantum.statevector import GateSink, H, phase


def dft_matrix(n_qubits: int) -> np.ndarray:
    """The exact 2^n x 2^n QFT unitary, built directly from its definition. Ground truth
    for testing the gate-based circuit below — not used anywhere in the actual simulation."""
    dim = 2**n_qubits
    indices = np.arange(dim)
    exponent = np.outer(indices, indices)  # exponent[y, x] = x * y
    return np.exp(2j * np.pi * exponent / dim) / np.sqrt(dim)


def apply_qft(register: GateSink, qubits: list[int]) -> None:
    """Apply the QFT circuit to `qubits` (qubits[0] most significant) in place."""
    n = len(qubits)
    for i in range(n):
        target = qubits[i]
        register.apply_gate(H, target)
        for j in range(i + 1, n):
            control = qubits[j]
            k = j - i + 1  # rotation R_k = diag(1, e^{2*pi*i / 2^k})
            register.apply_controlled_gate(phase(2 * np.pi / 2**k), control, target)
    for i in range(n // 2):
        register.apply_swap(qubits[i], qubits[n - 1 - i])


def apply_inverse_qft(register: GateSink, qubits: list[int]) -> None:
    """Apply the inverse QFT: the exact gate-reversal of apply_qft (reverse order,
    negated phase angles, self-inverse H and SWAP)."""
    n = len(qubits)
    for i in range(n // 2):
        register.apply_swap(qubits[i], qubits[n - 1 - i])
    for i in reversed(range(n)):
        target = qubits[i]
        for j in reversed(range(i + 1, n)):
            control = qubits[j]
            k = j - i + 1
            register.apply_controlled_gate(phase(-2 * np.pi / 2**k), control, target)
        register.apply_gate(H, target)
