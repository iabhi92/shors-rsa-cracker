"""Extrapolates this project's own *measured* classical-attack timings (scripts/benchmark_classical.py's
real output, data/classical_benchmark.csv) out to real RSA key sizes, using each algorithm's own
proven asymptotic complexity -- not a fitted curve, and explicitly not GNFS (the actual best-known
classical factoring algorithm, which neither this project nor most real-world attackers implement
from scratch). trial_division is O(sqrt(n)) and Pollard's rho is expected O(n^(1/4)); in bits, a
b-bit modulus's n is on the order of 2^b, so time scales as 2^(b/2) and 2^(b/4) respectively.

This deliberately answers a different, more honest question than "how long would GNFS take": it's
"how long would *this project's own, real, from-scratch code* take, extrapolated from a real
measurement, if you pointed it at a real key" -- consistent with this project's own standard of
never asserting a number it hasn't actually derived from real, checkable data. See
ResourceEstimatePage's own comparison for the same apples-to-oranges honesty about this project's
numbers vs. published, optimized literature.
"""

import math
from dataclasses import dataclass

SECONDS_PER_YEAR = 365.25 * 24 * 3600
AGE_OF_UNIVERSE_YEARS = 13_800_000_000
AGE_OF_UNIVERSE_LOG10_SECONDS = math.log10(AGE_OF_UNIVERSE_YEARS * SECONDS_PER_YEAR)


def extrapolate_log10_seconds(reference_bits: int, reference_seconds: float, target_bits: int, growth_exponent: float) -> float:
    """log10(estimated seconds) at target_bits, given a real measured (reference_bits,
    reference_seconds) point and the algorithm's own complexity exponent (1/2 for trial
    division's O(sqrt(n)), 1/4 for Pollard's rho's O(n^(1/4))) -- working in log space
    throughout so this stays exact and finite even when the actual number of seconds would be
    far larger than any floating-point number can represent (e.g. billions of digits at a real
    RSA-2048 size)."""
    if reference_seconds <= 0:
        raise ValueError("reference_seconds must be positive -- can't take its log")
    return math.log10(reference_seconds) + (target_bits - reference_bits) * growth_exponent * math.log10(2)


@dataclass(frozen=True)
class DurationEstimate:
    log10_seconds: float
    human: str


def describe_duration(log10_seconds: float) -> DurationEstimate:
    """Turns a log10(seconds) estimate into the same kind of plain-English bucket this project
    already uses in its own warning banners ("finish in seconds" / "longer than the age of the
    universe") -- computed from the actual log10 value, not a separate hand-picked threshold list
    that could silently drift out of sync with it."""
    if log10_seconds >= AGE_OF_UNIVERSE_LOG10_SECONDS:
        orders = log10_seconds - AGE_OF_UNIVERSE_LOG10_SECONDS
        if orders < 0.05:
            human = "about as long as the universe has existed"
        else:
            human = f"~10^{orders:.0f} times the age of the universe"
        return DurationEstimate(log10_seconds, human)

    seconds = 10**log10_seconds
    if seconds < 1:
        human = "under a second"
    elif seconds < 60:
        human = f"{seconds:.1f} seconds"
    elif seconds < 3600:
        human = f"{seconds / 60:.1f} minutes"
    elif seconds < 86400:
        human = f"{seconds / 3600:.1f} hours"
    elif seconds < SECONDS_PER_YEAR:
        human = f"{seconds / 86400:.1f} days"
    else:
        years = seconds / SECONDS_PER_YEAR
        human = f"{years:,.0f} years" if years < 1_000_000 else f"{years:.2e} years"
    return DurationEstimate(log10_seconds, human)
