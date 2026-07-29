"""Classical attack laboratory -- runs the real attacker/classical.py implementations, always
with a bounded timeout so a request can't hang the server."""

import csv
from collections.abc import Callable
from pathlib import Path

from fastapi import APIRouter, Depends

from attacker.classical import (
    FactorAttemptResult,
    fermat_factorization,
    pollards_p_minus_1,
    pollards_rho,
    trial_division,
)
from attacker.extrapolation import describe_duration, extrapolate_log10_seconds
from backend.app.errors import AppError
from backend.app.limits import CLASSICAL_ATTACK_TIMEOUT_SECONDS
from backend.app.rate_limit import classical_attack_limiter, limiter_dependency
from backend.app.schemas.benchmark import BenchmarkResponse, BenchmarkRow
from backend.app.schemas.classical import (
    AttackMethod,
    AttackRequest,
    AttackResponse,
    ClassicalTimeEstimateRequest,
    ClassicalTimeEstimateResponse,
    CompareRequest,
    CompareResponse,
    TrialDivisionTraceRequest,
    TrialDivisionTraceResponse,
    TrialDivisionTraceStep,
)

router = APIRouter()

_BENCHMARK_CSV = Path(__file__).resolve().parent.parent.parent.parent / "data" / "classical_benchmark.csv"

_METHODS: dict[AttackMethod, Callable[..., FactorAttemptResult]] = {
    "trial_division": trial_division,
    "fermat": fermat_factorization,
    "pollards_rho": pollards_rho,
    "pollards_p_minus_1": pollards_p_minus_1,
}


def _run(method: AttackMethod, n: int) -> AttackResponse:
    result = _METHODS[method](n, timeout=CLASSICAL_ATTACK_TIMEOUT_SECONDS)
    return AttackResponse(
        n=n,
        method=method,
        succeeded=result.succeeded,
        timed_out=result.timed_out,
        factor=result.factor,
        other_factor=result.other_factor,
        operations=result.operations,
        elapsed_seconds=result.elapsed_seconds,
    )


@router.post("/attack", response_model=AttackResponse, dependencies=[Depends(limiter_dependency(classical_attack_limiter))])
def attack(req: AttackRequest) -> AttackResponse:
    return _run(req.method, req.n)


@router.post("/compare", response_model=CompareResponse, dependencies=[Depends(limiter_dependency(classical_attack_limiter))])
def compare(req: CompareRequest) -> CompareResponse:
    results = [_run(method, req.n) for method in _METHODS]
    return CompareResponse(n=req.n, results=results)


@router.post(
    "/trial-division-trace",
    response_model=TrialDivisionTraceResponse,
    dependencies=[Depends(limiter_dependency(classical_attack_limiter))],
)
def trial_division_trace(req: TrialDivisionTraceRequest) -> TrialDivisionTraceResponse:
    """Every real divisor trial_division actually tried, in order -- the Classical Attack Lab's
    replay mode steps through this list frame by frame rather than only ever showing the final
    operations count. Only trial_division gets this treatment: its step count is naturally
    bounded (~sqrt(n)/2, at most ~1580 for this project's largest allowed n), unlike the other
    three methods, whose iteration counts don't have as small a guaranteed ceiling."""
    result = trial_division(req.n, timeout=CLASSICAL_ATTACK_TIMEOUT_SECONDS, collect_trace=True)
    assert result.trace is not None  # collect_trace=True always populates this
    return TrialDivisionTraceResponse(
        n=req.n,
        succeeded=result.succeeded,
        factor=result.factor,
        other_factor=result.other_factor,
        operations=result.operations,
        elapsed_seconds=result.elapsed_seconds,
        steps=[TrialDivisionTraceStep(divisor=s.divisor, remainder=s.remainder, is_factor=s.is_factor) for s in result.trace],
    )


@router.get("/benchmark", response_model=BenchmarkResponse)
def benchmark() -> BenchmarkResponse:
    """Loads the existing, already-generated data/classical_benchmark.csv (see
    scripts/benchmark_classical.py) -- never regenerates it on a page view."""
    if not _BENCHMARK_CSV.exists():
        raise AppError(
            "No benchmark data found. Run `python scripts/benchmark_classical.py` first.", status_code=404
        )
    rows = []
    with open(_BENCHMARK_CSV, newline="") as f:
        for row in csv.DictReader(f):
            rows.append(
                BenchmarkRow(
                    bits=int(row["bits"]),
                    n=int(row["n"]),
                    trial_division_seconds=float(row["trial_division_seconds"]),
                    trial_division_succeeded=row["trial_division_succeeded"] == "True",
                    pollards_rho_seconds=float(row["pollards_rho_seconds"]),
                    pollards_rho_succeeded=row["pollards_rho_succeeded"] == "True",
                )
            )
    return BenchmarkResponse(rows=rows, source_file=_BENCHMARK_CSV.name)


@router.post("/time-estimate", response_model=ClassicalTimeEstimateResponse)
def time_estimate(req: ClassicalTimeEstimateRequest) -> ClassicalTimeEstimateResponse:
    """Extrapolates the benchmark CSV's own largest real measured row out to `req.bits`, using
    trial_division's and Pollard's rho's real O(sqrt(n))/O(n^(1/4)) complexity -- see
    attacker/extrapolation.py's own module docstring for why this is a different (and more
    honest) question than "how long would GNFS take"."""
    if not _BENCHMARK_CSV.exists():
        raise AppError(
            "No benchmark data found. Run `python scripts/benchmark_classical.py` first.", status_code=404
        )
    with open(_BENCHMARK_CSV, newline="") as f:
        rows = list(csv.DictReader(f))
    reference = max(rows, key=lambda row: int(row["bits"]))
    reference_bits = int(reference["bits"])

    trial_division_log10 = extrapolate_log10_seconds(
        reference_bits, float(reference["trial_division_seconds"]), req.bits, growth_exponent=0.5
    )
    pollards_rho_log10 = extrapolate_log10_seconds(
        reference_bits, float(reference["pollards_rho_seconds"]), req.bits, growth_exponent=0.25
    )
    trial_division_estimate = describe_duration(trial_division_log10)
    pollards_rho_estimate = describe_duration(pollards_rho_log10)

    return ClassicalTimeEstimateResponse(
        bits=req.bits,
        reference_bits=reference_bits,
        trial_division_log10_seconds=trial_division_estimate.log10_seconds,
        trial_division_human=trial_division_estimate.human,
        pollards_rho_log10_seconds=pollards_rho_estimate.log10_seconds,
        pollards_rho_human=pollards_rho_estimate.human,
    )
