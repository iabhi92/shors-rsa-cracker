from typing import Literal

from pydantic import BaseModel, Field


class IbmHardwareResult(BaseModel):
    a: int
    N: int  # matches data/ibm_hardware_run_*.json's own key, and quantum/shor.py's convention
    n_count: int
    r: int
    backend_name: str
    job_id: str
    shots: int
    timestamp_utc: str
    counts: dict[str, int]
    theoretical_distribution: dict[str, float]
    total_variation_distance: float
    probability_mass_on_theoretically_impossible_outcomes: float


class IbmHardwareResponse(BaseModel):
    runs: list[IbmHardwareResult]
    disclaimer: str = (
        "These are stored results from real IBM quantum hardware runs already documented in "
        "this repository (notes/05-real-hardware-validation.md). Want a fresh one, submitted "
        "live from your own click? See 'Run this live, right now' below."
    )


# N=15 is the only case quantum/ibm_hardware.py's compiled circuit supports (see its module
# docstring): every a coprime with 15 automatically has a multiplicative order that's a power
# of two, since |(Z/15Z)*| = 8. These are exactly those a's, spelled out as a Literal (rather
# than plain int + manual validation) so FastAPI 422s an invalid `a` before request handler
# code -- and therefore before any real hardware call -- ever runs.
AllowedLiveA = Literal[2, 4, 7, 8, 11, 13, 14]
ALLOWED_LIVE_A_VALUES: tuple[int, ...] = (2, 4, 7, 8, 11, 13, 14)


class IbmLiveSubmitRequest(BaseModel):
    a: AllowedLiveA = Field(..., description="Must have a multiplicative order mod 15 that's a power of two -- see AllowedLiveA's own comment.")


class IbmLiveSubmitResponse(BaseModel):
    # backend_name/job_id are NOT included here -- picking a real backend and actually
    # submitting to IBM Quantum both involve real network calls (auth, backend-list lookup,
    # transpilation, job submission) slow enough to occasionally exceed a deployment's own
    # proxy timeout, so this endpoint kicks that whole chain off on a background thread and
    # returns immediately with just what's known synchronously (r is pure local number theory).
    # See ibm_live.py's own module docstring.
    run_id: str
    a: int
    N: int
    n_count: int
    r: int
    shots: int
    status: Literal["submitting"] = "submitting"


IbmLiveStatus = Literal["submitting", "queued", "running", "done", "error"]


class IbmLiveStatusResponse(BaseModel):
    run_id: str
    status: IbmLiveStatus
    a: int
    N: int
    n_count: int
    r: int
    shots: int
    # None only while status == "submitting" -- the backend hasn't actually been picked/the job
    # hasn't actually been submitted to IBM yet at that point.
    backend_name: str | None = None
    job_id: str | None = None
    # Populated only once status == "done"; None otherwise, including "error".
    counts: dict[str, int] | None = None
    theoretical_distribution: dict[str, float] | None = None
    total_variation_distance: float | None = None
    probability_mass_on_theoretically_impossible_outcomes: float | None = None
    error_message: str | None = None
