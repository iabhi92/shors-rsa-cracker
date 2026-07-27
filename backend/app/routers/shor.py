"""Shor's Algorithm Laboratory -- the central demo. Every backend option here is a real,
already-tested period_finder from this project (quantum/shor.py, modexp_circuit.py,
fast_sim.py, cirq_shor.py), never a hardcoded result."""

import math
import time

import numpy as np
from fastapi import APIRouter, Depends

from backend.app.errors import AppError
from backend.app.limits import SHOR_ALLOWED_N, SHOR_GATE_LEVEL_ALLOWED_N, SHOR_MAX_SLOW_BACKEND_N_COUNT
from backend.app.rate_limit import limiter_dependency, shor_run_limiter
from backend.app.schemas.shor import ShorAttempt, ShorRequest, ShorResponse
from quantum.cirq_shor import find_period_quantum_cirq
from quantum.fast_sim import find_period_quantum_fast
from quantum.shor import default_n_count, find_period_quantum, find_period_quantum_gate_level, shors_algorithm

router = APIRouter()

_PERIOD_FINDERS = {
    "honest": find_period_quantum,
    "gate_level": find_period_quantum_gate_level,
    "fast": find_period_quantum_fast,
    "cirq": find_period_quantum_cirq,
}

_BACKEND_DESCRIPTIONS = {
    "honest": "Full statevector simulation of the permutation-based modular exponentiation circuit.",
    "gate_level": "Full statevector simulation with ZERO shortcuts: modular exponentiation built from elementary reversible-arithmetic gates.",
    "fast": "Samples directly from the theoretical distribution using a classically-precomputed order -- not a scalability result, see quantum/fast_sim.py.",
    "cirq": "Same circuit, independently rebuilt and run on Google's Cirq simulator, as a cross-check.",
}


@router.post("/run", response_model=ShorResponse, dependencies=[Depends(limiter_dependency(shor_run_limiter))])
def run(req: ShorRequest) -> ShorResponse:
    if req.n not in SHOR_ALLOWED_N:
        raise AppError(f"N={req.n} is not in the supported demo set {SHOR_ALLOWED_N}")
    if req.backend == "gate_level" and req.n not in SHOR_GATE_LEVEL_ALLOWED_N:
        raise AppError(
            f"The gate-level backend is only available for N in {SHOR_GATE_LEVEL_ALLOWED_N} on "
            f"this site -- its ancilla cost grows with N.bit_length() regardless of n_count, "
            f"and larger N were measured to take minutes rather than seconds during "
            f"development. Try the honest, fast, or Cirq backends for N={req.n}."
        )
    if req.a is not None and math.gcd(req.a, req.n) != 1:
        raise AppError(f"a={req.a} is not coprime with N={req.n} (that gcd would already be a factor -- pick another a)")

    period_finder = _PERIOD_FINDERS[req.backend]
    n_count = default_n_count(req.n)
    note = None
    if req.backend in ("gate_level", "cirq") and n_count > SHOR_MAX_SLOW_BACKEND_N_COUNT:
        note = (
            f"n_count reduced from the default {n_count} to {SHOR_MAX_SLOW_BACKEND_N_COUNT} "
            f"to keep the {req.backend} backend responsive for a web request -- lower "
            f"precision means a lower per-shot success probability, made up for by retries."
        )
        n_count = SHOR_MAX_SLOW_BACKEND_N_COUNT

    rng = np.random.default_rng(req.seed)

    if req.a is not None:
        # shors_algorithm always samples its own `a`; to honor a user-chosen `a` we run the
        # single-shot period_finder pipeline directly, reusing the exact same classical
        # failure-mode logic shors_algorithm itself uses (kept in sync deliberately, not
        # duplicated silently -- see quantum/shor.py's shors_algorithm for the reference logic).
        attempts: list[ShorAttempt] = []
        factors = None
        start = time.perf_counter()
        g = math.gcd(req.a, req.n)
        if g != 1:
            attempts.append(ShorAttempt(a=req.a, measured=None, period_candidate=None, outcome=f"gcd(a,N)={g} != 1: trivial factor, no quantum step needed"))
            factors = (g, req.n // g)
        else:
            shot = period_finder(req.a, req.n, rng, n_count=n_count)
            r = shot.period
            outcome = ""
            if r is None:
                outcome = "continued fractions found no valid period from this measurement"
            elif r % 2 != 0:
                outcome = f"period r={r} is odd, unusable"
            else:
                x = pow(req.a, r // 2, req.n)
                if x == req.n - 1:
                    outcome = f"a^(r/2) == -1 mod N (r={r}): only trivial factors from this attempt"
                else:
                    p = math.gcd(x - 1, req.n)
                    q = math.gcd(x + 1, req.n)
                    if 1 < p < req.n and p * q == req.n:
                        outcome = f"success: r={r}, factors=({p},{q})"
                        factors = (p, req.n // p)
                    else:
                        outcome = f"gcd step gave a trivial factor (r={r})"
            attempts.append(ShorAttempt(a=req.a, measured=shot.measured, period_candidate=r, outcome=outcome))
        elapsed = time.perf_counter() - start
    else:
        start = time.perf_counter()
        full_result = shors_algorithm(req.n, rng, max_attempts=req.max_attempts, n_count=n_count, period_finder=period_finder)
        elapsed = time.perf_counter() - start
        attempts = [
            ShorAttempt(a=a.a, measured=a.measured, period_candidate=a.period_candidate, outcome=a.outcome)
            for a in full_result.attempts
        ]
        factors = full_result.factors

    return ShorResponse(
        n=req.n,
        backend_used=req.backend,
        n_count_used=n_count,
        factors=factors,
        succeeded=factors is not None,
        attempts=attempts,
        elapsed_seconds=elapsed,
        note=note,
    )


@router.get("/backends")
def list_backends() -> dict[str, dict[str, str] | list[int]]:
    return {
        "descriptions": _BACKEND_DESCRIPTIONS,
        "allowed_n": list(SHOR_ALLOWED_N),
        "gate_level_allowed_n": list(SHOR_GATE_LEVEL_ALLOWED_N),
    }
