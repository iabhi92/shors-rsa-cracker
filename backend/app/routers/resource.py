"""Resource estimation -- wraps quantum/resource_estimate.py directly. See that module's
docstring and notes/04-gate-level-modular-exponentiation.md for the full methodology."""

from fastapi import APIRouter

from backend.app.schemas.resource import (
    ResourceCurvePoint,
    ResourceCurveResponse,
    ResourceEstimateRequest,
    ResourceEstimateResponse,
)
from quantum.resource_estimate import estimate_for_rsa_bits, gidney_ekera_2019_estimate

router = APIRouter()

# A fixed, representative spread from this project's smallest teaching sizes up past a real
# RSA-2048 modulus -- not user-configurable, since the point of the curve is one honest,
# reproducible picture of the growth trend, not a resampled chart every time bits changes.
# estimate_for_rsa_bits is closed-form (no simulation), so computing all of these per request
# costs nothing -- see quantum/resource_estimate.py's own module docstring.
_CURVE_BITS = [8, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512, 768, 1024, 1536, 2048, 3072, 4096]


@router.get("/curve", response_model=ResourceCurveResponse)
def resource_curve() -> ResourceCurveResponse:
    """The same closed-form estimate the single-value endpoint below uses, computed across a
    fixed spread of bit sizes in one response -- lets the Resource Estimation page plot the
    actual qubit/gate growth curve instead of only ever showing one point at a time."""
    points = []
    for bits in _CURVE_BITS:
        est = estimate_for_rsa_bits(bits)
        ge = gidney_ekera_2019_estimate(bits)
        points.append(
            ResourceCurvePoint(
                bits=bits,
                total_qubits=est.total_qubits,
                toffoli_equivalent_gates=est.toffoli_equivalent_gates,
                ge_logical_qubits=ge["logical_qubits"],
                ge_toffoli_gates=ge["toffoli_gates"],
            )
        )
    return ResourceCurveResponse(points=points)


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
