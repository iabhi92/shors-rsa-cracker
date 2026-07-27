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
from backend.app.errors import AppError
from backend.app.limits import CLASSICAL_ATTACK_TIMEOUT_SECONDS
from backend.app.rate_limit import classical_attack_limiter, limiter_dependency
from backend.app.schemas.benchmark import BenchmarkResponse, BenchmarkRow
from backend.app.schemas.classical import (
    AttackMethod,
    AttackRequest,
    AttackResponse,
    CompareRequest,
    CompareResponse,
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
