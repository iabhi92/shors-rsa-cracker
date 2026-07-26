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
    return (n.bit_length() - 1) // 8


def encrypt_int(m: int, public_key: PublicKey) -> int:
    if not (0 <= m < public_key.n):
        raise ValueError("message integer must satisfy 0 <= m < n")
    return pow(m, public_key.e, public_key.n)


def decrypt_int(c: int, private_key: PrivateKey) -> int:
    return pow(c, private_key.d, private_key.n)


def _pkcs7_pad(data: bytes, block_size: int) -> bytes:
    pad_len = block_size - (len(data) % block_size)
    return data + bytes([pad_len]) * pad_len


def _pkcs7_unpad(data: bytes) -> bytes:
    pad_len = data[-1]
    return data[:-pad_len]


def encrypt_bytes(message: bytes, public_key: PublicKey) -> list[int]:
    """Encrypt an arbitrary-length byte string as a list of RSA block ciphertexts."""
    block_size = _block_size(public_key.n)
    padded = _pkcs7_pad(message, block_size)
    blocks = [padded[i : i + block_size] for i in range(0, len(padded), block_size)]
    return [encrypt_int(int.from_bytes(b, "big"), public_key) for b in blocks]


def decrypt_bytes(ciphertext: list[int], private_key: PrivateKey) -> bytes:
    """Inverse of encrypt_bytes."""
    block_size = _block_size(private_key.n)
    plain_blocks = [
        decrypt_int(c, private_key).to_bytes(block_size, "big") for c in ciphertext
    ]
    return _pkcs7_unpad(b"".join(plain_blocks))


def encrypt_text(message: str, public_key: PublicKey) -> list[int]:
    return encrypt_bytes(message.encode("utf-8"), public_key)


def decrypt_text(ciphertext: list[int], private_key: PrivateKey) -> str:
    return decrypt_bytes(ciphertext, private_key).decode("utf-8")
