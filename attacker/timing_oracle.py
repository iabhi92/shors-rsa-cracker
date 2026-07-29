"""Empirically measures whether this project's own padding-validation code actually leaks timing
information about *why* a ciphertext was rejected -- turning the "NOT constant-time" caveat
already in rsa/core.py's _pkcs7_unpad docstring and rsa/oaep.py's own comments into a live,
statistically measured demonstration instead of an assertion nobody can check.

This is the real mechanism behind a Bleichenbacher-style padding-oracle attack: an attacker who
can only observe *how long* a decryption attempt took (never the plaintext, never even a
valid/invalid flag) can still learn *where* validation failed, one probe at a time, and chain
enough of those probes into a full decryption oracle. The classic defense is uniform work: run
every check regardless of whether an earlier one already failed, so there's nothing left for
timing to leak.

Two real code paths, two real outcomes:
  - rsa/core.py's _pkcs7_unpad rejects a bad length byte *before* ever touching the padding
    content -- an early exit that skips real work, and should show up as a real timing gap.
  - rsa/oaep.py's oaep_decode always runs all four of its structural checks before combining
    them, specifically to avoid this -- see this module's own measurement of it below.
"""

import math
import statistics
import time
from collections.abc import Callable
from dataclasses import dataclass

from rsa.core import _pkcs7_pad, _pkcs7_unpad
from rsa.oaep import OaepError, oaep_decode, oaep_encode


@dataclass(frozen=True)
class TimingScenarioResult:
    label: str
    mean_ns: float
    median_ns: float
    min_ns: float
    stddev_ns: float


@dataclass(frozen=True)
class TimingComparison:
    scenarios: list[TimingScenarioResult]
    gap_ns: float
    gap_percent: float
    gap_in_std_errors: float
    verdict: str


def _measure(fn: Callable[[], None], trials: int) -> tuple[float, float, float, float]:
    # A short warmup pass first -- not to "JIT warm up" (CPython has no JIT), but so the very
    # first real sample isn't inflated by one-off costs (import caching, memory allocator
    # warmup) that have nothing to do with the code path actually being measured.
    for _ in range(min(50, trials)):
        fn()
    samples = []
    for _ in range(trials):
        start = time.perf_counter_ns()
        fn()
        samples.append(time.perf_counter_ns() - start)
    mean = statistics.mean(samples)
    median = statistics.median(samples)
    minimum = min(samples)
    stdev = statistics.stdev(samples) if len(samples) > 1 else 0.0
    return mean, median, minimum, stdev


def _compare(results: list[TimingScenarioResult], trials: int) -> TimingComparison:
    """Compares each scenario's *median*, not its mean -- a single slow trial (a GC pause, an OS
    scheduling hiccup) can drag a mean upward by far more than the real effect being measured
    ever could, and this project measured that happening live while building this: one
    early-exit scenario's mean came out *higher* than a scenario doing strictly more work, purely
    from noise, while its median still correctly showed it as the fastest. Real timing-attack
    research (e.g. Brumley & Boneh, "Remote timing attacks are practical") leans on exactly this
    kind of robust statistic -- typically the minimum across repeated trials -- for the same
    reason: scheduling noise can only ever add delay, never subtract it below the true cost.
    Significance is still expressed in standard-error units (computed from the mean/stdev, the
    only inputs available for a real standard-error formula), so it stays a real, checkable
    number rather than an eyeballed bar-chart gap. """
    slowest = max(results, key=lambda r: r.median_ns)
    fastest = min(results, key=lambda r: r.median_ns)
    gap_ns = slowest.median_ns - fastest.median_ns
    gap_percent = (gap_ns / fastest.median_ns * 100) if fastest.median_ns > 0 else 0.0
    se_slowest = slowest.stddev_ns / math.sqrt(trials)
    se_fastest = fastest.stddev_ns / math.sqrt(trials)
    pooled_se = math.sqrt(se_slowest**2 + se_fastest**2)
    gap_in_std_errors = gap_ns / pooled_se if pooled_se > 0 else 0.0

    if gap_in_std_errors > 3:
        verdict = "statistically real: this gap is very unlikely to be measurement noise"
    elif gap_in_std_errors > 1:
        verdict = "borderline: a real gap may exist but this sample size can't confirm it confidently"
    else:
        verdict = "not distinguishable from noise at this sample size"

    return TimingComparison(scenarios=results, gap_ns=gap_ns, gap_percent=gap_percent, gap_in_std_errors=gap_in_std_errors, verdict=verdict)


def measure_pkcs7_timing(trials: int, block_size: int = 16) -> TimingComparison:
    """rsa/core.py's real _pkcs7_unpad, timed against three real inputs: valid padding, padding
    with a corrupted length byte (rejected before the content is ever compared), and padding
    with a valid length byte but corrupted content (rejected only after a full comparison)."""
    # A message length that's an exact multiple of block_size forces a full block of padding
    # (pad_len == block_size), leaving room to corrupt a content byte distinct from the length
    # byte itself.
    message = b"x" * block_size
    valid = _pkcs7_pad(message, block_size)
    pad_len = valid[-1]

    corrupted_length = bytearray(valid)
    corrupted_length[-1] = 0  # 0 is outside the valid [1, block_size] range -- fails the first guard
    corrupted_length = bytes(corrupted_length)

    corrupted_content = bytearray(valid)
    corrupted_content[-pad_len] ^= 0xFF  # the *first* byte of the padding run, length byte untouched
    corrupted_content = bytes(corrupted_content)

    def try_unpad(data: bytes) -> Callable[[], None]:
        def call() -> None:
            try:
                _pkcs7_unpad(data, block_size)
            except ValueError:
                pass

        return call

    results = [
        TimingScenarioResult("valid padding", *_measure(try_unpad(valid), trials)),
        TimingScenarioResult("corrupted length byte (rejected immediately)", *_measure(try_unpad(corrupted_length), trials)),
        TimingScenarioResult("corrupted content, valid length (rejected after a full compare)", *_measure(try_unpad(corrupted_content), trials)),
    ]
    return _compare(results, trials)


def measure_oaep_timing(trials: int, k: int = 128) -> TimingComparison:
    """rsa/oaep.py's real oaep_decode, timed against the same shape of inputs -- a leading-byte
    corruption (the very first thing checked) and a deep structural corruption (the label hash),
    to see whether always running all four checks (rather than returning on the first failure)
    actually closes the gap _pkcs7_unpad has."""
    encoded = bytearray(oaep_encode(b"attack at dawn", k, seed=b"\x01" * 32))

    corrupted_leading_byte = bytearray(encoded)
    corrupted_leading_byte[0] ^= 0xFF
    corrupted_leading_byte = bytes(corrupted_leading_byte)

    corrupted_deep = bytearray(encoded)
    corrupted_deep[40] ^= 0xFF  # inside masked_db, past the leading byte and masked seed
    corrupted_deep = bytes(corrupted_deep)

    def try_decode(data: bytes) -> Callable[[], None]:
        def call() -> None:
            try:
                oaep_decode(data, k)
            except OaepError:
                pass

        return call

    results = [
        TimingScenarioResult("valid OAEP block", *_measure(try_decode(bytes(encoded)), trials)),
        TimingScenarioResult("corrupted leading byte", *_measure(try_decode(corrupted_leading_byte), trials)),
        TimingScenarioResult("corrupted deep structural byte", *_measure(try_decode(corrupted_deep), trials)),
    ]
    return _compare(results, trials)
