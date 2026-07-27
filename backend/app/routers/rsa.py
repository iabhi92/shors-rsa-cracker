"""RSA laboratory endpoints -- thin wrappers around rsa/keygen.py and rsa/core.py. No
cryptographic logic lives here; this module only validates input shape/size and translates
between the project's dataclasses and JSON."""

from fastapi import APIRouter, Depends

from backend.app.errors import AppError
from backend.app.rate_limit import limiter_dependency, rsa_keygen_limiter
from backend.app.schemas.rsa import (
    DecryptRequest,
    DecryptResponse,
    EncryptRequest,
    EncryptResponse,
    KeygenRequest,
    KeygenResponse,
)
from rsa.core import _block_size, decrypt_text, encrypt_text
from rsa.keygen import PrivateKey, PublicKey, generate_keypair

router = APIRouter()


@router.post("/keygen", response_model=KeygenResponse, dependencies=[Depends(limiter_dependency(rsa_keygen_limiter))])
def keygen(req: KeygenRequest) -> KeygenResponse:
    kp = generate_keypair(req.bits)
    phi = (kp.p - 1) * (kp.q - 1)
    return KeygenResponse(
        p=kp.p, q=kp.q, n=kp.public.n, e=kp.public.e, d=kp.private.d, phi=phi, n_bits=kp.public.n.bit_length()
    )


@router.post("/encrypt", response_model=EncryptResponse)
def encrypt(req: EncryptRequest) -> EncryptResponse:
    try:
        block_size = _block_size(req.n)
    except ValueError as exc:
        raise AppError(str(exc)) from exc
    ciphertext = encrypt_text(req.message, PublicKey(n=req.n, e=req.e))
    return EncryptResponse(ciphertext=ciphertext, block_size_bytes=block_size)


@router.post("/decrypt", response_model=DecryptResponse)
def decrypt(req: DecryptRequest) -> DecryptResponse:
    plaintext = decrypt_text(req.ciphertext, PrivateKey(n=req.n, d=req.d))
    return DecryptResponse(plaintext=plaintext)
