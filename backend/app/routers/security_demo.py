"""Two live attacks against textbook RSA's *lack* of ciphertext integrity -- the property real
RSA (OAEP, or any AEAD-wrapped scheme) exists specifically to remove: multiplicative
malleability (an attacker who never sees d or m can still transform an intercepted ciphertext
by a chosen factor) and block substitution (an attacker who never sees d can splice a
self-forged block into an intercepted multi-block ciphertext, undetected). Both reuse this
project's real rsa/core.py primitives; nothing here is a mocked or precomputed result."""

from fastapi import APIRouter, Depends

from backend.app.errors import AppError
from backend.app.rate_limit import dashboard_demo_limiter, limiter_dependency
from backend.app.schemas.security_demo import (
    MalleabilityRequest,
    MalleabilityResponse,
    RateLimitPingResponse,
    TamperRequest,
    TamperResponse,
)
from rsa.core import _block_size, decrypt_bytes, decrypt_int, encrypt_bytes, encrypt_int
from rsa.keygen import PrivateKey, PublicKey

router = APIRouter()


@router.post("/malleability", response_model=MalleabilityResponse)
def malleability(req: MalleabilityRequest) -> MalleabilityResponse:
    if not (0 <= req.message_int < req.n):
        raise AppError(f"message_int must satisfy 0 <= m < n (n={req.n})")

    pub = PublicKey(n=req.n, e=req.e)
    priv = PrivateKey(n=req.n, d=req.d)

    # The victim encrypts m normally.
    c = encrypt_int(req.message_int, pub)

    # The attacker, holding ONLY the public key (n, e) and the intercepted ciphertext c --
    # never d, never m -- multiplies in a blinding factor s. This is legal RSA math, not a
    # bug in this implementation: (m^e)(s^e) = (m*s)^e (mod n) for any e, by definition of
    # modular exponentiation, so c' decrypts as if m had been multiplied by s all along.
    s_pow_e = pow(req.blind_factor, req.e, req.n)
    c_tampered = (c * s_pow_e) % req.n

    # The victim decrypts c' exactly as they would any other ciphertext -- they have no way
    # to know it was tampered with, because textbook RSA carries no integrity check at all.
    m_recovered = decrypt_int(c, priv)
    m_tampered = decrypt_int(c_tampered, priv)
    expected = (req.message_int * req.blind_factor) % req.n

    return MalleabilityResponse(
        original_ciphertext=c,
        tampered_ciphertext=c_tampered,
        original_plaintext=m_recovered,
        tampered_plaintext=m_tampered,
        expected_tampered_plaintext=expected,
        matches_prediction=m_tampered == expected,
        explanation=(
            f"Without ever seeing d or m, the attacker turned an encryption of {req.message_int} "
            f"into an encryption of {req.message_int} * {req.blind_factor} mod n = {expected}, "
            "by multiplying the ciphertext by s^e mod n. This is why real RSA always uses "
            "padding (OAEP): padding destroys the algebraic structure (m^e)(s^e) = (ms)^e that "
            "this attack depends on."
        ),
    )


@router.post("/tamper", response_model=TamperResponse)
def tamper(req: TamperRequest) -> TamperResponse:
    pub = PublicKey(n=req.n, e=req.e)
    priv = PrivateKey(n=req.n, d=req.d)
    block_size = _block_size(req.n)

    blocks = encrypt_bytes(req.message.encode("utf-8"), pub)
    if len(blocks) < 2:
        raise AppError(
            "message is too short to span more than one block -- lengthen it so there's a "
            "non-final block available to splice a forged block into"
        )
    if req.block_index > len(blocks) - 2:
        raise AppError(
            f"block_index must target a non-final block (message has {len(blocks)} blocks; "
            f"valid range is 0..{len(blocks) - 2}) -- the final block carries PKCS7 padding "
            "metadata, so splicing over it doesn't reliably demonstrate an undetected substitution"
        )

    forged_bytes = req.forged_block_text.encode("utf-8")
    if len(forged_bytes) > block_size:
        raise AppError(
            f"forged_block_text encodes to {len(forged_bytes)} bytes, more than this key's "
            f"block size of {block_size} bytes -- use shorter text"
        )
    forged_bytes_padded = forged_bytes.ljust(block_size, b" ")

    # The attacker's entire forgery step: encrypt a block of their own choosing using ONLY
    # the public key (n, e). They never see d, and never see the real plaintext for this
    # block -- yet the forged block will decrypt cleanly, because it's genuinely a valid RSA
    # ciphertext for a validly-sized message.
    forged_ciphertext_block = encrypt_int(int.from_bytes(forged_bytes_padded, "big"), pub)

    tampered_blocks = list(blocks)
    tampered_blocks[req.block_index] = forged_ciphertext_block

    # Deterministic by construction: the forged block fits exactly in block_size bytes, and
    # the untouched final block still carries valid PKCS7 padding, so this always succeeds --
    # unlike a raw ciphertext bit-flip (which an earlier version of this demo used), whose
    # fate depends unpredictably on the key's bit length modulo 8.
    tampered_plaintext = decrypt_bytes(tampered_blocks, priv).decode("utf-8", errors="replace")

    return TamperResponse(
        block_size_bytes=block_size,
        total_blocks=len(blocks),
        original_ciphertext=blocks,
        tampered_ciphertext=tampered_blocks,
        forged_block_index=req.block_index,
        forged_block_plaintext=forged_bytes_padded.decode("utf-8", errors="replace"),
        original_plaintext=req.message,
        tampered_plaintext=tampered_plaintext,
        explanation=(
            f"Block {req.block_index} of {len(blocks)} was replaced with an attacker-forged "
            "block encrypted using ONLY the public key -- the attacker never touched d or the "
            "real plaintext for that block. Decryption completed without any error: every "
            "block, forged or genuine, decrypted to a validly-sized plaintext block, so nothing "
            "in textbook RSA's decrypt path had a reason to object. Real systems prevent this "
            "with a MAC (or an AEAD construction) over the whole ciphertext, which textbook RSA "
            "deliberately doesn't have."
        ),
    )


@router.get(
    "/rate-limit-ping",
    response_model=RateLimitPingResponse,
    dependencies=[Depends(limiter_dependency(dashboard_demo_limiter))],
)
def rate_limit_ping() -> RateLimitPingResponse:
    """A trivial, real endpoint guarded by its own tiny 5-requests/15s limiter -- exists so the
    Security Dashboard's live rate-limit demo can trip a real 429 in front of a visitor within
    a few seconds, without spending down the budget any other page's actual functionality
    (RSA keygen, classical attacks, Shor's algorithm) depends on."""
    return RateLimitPingResponse(ok=True, message="request accepted")
