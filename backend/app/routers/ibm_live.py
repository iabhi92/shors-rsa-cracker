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

Every real network call to IBM Quantum happens on a background thread, never inside the request
that triggered it -- this took two attempts to get right. The first version only backgrounded
job.result() (fetching a finished job's actual measurement counts), reasoning that submission
itself -- picking a backend, transpiling, handing the circuit to SamplerV2.run() -- returns
quickly since it only *starts* the job. In production that assumption broke: authenticating with
IBM Cloud and querying its API for the least-busy backend are themselves real network calls that
can occasionally run long, and when they did, /submit itself blocked long enough to exceed
Render/Cloudflare's own proxy timeout -- indistinguishable, from the visitor's browser, from the
backend being down. Both submission and result-fetching now run on background threads; /submit
returns almost immediately with status "submitting", and /status/{run_id} is polled until the
background submission (then the background result fetch) each resolve."""

import uuid
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Any

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

# The real, complete set of strings qiskit_ibm_runtime.RuntimeJobV2.status() can return (see
# this module's own comment above job.status() for how that was confirmed against the actual
# installed library's source, not assumed).
_QUEUED_STATUSES = {"INITIALIZING", "QUEUED"}
_ERROR_STATUSES = {"ERROR", "CANCELLED"}

# One shared pool for both the (rare, one-time) submission call and the (also one-time) result
# fetch per run -- neither is CPU-bound, both just wait on IBM's API, so a handful of worker
# threads comfortably covers many runs in flight at once.
_BACKGROUND_POOL = ThreadPoolExecutor(max_workers=8)


@dataclass
class _RunState:
    a: int
    r: int
    # The entire submit_to_hardware() call -- auth, backend selection, transpile, job submit --
    # running on a background thread. Not done yet means /status reports "submitting".
    submit_future: "Future[SubmittedJob]"
    # Cached once the job reaches a final state, so repeated polls after completion don't
    # re-fetch/re-parse the same result from IBM's API on every tick.
    finished: IbmLiveStatusResponse | None = None
    # Set the first time a poll observes the job is DONE; subsequent polls just check whether
    # it's finished yet instead of each blocking on their own separate job.result() call.
    result_future: "Future[object] | None" = field(default=None, repr=False)


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
    run_id = uuid.uuid4().hex
    submit_future = _BACKGROUND_POOL.submit(submit_to_hardware, req.a, _N, _N_COUNT, shots=_SHOTS)
    _RUNS[run_id] = _RunState(a=req.a, r=r, submit_future=submit_future)
    return IbmLiveSubmitResponse(run_id=run_id, a=req.a, N=_N, n_count=_N_COUNT, r=r, shots=_SHOTS)


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

    base_partial: dict[str, Any] = {"run_id": run_id, "a": state.a, "N": _N, "n_count": _N_COUNT, "r": state.r, "shots": _SHOTS}

    if not state.submit_future.done():
        return IbmLiveStatusResponse(status="submitting", **base_partial)

    try:
        submitted = state.submit_future.result()
    except RuntimeError as exc:
        # get_service() raises RuntimeError if IBM_QUANTUM_API_KEY/CRN aren't configured on this
        # deployment -- a real, permanent "not set up" state, discovered once the background
        # submission actually runs rather than synchronously inside /submit.
        response = IbmLiveStatusResponse(status="error", error_message=str(exc), **base_partial)
        state.finished = response
        return response
    except Exception as exc:  # noqa: BLE001 -- real IBM Cloud/network failures here are genuinely unpredictable
        response = IbmLiveStatusResponse(status="error", error_message=str(exc), **base_partial)
        state.finished = response
        return response

    job = submitted.job
    # qiskit_ibm_runtime.RuntimeJobV2.status() returns a plain string ("QUEUED", "RUNNING",
    # "DONE", "CANCELLED", "ERROR", "INITIALIZING"), not an enum with a .name attribute -- that
    # was a real bug caught live against actual IBM hardware (a 500 on every /status poll once
    # a real job existed): confirmed by reading qiskit_ibm_runtime.runtime_job_v2's own source,
    # where JobStatus is defined as Literal["INITIALIZING", "QUEUED", "RUNNING", "CANCELLED",
    # "DONE", "ERROR"], not the unrelated qiskit.providers.jobstatus.JobStatus enum.
    job_status_name = job.status()

    base = {**base_partial, "backend_name": submitted.backend_name, "job_id": job.job_id()}

    if job_status_name == "DONE":
        if state.result_future is None:
            state.result_future = _BACKGROUND_POOL.submit(job.result)
        if not state.result_future.done():
            # The fetch is in flight on a background thread -- report "running" so the frontend
            # keeps polling, rather than this request itself waiting on it.
            return IbmLiveStatusResponse(status="running", **base)

        try:
            result = state.result_future.result()
            counts = counts_from_result(result)
        except Exception as exc:  # noqa: BLE001 -- real hardware/network failures here are genuinely unpredictable
            response = IbmLiveStatusResponse(status="error", error_message=str(exc), **base)
            state.finished = response
            return response

        theory = _theoretical_distribution(state.a, _N, _N_COUNT)
        dim = 2**_N_COUNT
        measured_probs = {k: v / _SHOTS for k, v in counts.items()}
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
