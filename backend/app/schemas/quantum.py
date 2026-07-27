from typing import Literal

from pydantic import BaseModel, Field

from backend.app.limits import QFT_DEMO_MAX_QUBITS, STATEVECTOR_DEMO_MAX_QUBITS

GateName = Literal["X", "H", "Y", "Z"]


class Amplitude(BaseModel):
    basis_state: str  # e.g. "010", MSB-first (this project's convention throughout)
    real: float
    imag: float
    probability: float


class GateDemoRequest(BaseModel):
    n_qubits: int = Field(default=1, ge=1, le=STATEVECTOR_DEMO_MAX_QUBITS)
    qubit: int = Field(default=0, ge=0)
    gate: GateName
    initial_value: int = Field(default=0, ge=0)


class StatevectorResponse(BaseModel):
    n_qubits: int
    amplitudes: list[Amplitude]


class BellStateResponse(BaseModel):
    amplitudes: list[Amplitude]
    explanation: str = (
        "H on qubit 0 creates superposition, then CNOT(control=0, target=1) entangles it with "
        "qubit 1 -- the two qubits are now correlated: measuring one instantly determines the "
        "other, even though neither has a definite value on its own."
    )


class QftDemoRequest(BaseModel):
    n_qubits: int = Field(default=3, ge=1, le=QFT_DEMO_MAX_QUBITS)
    initial_value: int = Field(default=1, ge=0)
    inverse: bool = False


class QftDemoResponse(BaseModel):
    n_qubits: int
    before: list[Amplitude]
    after: list[Amplitude]
    matches_exact_dft_matrix: bool
    max_amplitude_error_vs_dft_matrix: float
