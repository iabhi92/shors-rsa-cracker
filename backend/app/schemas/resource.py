from pydantic import BaseModel, Field

from backend.app.limits import RESOURCE_ESTIMATE_MAX_BITS, RESOURCE_ESTIMATE_MIN_BITS


class ResourceEstimateRequest(BaseModel):
    bits: int = Field(..., ge=RESOURCE_ESTIMATE_MIN_BITS, le=RESOURCE_ESTIMATE_MAX_BITS)


class ResourceCurvePoint(BaseModel):
    bits: int
    total_qubits: int
    toffoli_equivalent_gates: float
    ge_logical_qubits: float
    ge_toffoli_gates: float


class ResourceCurveResponse(BaseModel):
    points: list[ResourceCurvePoint]


class ResourceEstimateResponse(BaseModel):
    bits: int
    this_project: dict
    gidney_ekera_2019: dict
    methodology_note: str = (
        "this_project's numbers come from a closed-form formula, hand-derived from "
        "quantum/modexp_circuit.py's actual gate-emission structure and proven to exactly "
        "reproduce real measured gate counts at small scale (tests/test_resource_estimate.py) "
        "before being trusted to extrapolate here -- not a live simulation of this bit size, "
        "which would be computationally impossible. gidney_ekera_2019 is Gidney & Ekera's "
        "published formula for an independently-designed, highly optimized, fault-tolerant "
        "circuit (arXiv:1905.09749) -- comparing the two is apples-to-oranges in absolute "
        "terms (see notes/04) but both are genuinely O(n) qubits / O(n^3)-ish gates, which is "
        "the real, shared claim."
    )
