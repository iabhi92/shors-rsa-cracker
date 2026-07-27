from pydantic import BaseModel, Field

from backend.app.limits import SHOR_ALLOWED_N


class CircuitMetadataRequest(BaseModel):
    n: int = Field(..., description=f"Must be one of {SHOR_ALLOWED_N}")
    n_count: int | None = Field(default=None, ge=1, le=12)


class CircuitMetadataResponse(BaseModel):
    n: int
    n_count: int
    n_target: int
    n_ancilla: int
    total_qubits: int
    single_qubit_gates: int
    controlled_gates: int
    doubly_controlled_gates: int
    swaps: int
    controlled_swaps: int
    toffoli_equivalent_gates: int
    total_gate_emissions: int
    measured_not_estimated: bool = True
