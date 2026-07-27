"""Textbook RSA encrypt/decrypt, built from scratch.

WARNING (intentional, for this project): this is "textbook" RSA — plain modular
exponentiation with no padding scheme (no OAEP). It is deterministic (same plaintext
block always encrypts to the same ciphertext block) and malleable. Real-world RSA
(TLS, etc.) always wraps this core operation in padding specifically to defend against
attacks that don't need to touch the math at all. We're implementing the bare
mathematical primitive on purpose, since the point of this project is to attack that
primitive directly (classically and via a simulated quantum computer) rather than any
particular padding scheme.
"""

from rsa.keygen import PrivateKey, PublicKey


def _block_size(n: int) -> int:
    """Largest number of bytes guaranteed to encode to an integer < n."""
    size = (n.bit_length() - 1) // 8
    if size == 0:
        raise ValueError(
            f"n={n} ({n.bit_length()} bits) is too small to hold even one byte of message "
            "(need n > 255); use encrypt_int/decrypt_int directly for keys this small"
        )
    return size


def encrypt_int(m: int, public_key: PublicKey) -> int:
    if not (0 <= m < public_key.n):
        raise ValueError("message integer must satisfy 0 <= m < n")
    return pow(m, public_key.e, public_key.n)


def decrypt_int(c: int, private_key: PrivateKey) -> int:
    return pow(c, private_key.d, private_key.n)


def _pkcs7_pad(data: bytes, block_size: int) -> bytes:
    pad_len = block_size - (len(data) % block_size)
    return data + bytes([pad_len]) * pad_len


def _pkcs7_unpad(data: bytes, block_size: int) -> bytes:
    """Inverse of _pkcs7_pad. Validates the padding shape (pad_len in [1, block_size], and
    every one of the last pad_len bytes actually equal to pad_len) instead of trusting
    data[-1] blindly. An earlier version didn't validate, and had two real bugs on malformed
    input: a decrypted block whose last byte happened to be 0x00 made pad_len=0, and Python's
    data[:-0] slices to data[:0] (empty bytes) rather than "no truncation" — silently
    returning an empty message instead of raising; a pad_len larger than len(data) similarly
    sliced silently rather than raising. Both are exactly the kind of malformed/attacker-
    influenced input this project's threat model cares about (see rsa/core.py's module
    docstring and SECURITY.md): decrypting an arbitrary or bit-flipped ciphertext block
    (textbook RSA is malleable) must fail loudly, not silently return wrong plaintext.

    Still NOT constant-time: real systems decrypting attacker-controlled ciphertext need
    constant-time padding checks to avoid a Bleichenbacher-style padding-oracle timing side
    channel, which this raise-early-on-invalid-padding shape does not provide (see
    SECURITY.md). Fixing that timing channel is out of scope for what padding validation
    alone can do — it needs a redesigned, constant-time comparison, which this project
    doesn't attempt since real-world RSA avoids the whole padding-oracle class differently
    (OAEP) rather than patching textbook PKCS7 to be timing-safe.
    """
    if not data or not (1 <= data[-1] <= block_size):
        raise ValueError("invalid PKCS7 padding")
    pad_len = data[-1]
    if data[-pad_len:] != bytes([pad_len]) * pad_len:
        raise ValueError("invalid PKCS7 padding")
    return data[:-pad_len]


def encrypt_bytes(message: bytes, public_key: PublicKey) -> list[int]:
    """Encrypt an arbitrary-length byte string as a list of RSA block ciphertexts."""
    block_size = _block_size(public_key.n)
    padded = _pkcs7_pad(message, block_size)
    blocks = [padded[i : i + block_size] for i in range(0, len(padded), block_size)]
    return [encrypt_int(int.from_bytes(b, "big"), public_key) for b in blocks]


def decrypt_bytes(ciphertext: list[int], private_key: PrivateKey) -> bytes:
    """Inverse of encrypt_bytes.

    A legitimately encrypted block always decrypts to a value < 256**block_size (that's how
    encrypt_bytes built it), but block_size = (n.bit_length() - 1) // 8 is strictly smaller
    than n itself -- so decrypt_int can return any value up to n-1, and some of that range
    (256**block_size <= m < n) does NOT fit in block_size bytes. A correctly-encrypted
    ciphertext block never lands there, but a tampered or attacker-crafted one can (found via
    this project's own bit-flip tamper demo: an early version of this function called
    `.to_bytes(block_size, "big")` unconditionally and crashed with an unhandled OverflowError
    -- a 500, not a clean rejection -- on exactly that input). Validated explicitly instead, so
    malformed ciphertext fails loudly with ValueError like every other case _pkcs7_unpad
    already guards.
    """
    block_size = _block_size(private_key.n)
    plain_blocks = []
    for c in ciphertext:
        m = decrypt_int(c, private_key)
        if m >= 256**block_size:
            raise ValueError("decrypted block does not fit in the expected block size (corrupted ciphertext)")
        plain_blocks.append(m.to_bytes(block_size, "big"))
    return _pkcs7_unpad(b"".join(plain_blocks), block_size)


def encrypt_text(message: str, public_key: PublicKey) -> list[int]:
    return encrypt_bytes(message.encode("utf-8"), public_key)


def decrypt_text(ciphertext: list[int], private_key: PrivateKey) -> str:
    return decrypt_bytes(ciphertext, private_key).decode("utf-8")
