from typing import Literal

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
    use_oaep: bool = Field(
        False,
        description=(
            "If true, wraps message_int in real RFC 8017 OAEP padding (rsa/oaep.py) before "
            "encrypting. The multiplicative attack still runs identically -- it operates on the "
            "ciphertext integer, before OAEP is ever involved -- but the victim's decryption of "
            "the tampered ciphertext now fails an OAEP structural check instead of silently "
            "returning a wrong plaintext. Requires n to be at least rsa.oaep.min_modulus_bytes() "
            "bytes (528 bits for SHA-256), since OAEP needs real room to hold its own structure."
        ),
    )


class MalleabilityResponse(BaseModel):
    # Decimal strings, not JSON numbers: with use_oaep, these carry values the size of a
    # 1024-bit modulus, and JavaScript's JSON parser silently rounds any integer literal past
    # 2^53 to the nearest representable float64. This project's usual 8-24 bit teaching keys
    # never came close to that limit, so this precision-loss bug had nowhere to hide until this
    # endpoint started producing keys large enough to actually need OAEP.
    original_ciphertext: str
    tampered_ciphertext: str
    original_plaintext: str
    tampered_plaintext: str
    expected_tampered_plaintext: str
    matches_prediction: bool
    explanation: str
    oaep_used: bool = False
    # None when use_oaep is false (padding was never in the picture); otherwise whether the
    # victim's decode of the *tampered* ciphertext passed OAEP's structural check. Real OAEP:
    # this is false with overwhelming probability, since the multiplicative attack's output is
    # essentially random noise from OAEP's point of view.
    original_oaep_valid: bool | None = None
    tampered_oaep_valid: bool | None = None
    # The OAEP-recovered message itself (what message_int round-trips to) -- None whenever OAEP
    # wasn't used, or when the corresponding *_oaep_valid is False (there is genuinely nothing
    # recoverable in that case, not a wrong-but-present value).
    original_message_int: int | None = None
    tampered_message_int: int | None = None


class OaepKeygenResponse(BaseModel):
    """Same precision hazard as MalleabilityResponse above, for the same reason: this is a real
    ~1024-bit keypair, and p/q/n/e/d as JSON numbers would silently round in any JS client. Kept
    as a separate schema from rsa.KeygenResponse (plain ints) rather than retrofitting that one,
    since every other caller of KeygenResponse deals only in this project's usual 8-24 bit keys,
    where plain JSON numbers are exact and changing them to strings would be pure churn."""

    p: str
    q: str
    n: str
    e: str
    d: str
    phi: str
    n_bits: int
    warning: str


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


class ParityOracleRequest(BaseModel):
    """Everything needed to run the parity/LSB oracle attack (attacker/parity_oracle.py) against
    textbook RSA: recovers message_int using ONLY the public key and a one-bit-per-query oracle
    -- d is included here purely so this demo endpoint can *simulate* what a real oracle would
    leak (there's no other way to honestly compute that in a demo); the attack algorithm itself
    never receives it, only the oracle's single-bit answers, exactly like a real attacker would
    see."""

    n: int
    e: int
    d: int
    message_int: int = Field(..., ge=0, description="The secret message, 0 <= m < n -- unknown to the attack function itself")


class ParityOracleStep(BaseModel):
    query_number: int
    oracle_bit: int
    lo: int
    hi: int


class ParityOracleResponse(BaseModel):
    original_message: int
    recovered_message: int
    matches_original: bool
    total_queries: int
    steps: list[ParityOracleStep]


class WienerKeygenRequest(BaseModel):
    bits: int = Field(256, ge=32, le=512, description="Modulus size -- deliberately larger than this project's usual 8-24 bit teaching keys, so the attack has a real interval of convergents to search")


class WienerKeygenResponse(BaseModel):
    """n/e/d/p/q as decimal strings for the same reason as OaepKeygenResponse -- at 256+ bits
    these are real values a JS float64 can't represent exactly."""

    n: str
    e: str
    d: str
    p: str
    q: str
    n_bits: int
    d_bits: int
    wiener_bound_bits: float


class WienerAttackRequest(BaseModel):
    # Strings in, not int: the whole point of this attack is that it runs from the public key
    # alone, and n/e here can be the same 256+-bit values WienerKeygenResponse just returned --
    # forcing them through JSON as plain numbers would silently corrupt them before the attack
    # even started.
    n: str
    e: str


class WienerAttackResponse(BaseModel):
    succeeded: bool
    recovered_d: str | None
    recovered_p: str | None
    recovered_q: str | None
    convergents_tried: int
    total_convergents: int


class CrtFaultScenarioRequest(BaseModel):
    bits: int = Field(
        128,
        ge=32,
        le=256,
        description="Modulus size -- a completely ordinary key at this size is just as vulnerable as a real one; bigger only makes the demo feel more realistic, it isn't required for the attack to work",
    )


class CrtFaultScenarioResponse(BaseModel):
    """n/e/d/p/q/message/signatures as decimal strings for the same reason as
    WienerKeygenResponse -- real key- and message-sized values a JS float64 can't represent
    exactly. Unlike Wiener's attack, this key is NOT specially weakened in any way -- see
    attacker/crt_fault.py's own module docstring for why a completely ordinary key is already
    vulnerable to this attack, given a real hardware fault during CRT signing."""

    n: str
    e: str
    d: str
    p: str
    q: str
    n_bits: int
    message: str
    correct_signature: str
    faulty_signature: str
    faulted_branch: Literal["p", "q"]


class CrtFaultAttackRequest(BaseModel):
    # Strings in, not int: real key/message-sized values. Deliberately NOT d, p, or q -- the
    # whole point of this attack is that it runs from exactly what a real attacker holding a
    # faulted signature would have: the public key, the message, and the bad signature.
    n: str
    e: str
    message: str
    faulty_signature: str


class CrtFaultAttackResponse(BaseModel):
    succeeded: bool
    recovered_p: str | None
    recovered_q: str | None


class TimingOracleRequest(BaseModel):
    trials: int = Field(2000, ge=200, le=20_000, description="Repeated timing samples per scenario -- more trials, less noise, slower request")


class TimingScenario(BaseModel):
    label: str
    mean_ns: float
    median_ns: float
    min_ns: float
    stddev_ns: float


class TimingComparisonResult(BaseModel):
    scenarios: list[TimingScenario]
    gap_ns: float
    gap_percent: float
    gap_in_std_errors: float
    verdict: str


class TimingOracleResponse(BaseModel):
    trials: int
    pkcs7: TimingComparisonResult
    oaep: TimingComparisonResult
