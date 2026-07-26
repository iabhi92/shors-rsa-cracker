import math

import pytest
from hypothesis import assume, given, settings
from hypothesis import strategies as st

from rsa.core import (
    _block_size,
    decrypt_bytes,
    decrypt_int,
    decrypt_text,
    encrypt_bytes,
    encrypt_int,
    encrypt_text,
)
from rsa.keygen import extended_gcd, generate_keypair, mod_inverse
from rsa.primes import generate_prime, is_prime

KNOWN_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 97, 7919]
KNOWN_COMPOSITES = [1, 4, 6, 8, 9, 15, 21, 100, 561, 1729]  # 561, 1729 are Carmichael numbers
SMALL_PRIMES_FOR_PROPERTY = [17, 97, 251, 65537, 104729]


def test_is_prime_known_primes():
    for p in KNOWN_PRIMES:
        assert is_prime(p), f"{p} should be prime"


def test_is_prime_known_composites():
    for c in KNOWN_COMPOSITES:
        assert not is_prime(c), f"{c} should be composite"


def test_is_prime_rejects_less_than_two():
    assert not is_prime(0)
    assert not is_prime(1)
    assert not is_prime(-7)


@pytest.mark.parametrize("bits", [8, 16, 32])
def test_generate_prime_has_correct_bit_length_and_is_prime(bits):
    p = generate_prime(bits)
    assert p.bit_length() == bits
    assert is_prime(p)


def test_extended_gcd():
    a, b = 240, 46
    g, x, y = extended_gcd(a, b)
    assert g == 2
    assert a * x + b * y == g


def test_mod_inverse_round_trips():
    a, m = 17, 3120
    inv = mod_inverse(a, m)
    assert (a * inv) % m == 1


def test_mod_inverse_raises_when_not_coprime():
    with pytest.raises(ValueError):
        mod_inverse(6, 9)


@pytest.mark.parametrize("bits", [64, 128])
def test_generate_keypair_is_internally_consistent(bits):
    kp = generate_keypair(bits)
    assert kp.p != kp.q
    assert is_prime(kp.p)
    assert is_prime(kp.q)
    assert kp.public.n == kp.p * kp.q
    assert kp.private.n == kp.public.n
    phi = (kp.p - 1) * (kp.q - 1)
    assert (kp.public.e * kp.private.d) % phi == 1


def test_encrypt_decrypt_int_round_trip():
    kp = generate_keypair(128)
    m = 42
    c = encrypt_int(m, kp.public)
    assert c != m
    assert decrypt_int(c, kp.private) == m


def test_encrypt_int_rejects_out_of_range_message():
    kp = generate_keypair(64)
    with pytest.raises(ValueError):
        encrypt_int(kp.public.n, kp.public)


def test_encrypt_bytes_on_modulus_too_small_for_one_byte_raises_clear_error():
    # n=35 (5 bits) can't hold even a single byte (0-255); this must fail loudly with a
    # clear message, not a bare ZeroDivisionError from the block-size arithmetic.
    from rsa.keygen import PublicKey

    with pytest.raises(ValueError, match="too small"):
        encrypt_bytes(b"hi", PublicKey(n=35, e=5))


def test_encrypt_decrypt_text_round_trip_short_message():
    kp = generate_keypair(256)
    plaintext = "hi"
    ciphertext = encrypt_text(plaintext, kp.public)
    assert decrypt_text(ciphertext, kp.private) == plaintext


def test_encrypt_decrypt_text_round_trip_long_message_spans_blocks():
    kp = generate_keypair(256)
    plaintext = "The quick brown fox jumps over the lazy dog. " * 5
    ciphertext = encrypt_text(plaintext, kp.public)
    assert len(ciphertext) > 1
    assert decrypt_text(ciphertext, kp.private) == plaintext


def test_textbook_rsa_is_deterministic_same_block_same_ciphertext():
    kp = generate_keypair(256)
    c1 = encrypt_text("AAAAAAAAAAAAAAAA", kp.public)
    c2 = encrypt_text("AAAAAAAAAAAAAAAA", kp.public)
    assert c1 == c2  # demonstrates the textbook-RSA weakness noted in rsa/core.py


# --- Edge cases around block boundaries and encoding ---------------------------------


@pytest.fixture(scope="module")
def keypair():
    return generate_keypair(256)


def test_encrypt_decrypt_empty_message(keypair):
    ciphertext = encrypt_bytes(b"", keypair.public)
    assert decrypt_bytes(ciphertext, keypair.private) == b""


def test_encrypt_decrypt_message_exactly_one_block(keypair):
    block_size = _block_size(keypair.public.n)
    message = b"\x42" * block_size
    ciphertext = encrypt_bytes(message, keypair.public)
    assert decrypt_bytes(ciphertext, keypair.private) == message


def test_encrypt_decrypt_message_exactly_multiple_blocks(keypair):
    block_size = _block_size(keypair.public.n)
    message = (b"x" * block_size) * 3  # exactly 3 full blocks before padding
    ciphertext = encrypt_bytes(message, keypair.public)
    # a message that's already block-aligned still gets a full block of padding (PKCS7 rule)
    assert len(ciphertext) == 4
    assert decrypt_bytes(ciphertext, keypair.private) == message


def test_encrypt_decrypt_message_ending_in_byte_that_looks_like_padding(keypair):
    # PKCS7 unpadding trusts the last byte; make sure real data ending in e.g. 0x01
    # doesn't get misinterpreted before the padding we appended.
    message = b"end of message is one byte: \x01"
    ciphertext = encrypt_bytes(message, keypair.public)
    assert decrypt_bytes(ciphertext, keypair.private) == message


def test_encrypt_decrypt_text_round_trip_multibyte_unicode(keypair):
    plaintext = "Attack at dawn — 攻撃は夜明けに 🔐"
    ciphertext = encrypt_text(plaintext, keypair.public)
    assert decrypt_text(ciphertext, keypair.private) == plaintext


def test_every_ciphertext_block_is_within_modulus_range(keypair):
    ciphertext = encrypt_text("some reasonably long test message here", keypair.public)
    for block in ciphertext:
        assert 0 <= block < keypair.public.n


# --- Property-based tests (hypothesis) -------------------------------------------------


@settings(max_examples=200, deadline=None)
@given(a=st.integers(min_value=0, max_value=10**9), b=st.integers(min_value=1, max_value=10**9))
def test_extended_gcd_property(a, b):
    g, x, y = extended_gcd(a, b)
    assert g == math.gcd(a, b)
    assert a * x + b * y == g


@settings(max_examples=100, deadline=None)
@given(m=st.sampled_from(SMALL_PRIMES_FOR_PROPERTY), a=st.integers(min_value=1, max_value=10**9))
def test_mod_inverse_property(m, a):
    assume(a % m != 0)
    inv = mod_inverse(a, m)
    assert 0 <= inv < m
    assert (a * inv) % m == 1


@settings(max_examples=25, deadline=None)
@given(data=st.binary(min_size=0, max_size=300))
def test_encrypt_decrypt_bytes_round_trip_property(keypair, data):
    ciphertext = encrypt_bytes(data, keypair.public)
    assert decrypt_bytes(ciphertext, keypair.private) == data
