from pydantic import BaseModel, Field

from backend.app.limits import RSA_MAX_MESSAGE_BYTES


class MalleabilityRequest(BaseModel):
    """Everything needed to replay the classic no-padding-integrity attack against textbook
    RSA: an attacker who intercepts a ciphertext c = m^e mod n, with NO knowledge of m or the
    private key d, can compute c' = c * s^e mod n for a blinding factor s of their choosing.
    When the legitimate holder of d decrypts c', they get m*s mod n -- the attacker fully
    controls the multiplicative relationship of the recovered plaintext despite never touching
    the private key. This is the textbook reason real RSA always uses padding (OAEP): padding
    breaks the algebraic structure this attack depends on.
    """

    n: int
    e: int
    d: int
    message_int: int = Field(..., ge=0, description="Plaintext as a raw integer, 0 <= m < n")
    blind_factor: int = Field(..., ge=2, description="The attacker-chosen multiplier s, s >= 2")


class MalleabilityResponse(BaseModel):
    original_ciphertext: int
    tampered_ciphertext: int
    original_plaintext: int
    tampered_plaintext: int
    expected_tampered_plaintext: int
    matches_prediction: bool
    explanation: str


class TamperRequest(BaseModel):
    """Splices a forged block into an intercepted RSA ciphertext and asks: does decryption
    notice? Textbook RSA (rsa/core.py) encrypts each fixed-size block independently -- no
    chaining between blocks, like ECB mode in a block cipher. So an attacker who intercepts
    `message`'s ciphertext can encrypt a block of their OWN choosing (using only the public
    key n, e -- never d, never the original plaintext) and swap it into a non-final block
    position. The victim decrypts the whole thing normally: every block decrypts to a
    validly-sized plaintext block (the forged one because the attacker built it that way, the
    rest because they're genuine), so nothing detects the splice -- textbook RSA carries no
    message authentication code to catch it.
    """

    n: int
    e: int
    d: int
    message: str = Field(..., min_length=1, max_length=RSA_MAX_MESSAGE_BYTES)
    block_index: int = Field(..., ge=0, description="Which block to replace; must not be the final block")
    forged_block_text: str = Field(..., min_length=1, max_length=64, description="The attacker's chosen replacement text for that block")


class TamperResponse(BaseModel):
    block_size_bytes: int
    total_blocks: int
    original_ciphertext: list[int]
    tampered_ciphertext: list[int]
    forged_block_index: int
    forged_block_plaintext: str
    original_plaintext: str
    tampered_plaintext: str
    explanation: str


class RateLimitPingResponse(BaseModel):
    ok: bool
    message: str
