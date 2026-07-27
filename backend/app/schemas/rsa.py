from pydantic import BaseModel, Field

from backend.app.limits import RSA_MAX_BITS, RSA_MAX_MESSAGE_BYTES, RSA_MIN_BITS


class KeygenRequest(BaseModel):
    bits: int = Field(default=16, ge=RSA_MIN_BITS, le=RSA_MAX_BITS, description="Target modulus size in bits")


class KeygenResponse(BaseModel):
    p: int
    q: int
    n: int
    e: int
    d: int
    phi: int
    n_bits: int
    warning: str = (
        "Educational key size only. Real RSA uses 2048+ bit keys; this key is intentionally "
        "small enough that the classical/quantum attack labs on this site can break it in "
        "seconds -- see /security for why."
    )


class EncryptRequest(BaseModel):
    message: str = Field(..., min_length=0, max_length=RSA_MAX_MESSAGE_BYTES)
    n: int
    e: int


class EncryptResponse(BaseModel):
    ciphertext: list[int]
    block_size_bytes: int


class DecryptRequest(BaseModel):
    ciphertext: list[int]
    n: int
    d: int


class DecryptResponse(BaseModel):
    plaintext: str
