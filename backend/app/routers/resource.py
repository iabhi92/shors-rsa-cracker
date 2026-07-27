"""Resource estimation -- wraps quantum/resource_estimate.py directly. See that module's
docstring and notes/04-gate-level-modular-exponentiation.md for the full methodology."""

from fastapi import APIRouter

from backend.app.schemas.resource import ResourceEstimateRequest, ResourceEstimateResponse
from quantum.resource_estimate import estimate_for_rsa_bits, gidney_ekera_2019_estimate

router = APIRouter()


@router.post("", response_model=ResourceEstimateResponse)
def resource_estimate(req: ResourceEstimateRequest) -> ResourceEstimateResponse:
    est = estimate_for_rsa_bits(req.bits)
    ge = gidney_ekera_2019_estimate(req.bits)
    return ResourceEstimateResponse(
        bits=req.bits,
        this_project={
            "n_count": est.n_count,
            "n_target": est.n_target,
            "n_ancilla": est.n_ancilla,
            "total_qubits": est.total_qubits,
            "toffoli_equivalent_gates": est.toffoli_equivalent_gates,
            "total_gate_emissions": est.total_gate_emissions,
        },
        gidney_ekera_2019={
            "logical_qubits": ge["logical_qubits"],
            "toffoli_gates": ge["toffoli_gates"],
            "physical_qubits_headline": "~20 million (2019 estimate); a 2025 follow-up (arXiv:2505.15917) brings this below 1 million",
        },
    )
