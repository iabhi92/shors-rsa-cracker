"""RSA-OAEP encoding/decoding (RFC 8017 section 7.1), built from scratch on top of hashlib --
not a stand-in for what real padding does, the actual scheme. Exists so the Malleability Lab can
show the honest answer to "doesn't padding fix this?": the multiplicative attack in
security_demo.py's malleability() still runs unchanged (it operates purely on the ciphertext
integer, before any of this ever gets involved) -- what OAEP actually buys you is that the
*victim's* decryption of the tampered ciphertext fails loudly (a corrupted OAEP structure raises
ValueError) instead of silently handing back attacker-controlled plaintext. Padding doesn't
prevent the ciphertext algebra; it prevents an undetected result.

OAEP needs real room to work: with SHA-256 (32-byte digest), the modulus must be at least
2*32 + 2 = 66 bytes (528 bits) just to fit an empty message, which is why the Malleability Lab's
OAEP toggle requires its own, much larger keypair than this project's usual 8-24 bit teaching
keys -- there's no way to shrink that requirement without using a smaller (and no longer real)
hash, and this project doesn't fake primitives to hit a smaller number.
"""

import hashlib
import hmac
import secrets

HASH_LEN = hashlib.sha256().digest_size  # 32


def mgf1(seed: bytes, length: int) -> bytes:
    """Mask generation function 1 (RFC 8017 appendix B.2.1), using SHA-256."""
    output = b""
    counter = 0
    while len(output) < length:
        counter_bytes = counter.to_bytes(4, "big")
        output += hashlib.sha256(seed + counter_bytes).digest()
        counter += 1
    return output[:length]


class OaepError(ValueError):
    """Raised when a decoded OAEP block fails its structural check -- the exact failure mode
    that makes the malleability attack detectable once padding is in place, instead of silently
    handing back a wrong plaintext."""


def min_modulus_bytes(label: bytes = b"") -> int:
    """The smallest RSA modulus size (in bytes) that can hold an OAEP encoding of even an empty
    message with this hash -- 2*hLen + 2. Below this, OAEP has nowhere to put its own structure,
    regardless of the message."""
    del label  # label length doesn't affect the size bound; only its hash (fixed HASH_LEN) does
    return 2 * HASH_LEN + 2


def oaep_encode(message: bytes, k: int, label: bytes = b"", seed: bytes | None = None) -> bytes:
    """Encodes `message` into a k-byte OAEP block, ready to be interpreted as an integer < 2^(8k)
    and RSA-encrypted directly (k should be exactly the modulus's byte length). `seed` is exposed
    only for deterministic testing -- real callers should never pass it (the default draws fresh
    randomness, exactly like a real OAEP encryption must to avoid two encryptions of the same
    message ever producing the same ciphertext)."""
    if k < min_modulus_bytes(label):
        raise ValueError(f"modulus is only {k} bytes; OAEP with SHA-256 needs at least {min_modulus_bytes(label)} bytes")
    max_message_len = k - 2 * HASH_LEN - 2
    if len(message) > max_message_len:
        raise ValueError(f"message is {len(message)} bytes, longer than this modulus can OAEP-encode ({max_message_len} bytes max)")

    l_hash = hashlib.sha256(label).digest()
    ps = b"\x00" * (max_message_len - len(message))
    db = l_hash + ps + b"\x01" + message

    seed = seed if seed is not None else secrets.token_bytes(HASH_LEN)
    db_mask = mgf1(seed, k - HASH_LEN - 1)
    masked_db = bytes(a ^ b for a, b in zip(db, db_mask, strict=True))
    seed_mask = mgf1(masked_db, HASH_LEN)
    masked_seed = bytes(a ^ b for a, b in zip(seed, seed_mask, strict=True))

    return b"\x00" + masked_seed + masked_db


def oaep_decode(encoded: bytes, k: int, label: bytes = b"") -> bytes:
    """Inverse of oaep_encode. Raises OaepError on any structural failure -- wrong length, a
    nonzero leading byte, an l_hash mismatch, or a missing 0x01 separator -- rather than ever
    guessing at a "best effort" plaintext. This is the actual detection mechanism the Malleability
    Lab demonstrates: a ciphertext tampered via the multiplicative attack decrypts to essentially
    random bytes, which fails one of these checks with overwhelming probability."""
    if len(encoded) != k or k < min_modulus_bytes(label):
        raise OaepError(f"encoded block has the wrong length for this modulus (expected {k} bytes)")

    y, masked_seed, masked_db = encoded[0], encoded[1 : 1 + HASH_LEN], encoded[1 + HASH_LEN :]
    seed_mask = mgf1(masked_db, HASH_LEN)
    seed = bytes(a ^ b for a, b in zip(masked_seed, seed_mask, strict=True))
    db_mask = mgf1(seed, k - HASH_LEN - 1)
    db = bytes(a ^ b for a, b in zip(masked_db, db_mask, strict=True))

    l_hash = hashlib.sha256(label).digest()
    db_l_hash, rest = db[:HASH_LEN], db[HASH_LEN:]

    # Every check below runs regardless of an earlier one already failing (accumulated into one
    # boolean rather than raising on the first mismatch) -- a real OAEP implementation avoids
    # branching on *which* check failed specifically to resist a Bleichenbacher-style padding-
    # oracle attack that distinguishes failure reasons via timing or error content. This project
    # doesn't claim full constant-time discipline (see rsa/core.py's own _pkcs7_unpad docstring
    # making the same caveat), but errors are collapsed to one generic message on principle.
    valid_leading_byte = y == 0
    valid_l_hash = hmac.compare_digest(db_l_hash, l_hash)
    separator_index = rest.find(b"\x01")
    valid_separator = separator_index != -1 and rest[:separator_index] == b"\x00" * separator_index

    if not (valid_leading_byte and valid_l_hash and valid_separator):
        raise OaepError("invalid OAEP padding (corrupted ciphertext, wrong key, or tampering)")

    return rest[separator_index + 1 :]
