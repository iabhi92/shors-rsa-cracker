"""Shor's algorithm: quantum period-finding plus the classical post-processing that turns a
found period into RSA's secret prime factors.

Two interchangeable period-finding backends (both usable as `shors_algorithm`'s
`period_finder`): find_period_quantum uses quantum/modexp.py's modular-exponentiation
permutation shortcut (cheaper, more qubits of N reachable); find_period_quantum_gate_level
uses quantum/modexp_circuit.py's honest gate-level reversible-arithmetic circuit (no
shortcuts, more ancilla qubits, smaller N reachable). They're cross-validated
statevector-exact against each other in tests/test_quantum_modexp_circuit.py.

Pipeline per attempt:
  1. Pick a random a coprime with N (if gcd(a, N) != 1, that gcd IS a factor — no quantum
     step needed, this is a real, if rare, classical shortcut Shor's algorithm gets for free).
  2. Quantum period-finding: put the control register in equal superposition, apply the
     controlled modular exponentiation, apply the inverse QFT to the control register,
     measure it.
  3. Classical: run the continued-fractions algorithm on the measurement to recover a
     candidate period r, verify a^r == 1 mod N.
  4. If r is odd, or a^(r/2) == -1 mod N, this attempt yields only the trivial factors
     {1, N} — a known, expected failure mode of the algorithm, not a bug. Retry with a new a.
  5. Otherwise gcd(a^(r/2) - 1, N) and gcd(a^(r/2) + 1, N) are N's nontrivial factors.
"""

import math
from collections.abc import Callable
from dataclasses import dataclass, field
from fractions import Fraction

import numpy as np

from quantum.modexp import apply_modular_exponentiation
from quantum.modexp_circuit import ancilla_qubit_count, apply_modular_exponentiation_circuit
from quantum.qft import apply_inverse_qft
from quantum.statevector import H, QuantumRegister
from rsa.primes import is_prime


@dataclass
class PeriodFindingResult:
    N: int
    a: int
    n_count: int
    n_target: int
    measured: int
    measured_probability: float
    period: int | None


@dataclass
class AttemptLog:
    a: int
    measured: int | None = None
    period_candidate: int | None = None
    outcome: str = ""


@dataclass
class ShorResult:
    N: int
    factors: tuple[int, int] | None
    attempts: list[AttemptLog] = field(default_factory=list)


def default_n_count(N: int) -> int:
    """Standard choice: 2*ceil(log2(N)) bits of control-register precision, enough to
    resolve the period via continued fractions with high probability per shot."""
    return 2 * N.bit_length()


def continued_fraction_convergents(numerator: int, denominator: int) -> list[Fraction]:
    """All convergents p_i/q_i of numerator/denominator's continued fraction expansion."""
    convergents = []
    a, b = numerator, denominator
    coeffs = []
    while b:
        coeffs.append(a // b)
        a, b = b, a % b

    h_prev2, h_prev1 = 0, 1
    k_prev2, k_prev1 = 1, 0
    for c in coeffs:
        h = c * h_prev1 + h_prev2
        k = c * k_prev1 + k_prev2
        convergents.append(Fraction(h, k))
        h_prev2, h_prev1 = h_prev1, h
        k_prev2, k_prev1 = k_prev1, k
    return convergents


def extract_period_from_measurement(measured: int, n_count: int, a: int, N: int) -> int | None:
    """Turn a control-register measurement into a verified period, or None if it doesn't
    yield one. measured/2^n_count approximates k/r for some k; continued fractions recovers
    candidate r's, each checked classically against a^r == 1 mod N before being trusted."""
    if measured == 0:
        return None  # carries no information about r; every attempt has some chance of this
    denominator = 2**n_count
    for frac in continued_fraction_convergents(measured, denominator):
        r = frac.denominator
        if r == 0 or r >= N:
            continue
        if pow(a, r, N) == 1:
            return r
    return None


def find_period_quantum(
    a: int, N: int, rng: np.random.Generator, n_count: int | None = None
) -> PeriodFindingResult:
    """Run one shot of the quantum period-finding circuit via full statevector simulation."""
    if math.gcd(a, N) != 1:
        raise ValueError("a must be coprime with N")
    n_target = N.bit_length()
    if n_count is None:
        n_count = default_n_count(N)

    control_qubits = list(range(n_count))
    # whole-register integer = (control_value << n_target) | target_value, so initial_value=1
    # correctly sets control=|0...0> and target=|1> in one shot (see statevector.py's convention).
    register = QuantumRegister(n_count + n_target, initial_value=1)

    for q in control_qubits:
        register.apply_gate(H, q)

    apply_modular_exponentiation(register, n_count, n_target, a, N)

    apply_inverse_qft(register, control_qubits)

    control_probs = register.marginal_probabilities(control_qubits)
    control_probs = control_probs / control_probs.sum()
    measured = int(rng.choice(2**n_count, p=control_probs))

    period = extract_period_from_measurement(measured, n_count, a, N)

    return PeriodFindingResult(
        N=N,
        a=a,
        n_count=n_count,
        n_target=n_target,
        measured=measured,
        measured_probability=float(control_probs[measured]),
        period=period,
    )


def find_period_quantum_gate_level(
    a: int, N: int, rng: np.random.Generator, n_count: int | None = None
) -> PeriodFindingResult:
    """Same contract as find_period_quantum, but with zero shortcuts: modular exponentiation
    is realized by quantum/modexp_circuit.py's gate-level circuit (elementary single- and
    multi-controlled single-qubit gates only — reversible adders, modular multipliers, the
    works) instead of quantum/modexp.py's permutation shortcut. The two are cross-validated
    statevector-exact in tests/test_quantum_modexp_circuit.py; this function exists to prove
    that equivalence also holds end to end, through the inverse QFT and measurement, not
    just at the modexp step in isolation.

    Costs ancilla_qubit_count(n_target) = n_target + 2 extra qubits over find_period_quantum
    for the same N, so it reaches smaller N in practice — this is the *more* honest simulator,
    not a scaled-up one; see find_period_quantum for the default, cheaper-to-run path."""
    if math.gcd(a, N) != 1:
        raise ValueError("a must be coprime with N")
    n_target = N.bit_length()
    if n_count is None:
        n_count = default_n_count(N)

    n_ancilla = ancilla_qubit_count(n_target)
    control_qubits = list(range(n_count))
    # ancilla (b register + flag) occupies the low bits, so target=1 sits just above it —
    # see quantum/modexp_circuit.py's module docstring for the exact qubit layout.
    register = QuantumRegister(n_count + n_target + n_ancilla, initial_value=1 << n_ancilla)

    for q in control_qubits:
        register.apply_gate(H, q)

    apply_modular_exponentiation_circuit(register, n_count, n_target, a, N)

    apply_inverse_qft(register, control_qubits)

    control_probs = register.marginal_probabilities(control_qubits)
    control_probs = control_probs / control_probs.sum()
    measured = int(rng.choice(2**n_count, p=control_probs))

    period = extract_period_from_measurement(measured, n_count, a, N)

    return PeriodFindingResult(
        N=N,
        a=a,
        n_count=n_count,
        n_target=n_target,
        measured=measured,
        measured_probability=float(control_probs[measured]),
        period=period,
    )


def _perfect_power(N: int) -> tuple[int, int] | None:
    """If N == base**exponent for some exponent >= 2, return (base, exponent)."""
    for exponent in range(2, N.bit_length() + 1):
        root = round(N ** (1 / exponent))
        for candidate in (root - 1, root, root + 1):
            if candidate > 1 and candidate**exponent == N:
                return candidate, exponent
    return None


def shors_algorithm(
    N: int,
    rng: np.random.Generator,
    max_attempts: int = 20,
    n_count: int | None = None,
    period_finder: Callable[..., PeriodFindingResult] = find_period_quantum,
) -> ShorResult:
    """Full pipeline: classical pre-checks, then repeated quantum period-finding attempts
    until nontrivial factors are found or max_attempts is exhausted.

    `period_finder` defaults to the honest full-statevector simulation (find_period_quantum);
    pass `quantum.fast_sim.find_period_quantum_fast` to use the sampling shortcut for N too
    large for the honest simulator. Every classical pre-check and the retry/failure-mode
    logic below is identical either way — only how a single measurement gets produced differs.
    """
    if N < 4:
        raise ValueError("N must be >= 4")
    if is_prime(N):
        raise ValueError(f"N={N} is prime; Shor's algorithm factors composites")

    attempts: list[AttemptLog] = []

    if N % 2 == 0:
        attempts.append(AttemptLog(a=2, outcome="N is even; trivial factor, no quantum step needed"))
        return ShorResult(N, (2, N // 2), attempts)

    power = _perfect_power(N)
    if power is not None:
        base, exponent = power
        attempts.append(
            AttemptLog(a=base, outcome=f"N = {base}^{exponent} is a perfect power; trivial factor")
        )
        return ShorResult(N, (base, N // base), attempts)

    for _ in range(max_attempts):
        a = int(rng.integers(2, N - 1)) if N > 3 else 2
        g = math.gcd(a, N)
        if g != 1:
            attempts.append(AttemptLog(a=a, outcome=f"gcd(a,N)={g} != 1: trivial factor, no quantum step needed"))
            return ShorResult(N, (g, N // g), attempts)

        result = period_finder(a, N, rng, n_count=n_count)
        log = AttemptLog(a=a, measured=result.measured, period_candidate=result.period)
        r = result.period

        if r is None:
            log.outcome = "continued fractions found no valid period from this measurement"
        elif r % 2 != 0:
            log.outcome = f"period r={r} is odd, unusable"
        else:
            x = pow(a, r // 2, N)
            if x == N - 1:
                log.outcome = f"a^(r/2) == -1 mod N (r={r}): only trivial factors from this attempt"
            else:
                p = math.gcd(x - 1, N)
                q = math.gcd(x + 1, N)
                if 1 < p < N and p * q == N:
                    log.outcome = f"success: r={r}, factors=({p},{q})"
                    attempts.append(log)
                    return ShorResult(N, (p, N // p), attempts)
                log.outcome = f"gcd step gave a trivial factor (r={r})"

        attempts.append(log)

    return ShorResult(N, None, attempts)
