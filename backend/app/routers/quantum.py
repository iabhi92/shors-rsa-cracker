"""Quantum fundamentals + QFT demo endpoints -- both call quantum/statevector.py and
quantum/qft.py directly; nothing here is a hardcoded/precomputed result."""

import numpy as np
from fastapi import APIRouter

from backend.app.errors import AppError
from backend.app.schemas.quantum import (
    Amplitude,
    BellStateResponse,
    GateDemoRequest,
    QftDemoRequest,
    QftDemoResponse,
    StatevectorResponse,
)
from quantum.qft import apply_inverse_qft, apply_qft, dft_matrix
from quantum.statevector import H, QuantumRegister, X, Y, Z

router = APIRouter()

_GATES = {"X": X, "H": H, "Y": Y, "Z": Z}


def _amplitudes(reg: QuantumRegister) -> list[Amplitude]:
    probs = reg.probabilities()
    out = []
    for i, amp in enumerate(reg.state):
        basis = format(i, f"0{reg.n_qubits}b")
        out.append(Amplitude(basis_state=basis, real=float(amp.real), imag=float(amp.imag), probability=float(probs[i])))
    return out


@router.post("/gate-demo", response_model=StatevectorResponse)
def gate_demo(req: GateDemoRequest) -> StatevectorResponse:
    if req.qubit >= req.n_qubits:
        raise AppError(f"qubit index {req.qubit} out of range for a {req.n_qubits}-qubit register")
    if req.initial_value >= 2**req.n_qubits:
        raise AppError(f"initial_value {req.initial_value} out of range for {req.n_qubits} qubits")
    reg = QuantumRegister(req.n_qubits, initial_value=req.initial_value)
    reg.apply_gate(_GATES[req.gate], req.qubit)
    return StatevectorResponse(n_qubits=req.n_qubits, amplitudes=_amplitudes(reg))


@router.post("/bell-state", response_model=BellStateResponse)
def bell_state() -> BellStateResponse:
    reg = QuantumRegister(2, initial_value=0)
    reg.apply_gate(H, 0)
    reg.apply_controlled_gate(X, control=0, target=1)
    return BellStateResponse(amplitudes=_amplitudes(reg))


@router.post("/qft-demo", response_model=QftDemoResponse)
def qft_demo(req: QftDemoRequest) -> QftDemoResponse:
    if req.initial_value >= 2**req.n_qubits:
        raise AppError(f"initial_value {req.initial_value} out of range for {req.n_qubits} qubits")
    reg = QuantumRegister(req.n_qubits, initial_value=req.initial_value)
    before = _amplitudes(reg)

    qubits = list(range(req.n_qubits))
    if req.inverse:
        apply_inverse_qft(reg, qubits)
    else:
        apply_qft(reg, qubits)
    after = _amplitudes(reg)

    # Cross-check against the exact DFT matrix (ground truth) -- same validation method
    # notes/02-qft-and-period-finding.md documents for the underlying circuit.
    dft = dft_matrix(req.n_qubits)
    basis = np.zeros(2**req.n_qubits, dtype=complex)
    basis[req.initial_value] = 1.0
    expected = dft.conj().T @ basis if req.inverse else dft @ basis
    max_error = float(np.max(np.abs(reg.state - expected)))

    return QftDemoResponse(
        n_qubits=req.n_qubits,
        before=before,
        after=after,
        matches_exact_dft_matrix=max_error < 1e-9,
        max_amplitude_error_vs_dft_matrix=max_error,
    )
