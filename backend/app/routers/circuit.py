"""Circuit Explorer -- real, measured gate/qubit counts for the gate-level circuit
(quantum/modexp_circuit.py) at demo-sized N, via quantum/resource_estimate.py's
CountingRegister (which runs the actual unmodified circuit-emission code; see that module's
docstring). Distinct from the Resource Estimation page, which uses the closed-form
extrapolation to reach real RSA bit sizes -- here N is small enough to just measure directly."""

from fastapi import APIRouter

from backend.app.errors import AppError
from backend.app.limits import SHOR_ALLOWED_N
from backend.app.schemas.circuit import CircuitMetadataRequest, CircuitMetadataResponse
from quantum.resource_estimate import GateCounts, count_gates_for_modular_exponentiation
from quantum.shor import default_n_count

router = APIRouter()


@router.post("/metadata", response_model=CircuitMetadataResponse)
def metadata(req: CircuitMetadataRequest) -> CircuitMetadataResponse:
    if req.n not in SHOR_ALLOWED_N:
        raise AppError(f"N={req.n} is not in the supported demo set {SHOR_ALLOWED_N}")
    n_count = req.n_count or default_n_count(req.n)

    reg = count_gates_for_modular_exponentiation(req.n, n_count=n_count)
    counts = GateCounts.from_counting_register(reg)
    n_target = req.n.bit_length()

    return CircuitMetadataResponse(
        n=req.n,
        n_count=n_count,
        n_target=n_target,
        n_ancilla=reg.n_qubits - n_count - n_target,
        total_qubits=reg.n_qubits,
        single_qubit_gates=counts.single_qubit_gates,
        controlled_gates=counts.controlled_gates,
        doubly_controlled_gates=counts.multi_controlled_gates.get(2, 0),
        swaps=counts.swaps,
        controlled_swaps=counts.controlled_swaps,
        toffoli_equivalent_gates=counts.toffoli_equivalent_count(),
        total_gate_emissions=counts.total_gate_emissions(),
    )
