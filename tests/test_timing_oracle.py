from attacker.timing_oracle import (
    TimingScenarioResult,
    _compare,
    measure_oaep_timing,
    measure_pkcs7_timing,
)


def test_compare_flags_a_large_synthetic_gap_as_statistically_real():
    # Synthetic, deterministic data (not a real timing measurement) -- isolates _compare's own
    # statistics from the inherent noise of actually measuring wall-clock time.
    results = [
        TimingScenarioResult("fast", mean_ns=1000, median_ns=1000, min_ns=950, stddev_ns=10),
        TimingScenarioResult("slow", mean_ns=5000, median_ns=5000, min_ns=4950, stddev_ns=10),
    ]
    comparison = _compare(results, trials=1000)
    assert comparison.gap_ns == 4000
    assert comparison.gap_in_std_errors > 3
    assert "statistically real" in comparison.verdict


def test_compare_flags_a_small_synthetic_gap_as_noise():
    results = [
        TimingScenarioResult("a", mean_ns=1000, median_ns=1000, min_ns=900, stddev_ns=500),
        TimingScenarioResult("b", mean_ns=1010, median_ns=1010, min_ns=910, stddev_ns=500),
    ]
    comparison = _compare(results, trials=100)
    assert comparison.gap_in_std_errors < 1
    assert "not distinguishable" in comparison.verdict


def test_compare_handles_zero_stddev_without_dividing_by_zero():
    results = [
        TimingScenarioResult("a", mean_ns=1000, median_ns=1000, min_ns=1000, stddev_ns=0),
        TimingScenarioResult("b", mean_ns=1000, median_ns=1000, min_ns=1000, stddev_ns=0),
    ]
    comparison = _compare(results, trials=100)
    assert comparison.gap_in_std_errors == 0.0


def test_measure_pkcs7_timing_returns_three_real_scenarios():
    comparison = measure_pkcs7_timing(trials=200)
    labels = {s.label for s in comparison.scenarios}
    assert labels == {
        "valid padding",
        "corrupted length byte (rejected immediately)",
        "corrupted content, valid length (rejected after a full compare)",
    }
    assert all(s.mean_ns > 0 for s in comparison.scenarios)
    assert comparison.verdict  # some verdict string was produced, whatever this run measured


def test_measure_oaep_timing_returns_three_real_scenarios():
    comparison = measure_oaep_timing(trials=200)
    labels = {s.label for s in comparison.scenarios}
    assert labels == {"valid OAEP block", "corrupted leading byte", "corrupted deep structural byte"}
    assert all(s.mean_ns > 0 for s in comparison.scenarios)
