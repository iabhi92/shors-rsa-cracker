from typing import Literal

from pydantic import BaseModel, Field

from backend.app.limits import SHOR_ALLOWED_N, SHOR_MAX_ATTEMPTS

ShorBackend = Literal["honest", "gate_level", "fast", "cirq"]


class ShorRequest(BaseModel):
    n: int = Field(..., description=f"Must be one of {SHOR_ALLOWED_N}")
    a: int | None = Field(default=None, description="Base to use; omit to let the backend pick one")
    backend: ShorBackend = "honest"
    max_attempts: int = Field(default=10, ge=1, le=SHOR_MAX_ATTEMPTS)
    seed: int | None = None


class ShorAttempt(BaseModel):
    a: int
    measured: int | None
    period_candidate: int | None
    outcome: str


class ShorResponse(BaseModel):
    n: int
    backend_used: ShorBackend
    n_count_used: int | None
    factors: tuple[int, int] | None
    succeeded: bool
    attempts: list[ShorAttempt]
    elapsed_seconds: float
    note: str | None = None
