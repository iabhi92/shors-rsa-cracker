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
