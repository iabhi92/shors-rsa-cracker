import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from attacker.parity_oracle import recover_via_parity_oracle
from rsa.core import decrypt_int, encrypt_int
from rsa.keygen import generate_keypair


def _real_oracle(private_key):
    def oracle(c: int) -> int:
        return decrypt_int(c, private_key) % 2

    return oracle


def test_recovers_a_known_small_message():
    kp = generate_keypair(24)
    message = 7 % kp.public.n
    c = encrypt_int(message, kp.public)

    result = recover_via_parity_oracle(c, kp.public, _real_oracle(kp.private))

    assert result.recovered_message == message
    assert result.total_queries == kp.public.n.bit_length()
    # The oracle attack function was never handed d -- only the public key and the oracle
    # closure, which itself is the only thing that ever touches kp.private in this test.


def test_recovers_message_zero():
    kp = generate_keypair(20)
    c = encrypt_int(0, kp.public)
    result = recover_via_parity_oracle(c, kp.public, _real_oracle(kp.private))
    assert result.recovered_message == 0


def test_recovers_message_n_minus_one():
    kp = generate_keypair(20)
    message = kp.public.n - 1
    c = encrypt_int(message, kp.public)
    result = recover_via_parity_oracle(c, kp.public, _real_oracle(kp.private))
    assert result.recovered_message == message


def test_query_count_matches_modulus_bit_length():
    kp = generate_keypair(16)
    c = encrypt_int(3, kp.public)
    result = recover_via_parity_oracle(c, kp.public, _real_oracle(kp.private))
    assert result.total_queries == kp.public.n.bit_length()
    assert len(result.queries) == result.total_queries


def test_final_interval_converges_to_the_recovered_message():
    kp = generate_keypair(20)
    message = 12345 % kp.public.n
    c = encrypt_int(message, kp.public)
    result = recover_via_parity_oracle(c, kp.public, _real_oracle(kp.private))
    last = result.queries[-1]
    assert last.lo <= result.recovered_message <= last.hi


def test_oracle_returning_invalid_value_raises():
    kp = generate_keypair(16)
    c = encrypt_int(5, kp.public)
    with pytest.raises(ValueError, match="oracle must return 0 or 1"):
        recover_via_parity_oracle(c, kp.public, lambda _c: 2)


@given(bits_each=st.integers(min_value=8, max_value=12), raw_message=st.integers(min_value=0, max_value=10_000))
@settings(max_examples=25, deadline=None)
def test_property_recovers_arbitrary_messages_across_random_keys(bits_each: int, raw_message: int):
    kp = generate_keypair(bits_each * 2)
    message = raw_message % kp.public.n
    c = encrypt_int(message, kp.public)
    result = recover_via_parity_oracle(c, kp.public, _real_oracle(kp.private))
    assert result.recovered_message == message
