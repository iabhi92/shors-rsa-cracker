"""Two live attacks against textbook RSA's *lack* of ciphertext integrity -- the property real
RSA (OAEP, or any AEAD-wrapped scheme) exists specifically to remove: multiplicative
malleability (an attacker who never sees d or m can still transform an intercepted ciphertext
by a chosen factor) and block substitution (an attacker who never sees d can splice a
self-forged block into an intercepted multi-block ciphertext, undetected). Both reuse this
project's real rsa/core.py primitives; nothing here is a mocked or precomputed result."""

import secrets

from fastapi import APIRouter, Depends

from attacker.crt_fault import crt_fault_attack, generate_crt_fault_scenario
from attacker.parity_oracle import recover_via_parity_oracle
from attacker.timing_oracle import TimingComparison, measure_oaep_timing, measure_pkcs7_timing
from attacker.wiener import generate_wiener_vulnerable_keypair, wiener_attack
from backend.app.errors import AppError
from backend.app.rate_limit import dashboard_demo_limiter, limiter_dependency, rsa_keygen_limiter
from backend.app.schemas.security_demo import (
    CrtFaultAttackRequest,
    CrtFaultAttackResponse,
    CrtFaultScenarioRequest,
    CrtFaultScenarioResponse,
    MalleabilityRequest,
    MalleabilityResponse,
    OaepKeygenResponse,
    ParityOracleRequest,
    ParityOracleResponse,
    ParityOracleStep,
    RateLimitPingResponse,
    TamperRequest,
    TamperResponse,
    TimingComparisonResult,
    TimingOracleRequest,
    TimingOracleResponse,
    TimingScenario,
    WienerAttackRequest,
    WienerAttackResponse,
    WienerKeygenRequest,
    WienerKeygenResponse,
)
from rsa.core import _block_size, decrypt_bytes, decrypt_int, encrypt_bytes, encrypt_int
from rsa.keygen import PrivateKey, PublicKey, generate_keypair
from rsa.oaep import OaepError, min_modulus_bytes, oaep_decode, oaep_encode

router = APIRouter()


def _to_response(comparison: TimingComparison) -> TimingComparisonResult:
    return TimingComparisonResult(
        scenarios=[
            TimingScenario(label=s.label, mean_ns=s.mean_ns, median_ns=s.median_ns, min_ns=s.min_ns, stddev_ns=s.stddev_ns)
            for s in comparison.scenarios
        ],
        gap_ns=comparison.gap_ns,
        gap_percent=comparison.gap_percent,
        gap_in_std_errors=comparison.gap_in_std_errors,
        verdict=comparison.verdict,
    )

# OAEP with SHA-256 needs a modulus of at least 2*32+2 = 66 bytes (528 bits); 1024 gives real
# headroom (62 usable message bytes) while still generating in well under a second in pure
# Python (see rsa/primes.py). Fixed, not user-configurable -- this endpoint exists solely to
# give the Malleability Lab's OAEP toggle a real key big enough to demonstrate the scheme, not
# as a general-purpose keygen path.
OAEP_DEMO_BITS = 1024


def _int_to_bytes(value: int) -> bytes:
    return value.to_bytes((value.bit_length() + 7) // 8 or 1, "big")


@router.post("/oaep-keygen", response_model=OaepKeygenResponse, dependencies=[Depends(limiter_dependency(rsa_keygen_limiter))])
def oaep_keygen() -> OaepKeygenResponse:
    """A real, fixed 1024-bit RSA keypair -- specifically for the Malleability Lab's "use OAEP
    padding" toggle, which needs far more room than this project's usual 8-24 bit teaching keys
    (RSA_MAX_BITS caps /rsa/keygen at 24 bits site-wide, deliberately, so every other demo's keys
    stay classically breakable in seconds -- see backend/app/limits.py). This endpoint doesn't
    relax that cap; it's a separate, narrowly-scoped path that only ever serves this one demo."""
    kp = generate_keypair(OAEP_DEMO_BITS)
    phi = (kp.p - 1) * (kp.q - 1)
    return OaepKeygenResponse(
        p=str(kp.p),
        q=str(kp.q),
        n=str(kp.public.n),
        e=str(kp.public.e),
        d=str(kp.private.d),
        phi=str(phi),
        n_bits=kp.public.n.bit_length(),
        warning=(
            f"A real {OAEP_DEMO_BITS}-bit keypair, generated specifically so OAEP padding has "
            "room to work -- unlike every other key on this site, this one isn't intentionally "
            "weak (though it's still shown here in full, private key included, for teaching)."
        ),
    )


@router.post("/wiener-keygen", response_model=WienerKeygenResponse, dependencies=[Depends(limiter_dependency(rsa_keygen_limiter))])
def wiener_keygen(req: WienerKeygenRequest) -> WienerKeygenResponse:
    """A real, mathematically valid RSA keypair -- every identity a genuine key satisfies still
    holds -- deliberately constructed with a small private exponent d (see
    attacker/wiener.py's own generate_wiener_vulnerable_keypair) so the Wiener's-attack demo has
    something real to break. Nothing else on this site ever generates a key this way."""
    kp = generate_wiener_vulnerable_keypair(req.bits)
    wiener_bound_bits = kp.public.n.bit_length() / 4 - 1.585  # log2(3), Wiener's own constant
    return WienerKeygenResponse(
        n=str(kp.public.n),
        e=str(kp.public.e),
        d=str(kp.private.d),
        p=str(kp.p),
        q=str(kp.q),
        n_bits=kp.public.n.bit_length(),
        d_bits=kp.private.d.bit_length(),
        wiener_bound_bits=wiener_bound_bits,
    )


@router.post("/wiener-attack", response_model=WienerAttackResponse)
def wiener_attack_endpoint(req: WienerAttackRequest) -> WienerAttackResponse:
    """Recovers the entire private key from nothing but (n, e) -- no ciphertext, no oracle, no d
    anywhere in the request. See attacker/wiener.py's own module docstring for the real
    continued-fraction math, shared unchanged with quantum/shor.py's period-finding
    post-processing."""
    try:
        n, e = int(req.n), int(req.e)
    except ValueError as exc:
        raise AppError("n and e must be decimal integers") from exc
    result = wiener_attack(n, e)
    return WienerAttackResponse(
        succeeded=result.succeeded,
        recovered_d=str(result.recovered_d) if result.recovered_d is not None else None,
        recovered_p=str(result.recovered_p) if result.recovered_p is not None else None,
        recovered_q=str(result.recovered_q) if result.recovered_q is not None else None,
        convergents_tried=result.convergents_tried,
        total_convergents=result.total_convergents,
    )


@router.post("/crt-fault-scenario", response_model=CrtFaultScenarioResponse, dependencies=[Depends(limiter_dependency(rsa_keygen_limiter))])
def crt_fault_scenario(req: CrtFaultScenarioRequest) -> CrtFaultScenarioResponse:
    """A completely ordinary, unweakened RSA keypair (see attacker/crt_fault.py's own module
    docstring for why this attack doesn't need a special key at all), signed twice: once
    correctly, once with a single fault injected into a randomly-chosen CRT branch -- simulating
    exactly what a real voltage-glitch/laser-fault attack against signing hardware produces."""
    kp = generate_keypair(req.bits)
    message = secrets.randbelow(kp.public.n)
    scenario = generate_crt_fault_scenario(kp, message)
    return CrtFaultScenarioResponse(
        n=str(kp.public.n),
        e=str(kp.public.e),
        d=str(kp.private.d),
        p=str(kp.p),
        q=str(kp.q),
        n_bits=kp.public.n.bit_length(),
        message=str(scenario.message),
        correct_signature=str(scenario.correct_signature),
        faulty_signature=str(scenario.faulty_signature),
        faulted_branch=scenario.faulted_branch,
    )


@router.post("/crt-fault-attack", response_model=CrtFaultAttackResponse)
def crt_fault_attack_endpoint(req: CrtFaultAttackRequest) -> CrtFaultAttackResponse:
    """Recovers a full factorization of n from nothing but the public key, the signed message,
    and one faulty signature -- no d, no p, no q anywhere in the request. See
    attacker/crt_fault.py's own module docstring for the gcd math."""
    try:
        n, e, message, faulty_signature = int(req.n), int(req.e), int(req.message), int(req.faulty_signature)
    except ValueError as exc:
        raise AppError("n, e, message, and faulty_signature must all be decimal integers") from exc
    result = crt_fault_attack(n, e, message, faulty_signature)
    return CrtFaultAttackResponse(
        succeeded=result.succeeded,
        recovered_p=str(result.recovered_p) if result.recovered_p is not None else None,
        recovered_q=str(result.recovered_q) if result.recovered_q is not None else None,
    )


@router.post("/malleability", response_model=MalleabilityResponse)
def malleability(req: MalleabilityRequest) -> MalleabilityResponse:
    if not (0 <= req.message_int < req.n):
        raise AppError(f"message_int must satisfy 0 <= m < n (n={req.n})")

    pub = PublicKey(n=req.n, e=req.e)
    priv = PrivateKey(n=req.n, d=req.d)

    # With OAEP on, what actually gets RSA-encrypted is message_int wrapped in a real OAEP block
    # (rsa/oaep.py) -- not message_int directly. The leading 0x00 byte OAEP always produces
    # guarantees the padded integer is < n regardless of k, so encrypt_int's own 0 <= m < n check
    # can never trip here.
    k = (req.n.bit_length() + 7) // 8
    if req.use_oaep:
        if k < min_modulus_bytes():
            raise AppError(
                f"n is only {k} bytes ({req.n.bit_length()} bits); OAEP with SHA-256 needs a "
                f"modulus of at least {min_modulus_bytes()} bytes (528 bits) to have room for its "
                "own structure -- generate a real 1024-bit-or-larger keypair to use it"
            )
        try:
            encoded = oaep_encode(_int_to_bytes(req.message_int), k)
        except ValueError as err:
            raise AppError(str(err)) from err
        m = int.from_bytes(encoded, "big")
    else:
        m = req.message_int

    # The victim encrypts m normally.
    c = encrypt_int(m, pub)

    # The attacker, holding ONLY the public key (n, e) and the intercepted ciphertext c --
    # never d, never m -- multiplies in a blinding factor s. This is legal RSA math, not a
    # bug in this implementation: (m^e)(s^e) = (m*s)^e (mod n) for any e, by definition of
    # modular exponentiation, so c' decrypts as if m had been multiplied by s all along. This
    # holds completely unchanged whether or not m itself is an OAEP-padded block -- the attack
    # operates purely on the ciphertext integer, before OAEP is ever involved.
    s_pow_e = pow(req.blind_factor, req.e, req.n)
    c_tampered = (c * s_pow_e) % req.n

    # The victim decrypts c' exactly as they would any other ciphertext -- they have no way
    # to know it was tampered with from the ciphertext alone, because textbook RSA carries no
    # integrity check at all. With OAEP, this raw decryption is only the first half of decrypting
    # -- the victim then tries to remove the OAEP padding, which is where tampering finally
    # becomes visible.
    m_recovered = decrypt_int(c, priv)
    m_tampered = decrypt_int(c_tampered, priv)
    expected = (m * req.blind_factor) % req.n

    original_oaep_valid: bool | None = None
    tampered_oaep_valid: bool | None = None
    original_message_int: int | None = None
    tampered_message_int: int | None = None
    explanation = (
        f"Without ever seeing d or m, the attacker turned an encryption of {req.message_int} "
        f"into an encryption of {req.message_int} * {req.blind_factor} mod n = {expected}, "
        "by multiplying the ciphertext by s^e mod n. This is why real RSA always uses "
        "padding (OAEP): padding destroys the algebraic structure (m^e)(s^e) = (ms)^e that "
        "this attack depends on."
    )

    if req.use_oaep:
        try:
            original_message_int = int.from_bytes(oaep_decode(m_recovered.to_bytes(k, "big"), k), "big")
            original_oaep_valid = True
        except OaepError:
            original_oaep_valid = False
        try:
            tampered_message_int = int.from_bytes(oaep_decode(m_tampered.to_bytes(k, "big"), k), "big")
            tampered_oaep_valid = True
        except OaepError:
            tampered_oaep_valid = False

        explanation = (
            "The ciphertext algebra above still works exactly as before -- multiplying by s^e mod n "
            f"still turns the encryption of message m into an encryption of m * {req.blind_factor} "
            "mod n, whether or not m is OAEP-padded, because that attack never looks past the "
            "ciphertext integer. What OAEP actually changes is what happens next: the victim's "
            "decryption now includes an OAEP-decode step, and "
            + (
                "the tampered ciphertext fails it -- the attack is detected and rejected instead of "
                "silently handing back attacker-controlled plaintext."
                if not tampered_oaep_valid
                else "in this run the tampered block coincidentally still passed OAEP's structural "
                "check (astronomically unlikely, but not impossible) -- try a different blind factor."
            )
        )

    return MalleabilityResponse(
        original_ciphertext=str(c),
        tampered_ciphertext=str(c_tampered),
        original_plaintext=str(m_recovered),
        tampered_plaintext=str(m_tampered),
        expected_tampered_plaintext=str(expected),
        matches_prediction=m_tampered == expected,
        explanation=explanation,
        oaep_used=req.use_oaep,
        original_oaep_valid=original_oaep_valid,
        tampered_oaep_valid=tampered_oaep_valid,
        original_message_int=original_message_int,
        tampered_message_int=tampered_message_int,
    )


@router.post("/parity-oracle-attack", response_model=ParityOracleResponse)
def parity_oracle_attack(req: ParityOracleRequest) -> ParityOracleResponse:
    """Full plaintext recovery using ONLY the public key and a one-bit-per-query oracle -- see
    attacker/parity_oracle.py's own module docstring for the real math (RSA's multiplicative
    homomorphism plus a parity leak is enough to binary-search out the entire message). The
    oracle itself is built here from the real private key purely to *simulate* what a genuine
    side channel would leak in a real deployment; recover_via_parity_oracle never receives d."""
    if not (0 <= req.message_int < req.n):
        raise AppError(f"message_int must satisfy 0 <= m < n (n={req.n})")

    pub = PublicKey(n=req.n, e=req.e)
    priv = PrivateKey(n=req.n, d=req.d)
    ciphertext = encrypt_int(req.message_int, pub)

    def oracle(c: int) -> int:
        return decrypt_int(c, priv) % 2

    result = recover_via_parity_oracle(ciphertext, pub, oracle)

    return ParityOracleResponse(
        original_message=req.message_int,
        recovered_message=result.recovered_message,
        matches_original=result.recovered_message == req.message_int,
        total_queries=result.total_queries,
        steps=[ParityOracleStep(query_number=s.query_number, oracle_bit=s.oracle_bit, lo=s.lo, hi=s.hi) for s in result.queries],
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


@router.post(
    "/timing-oracle",
    response_model=TimingOracleResponse,
    dependencies=[Depends(limiter_dependency(dashboard_demo_limiter))],
)
def timing_oracle(req: TimingOracleRequest) -> TimingOracleResponse:
    """Empirically measures, right now, on this actual server, whether this project's own
    padding-validation code leaks timing information about *why* a ciphertext was rejected --
    see attacker/timing_oracle.py's own module docstring for the real Bleichenbacher-relevant
    mechanism this demonstrates. Rate-limited like the dashboard's other live demos: each call
    runs thousands of real measurements, not a cheap lookup."""
    return TimingOracleResponse(
        trials=req.trials,
        pkcs7=_to_response(measure_pkcs7_timing(req.trials)),
        oaep=_to_response(measure_oaep_timing(req.trials)),
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
