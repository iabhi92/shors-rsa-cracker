import math

import pytest

from attacker.extrapolation import (
    AGE_OF_UNIVERSE_LOG10_SECONDS,
    describe_duration,
    extrapolate_log10_seconds,
)


def test_extrapolate_at_reference_point_is_unchanged():
    # Extrapolating to the exact bit size you measured at should return that exact value.
    log10_seconds = extrapolate_log10_seconds(reference_bits=48, reference_seconds=0.5493, target_bits=48, growth_exponent=0.5)
    assert log10_seconds == pytest.approx(math.log10(0.5493))


def test_trial_division_doubles_time_every_two_bits():
    # O(sqrt(n)): n doubles every bit, so sqrt(n) doubles every 2 bits -- exactly one more
    # factor of 2 in wall-clock time, i.e. +log10(2) in log space.
    base = extrapolate_log10_seconds(reference_bits=48, reference_seconds=1.0, target_bits=48, growth_exponent=0.5)
    plus_two_bits = extrapolate_log10_seconds(reference_bits=48, reference_seconds=1.0, target_bits=50, growth_exponent=0.5)
    assert plus_two_bits - base == pytest.approx(math.log10(2))


def test_pollards_rho_doubles_time_every_four_bits():
    # O(n^(1/4)): doubles every 4 bits instead of every 2.
    base = extrapolate_log10_seconds(reference_bits=48, reference_seconds=1.0, target_bits=48, growth_exponent=0.25)
    plus_four_bits = extrapolate_log10_seconds(reference_bits=48, reference_seconds=1.0, target_bits=52, growth_exponent=0.25)
    assert plus_four_bits - base == pytest.approx(math.log10(2))


def test_extrapolate_rejects_nonpositive_reference_seconds():
    with pytest.raises(ValueError, match="must be positive"):
        extrapolate_log10_seconds(reference_bits=48, reference_seconds=0, target_bits=100, growth_exponent=0.5)


def test_describe_duration_under_a_second():
    assert describe_duration(math.log10(0.4)).human == "under a second"


def test_describe_duration_seconds_bucket():
    d = describe_duration(math.log10(5))
    assert "second" in d.human


def test_describe_duration_years_bucket():
    d = describe_duration(math.log10(50 * 365.25 * 24 * 3600))
    assert "years" in d.human
    assert "50" in d.human


def test_describe_duration_past_age_of_universe_uses_order_of_magnitude():
    # A real RSA-2048-scale extrapolation: astronomically past any human timescale.
    d = describe_duration(300.0)
    assert "times the age of the universe" in d.human
    assert d.log10_seconds == 300.0


def test_describe_duration_at_exactly_the_age_of_the_universe():
    d = describe_duration(AGE_OF_UNIVERSE_LOG10_SECONDS)
    assert d.human == "about as long as the universe has existed"
