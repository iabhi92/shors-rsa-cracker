import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from rsa.oaep import HASH_LEN, OaepError, min_modulus_bytes, oaep_decode, oaep_encode

K = 128  # 1024-bit modulus's worth of bytes -- comfortably above the minimum for SHA-256 OAEP


def test_min_modulus_bytes_is_two_hash_lens_plus_two():
    assert min_modulus_bytes() == 2 * HASH_LEN + 2 == 66


def test_round_trip_recovers_the_message():
    message = b"attack at dawn"
    encoded = oaep_encode(message, K, seed=b"\x01" * HASH_LEN)
    assert oaep_decode(encoded, K) == message


def test_round_trip_empty_message():
    encoded = oaep_encode(b"", K, seed=b"\x02" * HASH_LEN)
    assert oaep_decode(encoded, K) == b""


def test_round_trip_max_length_message():
    max_len = K - 2 * HASH_LEN - 2
    message = b"x" * max_len
    encoded = oaep_encode(message, K, seed=b"\x03" * HASH_LEN)
    assert oaep_decode(encoded, K) == message


def test_message_too_long_rejected():
    max_len = K - 2 * HASH_LEN - 2
    with pytest.raises(ValueError, match="longer than this modulus"):
        oaep_encode(b"x" * (max_len + 1), K)


def test_modulus_too_small_rejected():
    with pytest.raises(ValueError, match="needs at least"):
        oaep_encode(b"hi", k=HASH_LEN, label=b"")


def test_two_encodings_of_the_same_message_differ():
    # OAEP must be randomized -- two real (non-seeded) encodings of the same message should
    # produce different ciphertexts, exactly the property textbook RSA (rsa/core.py) lacks and
    # this project's determinism demo (RsaFlowVisual's "encrypt again" button) exists to show.
    a = oaep_encode(b"same message", K)
    b = oaep_encode(b"same message", K)
    assert a != b
    assert oaep_decode(a, K) == oaep_decode(b, K) == b"same message"


def test_tampering_a_byte_in_the_encoded_block_is_detected():
    encoded = oaep_encode(b"attack at dawn", K, seed=b"\x04" * HASH_LEN)
    tampered = bytearray(encoded)
    tampered[10] ^= 0xFF
    with pytest.raises(OaepError):
        oaep_decode(bytes(tampered), K)


def test_wrong_label_is_detected():
    encoded = oaep_encode(b"attack at dawn", K, label=b"session-1", seed=b"\x05" * HASH_LEN)
    with pytest.raises(OaepError):
        oaep_decode(encoded, K, label=b"session-2")


def test_wrong_length_block_rejected():
    encoded = oaep_encode(b"hi", K, seed=b"\x06" * HASH_LEN)
    with pytest.raises(OaepError):
        oaep_decode(encoded[:-1], K)


@given(st.binary(min_size=0, max_size=K - 2 * HASH_LEN - 2))
@settings(max_examples=50)
def test_round_trip_property(message: bytes):
    encoded = oaep_encode(message, K)
    assert oaep_decode(encoded, K) == message


@given(st.binary(min_size=K - 1, max_size=K - 1))
@settings(max_examples=100)
def test_random_k_byte_blocks_with_nonzero_leading_byte_always_fail_to_decode(rest: bytes):
    # The actual mechanism the malleability attack runs into once OAEP is in place: a ciphertext
    # scrambled by the multiplicative attack decrypts to essentially a uniformly random k-byte
    # block. This pins down one deterministic slice of that: any block whose leading byte isn't
    # 0x00 (255/256 of the space) is rejected outright, before label-hash or separator checks
    # even run. The remaining 1/256 (leading byte == 0) isn't deterministic either way -- it may
    # or may not stumble onto a valid label hash + separator by chance -- so it's deliberately
    # not asserted here.
    block = b"\x01" + rest
    with pytest.raises(OaepError):
        oaep_decode(block, K)
