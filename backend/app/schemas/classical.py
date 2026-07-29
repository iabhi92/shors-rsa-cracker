from typing import Literal

from pydantic import BaseModel, Field

from backend.app.limits import CLASSICAL_MAX_N, CLASSICAL_MIN_N

AttackMethod = Literal["trial_division", "fermat", "pollards_rho", "pollards_p_minus_1"]


class AttackRequest(BaseModel):
    n: int = Field(..., ge=CLASSICAL_MIN_N, le=CLASSICAL_MAX_N)
    method: AttackMethod


class AttackResponse(BaseModel):
    n: int
    method: AttackMethod
    succeeded: bool
    timed_out: bool
    factor: int | None
    other_factor: int | None
    operations: int
    elapsed_seconds: float


class CompareRequest(BaseModel):
    n: int = Field(..., ge=CLASSICAL_MIN_N, le=CLASSICAL_MAX_N)


class CompareResponse(BaseModel):
    n: int
    results: list[AttackResponse]


class TrialDivisionTraceRequest(BaseModel):
    n: int = Field(..., ge=CLASSICAL_MIN_N, le=CLASSICAL_MAX_N)


class TrialDivisionTraceStep(BaseModel):
    divisor: int
    remainder: int
    is_factor: bool


class ClassicalTimeEstimateRequest(BaseModel):
    bits: int = Field(..., ge=8, le=4096)


class ClassicalTimeEstimateResponse(BaseModel):
    bits: int
    reference_bits: int
    trial_division_log10_seconds: float
    trial_division_human: str
    pollards_rho_log10_seconds: float
    pollards_rho_human: str


class TrialDivisionTraceResponse(BaseModel):
    n: int
    succeeded: bool
    factor: int | None
    other_factor: int | None
    operations: int
    elapsed_seconds: float
    # Every real divisor trial_division actually tried, in order -- bounded naturally (at most
    # ~sqrt(n)/2 steps, which for this project's largest allowed n is ~1580) so this is always
    # the full trace, never a sample of it. See attacker/classical.py's TrialDivisionStep.
    steps: list[TrialDivisionTraceStep]
