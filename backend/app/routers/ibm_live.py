"""Live, on-demand submission of Shor's period-finding circuit to REAL IBM Quantum hardware --
the one router in this backend that actually imports quantum/ibm_hardware.py's credentialed
path and spends real, account-limited hardware time. backend/app/routers/ibm.py stays a
separate, read-only, credential-free router serving pre-recorded results, so its own docstring's
claim about itself remains true; this module is the deliberately-isolated exception.

Two rate limits guard every submission (see backend/app/rate_limit.py): a per-IP cap so no
single visitor can hammer it, and a global cap so the account's total daily real-hardware
exposure is bounded no matter how many different visitors ask -- unlike the CPU this backend's
other endpoints spend, IBM Quantum hardware time is a shared, genuinely limited account
resource.

Real jobs can queue for anywhere from seconds to many minutes, so /submit returns as soon as
IBM Quantum has *accepted* the job (see quantum.ibm_hardware.submit_to_hardware) rather than
blocking the request -- a separate /status/{run_id} endpoint is polled from the frontend. The
in-flight qiskit job handles are held in an in-memory dict, so -- like rate_limit.py's own
limiter state -- a backend restart loses track of any run still in progress; the visitor would
just need to resubmit."""

import uuid
from dataclasses import dataclass

from fastapi import APIRouter, Request

from backend.app.errors import AppError
from backend.app.rate_limit import (
    global_limiter_dependency,
    ibm_hardware_global_limiter,
    ibm_hardware_per_ip_limiter,
    limiter_dependency,
)
from backend.app.schemas.ibm import (
    IbmLiveStatus,
    IbmLiveStatusResponse,
    IbmLiveSubmitRequest,
    IbmLiveSubmitResponse,
)
from quantum.fast_sim import multiplicative_order
from quantum.ibm_hardware import SubmittedJob, counts_from_result, submit_to_hardware

router = APIRouter()

# Fixed, not caller-supplied: N=15 is the only value quantum/ibm_hardware.py's compiled circuit
# supports (see its module docstring), and n_count=3 is what makes every reachable order r in
# {1,2,4,8} divide 2**n_count evenly. shots is deliberately smaller than the offline script's
# 4000 -- this spends real, shared account quota per visitor, not local CPU.
_N = 15
_N_COUNT = 3
_SHOTS = 1000

_QUEUED_STATUSES = {"INITIALIZING", "QUEUED", "VALIDATING"}
_ERROR_STATUSES = {"ERROR", "CANCELLED"}


@dataclass
class _RunState:
    submitted: SubmittedJob
    a: int
    r: int
    # Cached once the job reaches a final state, so repeated polls after completion don't
    # re-fetch/re-parse the same result from IBM's API on every tick.
    finished: IbmLiveStatusResponse | None = None


_RUNS: dict[str, _RunState] = {}


def _theoretical_distribution(a: int, n: int, n_count: int) -> dict[int, float]:
    """Exact peaks at k*2^n_count/r for k=0..r-1 -- same formula scripts/run_on_ibm_hardware.py
    uses, valid whenever r divides 2^n_count evenly (guaranteed here, see module comment)."""
    r = multiplicative_order(a, n)
    dim = 2**n_count
    peak_spacing = dim // r
    return {k * peak_spacing: 1.0 / r for k in range(r)}


@router.post("/submit", response_model=IbmLiveSubmitResponse)
def submit(req: IbmLiveSubmitRequest, request: Request) -> IbmLiveSubmitResponse:
    # Deliberately checked here, inside the function body, rather than via FastAPI's
    # `dependencies=[...]` on the decorator: those run as part of dependency resolution
    # *alongside* body validation, not strictly after it, so a request with an invalid `a`
    # would still burn rate-limit budget before ever reaching a 422. `req` above is only ever
    # a real, valid IbmLiveSubmitRequest by the time this line runs (FastAPI 422s first
    # otherwise), so only genuinely valid submissions ever spend from either budget.
    limiter_dependency(ibm_hardware_per_ip_limiter)(request)
    global_limiter_dependency(ibm_hardware_global_limiter)(request)

    r = multiplicative_order(req.a, _N)
    try:
        submitted = submit_to_hardware(req.a, _N, _N_COUNT, shots=_SHOTS)
    except RuntimeError as exc:
        # get_service() raises RuntimeError if IBM_QUANTUM_API_KEY/CRN aren't configured on
        # this deployment -- a real, permanent "not set up" state, not this endpoint's fault.
        # Deliberately not 503: the frontend API client auto-retries 502/503/504 with backoff
        # (Render's free tier cold-starts behind those exact codes), which would make a missing
        # credential look like a slow wake-up for ~50s instead of surfacing immediately.
        raise AppError(str(exc), status_code=400) from exc

    run_id = uuid.uuid4().hex
    _RUNS[run_id] = _RunState(submitted=submitted, a=req.a, r=r)
    return IbmLiveSubmitResponse(
        run_id=run_id,
        a=req.a,
        N=_N,
        n_count=_N_COUNT,
        r=r,
        shots=_SHOTS,
        backend_name=submitted.backend_name,
        job_id=submitted.job.job_id(),
    )


@router.get("/status/{run_id}", response_model=IbmLiveStatusResponse)
def status(run_id: str) -> IbmLiveStatusResponse:
    state = _RUNS.get(run_id)
    if state is None:
        raise AppError(
            "Unknown run_id -- either it never existed, or the backend restarted since it was submitted.",
            status_code=404,
        )
    if state.finished is not None:
        return state.finished

    job = state.submitted.job
    job_status_name = job.status().name

    base = {
        "run_id": run_id,
        "a": state.a,
        "N": _N,
        "n_count": _N_COUNT,
        "r": state.r,
        "shots": state.submitted.shots,
        "backend_name": state.submitted.backend_name,
        "job_id": job.job_id(),
    }

    if job_status_name == "DONE":
        try:
            result = job.result()
            counts = counts_from_result(result)
        except Exception as exc:  # noqa: BLE001 -- real hardware/network failures here are genuinely unpredictable
            response = IbmLiveStatusResponse(status="error", error_message=str(exc), **base)
            state.finished = response
            return response

        theory = _theoretical_distribution(state.a, _N, _N_COUNT)
        dim = 2**_N_COUNT
        measured_probs = {k: v / state.submitted.shots for k, v in counts.items()}
        tvd = 0.5 * sum(abs(measured_probs.get(x, 0.0) - theory.get(x, 0.0)) for x in range(dim))
        leaked = sum(v for k, v in measured_probs.items() if k not in theory)

        response = IbmLiveStatusResponse(
            status="done",
            counts={str(k): v for k, v in counts.items()},
            theoretical_distribution={str(k): v for k, v in theory.items()},
            total_variation_distance=tvd,
            probability_mass_on_theoretically_impossible_outcomes=leaked,
            **base,
        )
        state.finished = response
        return response

    if job_status_name in _ERROR_STATUSES:
        response = IbmLiveStatusResponse(status="error", error_message=f"Job ended with status {job_status_name}.", **base)
        state.finished = response
        return response

    live_status: IbmLiveStatus = "queued" if job_status_name in _QUEUED_STATUSES else "running"
    return IbmLiveStatusResponse(status=live_status, **base)
