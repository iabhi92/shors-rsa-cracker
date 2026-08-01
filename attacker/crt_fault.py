"""RSA-CRT fault/glitch injection attack (Boneh-DeMillo-Lipton, 1997): a single corrupted bit
during ONE branch of a CRT-optimized RSA private-key operation is enough to factor N outright --
no oracle, no small private exponent, no weak key needed at all. Unlike every other attack in
this project (the parity oracle, the timing side-channel, Wiener's attack), this one doesn't
depend on anything unusual about the key -- it works against a completely normal, correctly
generated RSA key, the moment its signer/decryptor uses the standard CRT speedup (as almost
every real-world RSA implementation does, since CRT is roughly 4x faster than plain modular
exponentiation) and a physical fault -- a voltage glitch, a laser pulse, a stray cosmic ray, all
documented against real smart cards and TPMs -- corrupts the computation in exactly one of its
two branches.

Why it works: CRT signing computes s_p = m^dP mod p and s_q = m^dQ mod q separately (dP = d mod
(p-1), dQ = d mod (q-1)), then recombines via Garner's formula into a single s with 0 <= s < n
such that s ≡ s_p (mod p) and s ≡ s_q (mod q). If a fault corrupts s_p during that one branch
(s_q computed correctly), the resulting faulty signature s' still satisfies s' ≡ m^d (mod q) but
NOT (mod p). Then:

    s'^e - m ≡ m - m ≡ 0 (mod q)      -- the un-faulted branch: this congruence holds
    s'^e - m ≢ 0 (mod p)              -- the faulted branch: this one almost never holds

so gcd(s'^e - m mod n, n) = q exactly -- one gcd computation, one faulty signature, and n is
fully factored. This is a fault attack, not a math attack, which is exactly why real signing
hardware verifies s^e == m before ever releasing a CRT-signed s (checking your own output before
handing it out catches any single-branch fault) -- this module's scenario generator deliberately
skips that check, to demonstrate what happens without it.
"""

import math
import secrets
from dataclasses import dataclass
from typing import Literal

from rsa.keygen import KeyPair, mod_inverse

Branch = Literal["p", "q"]


@dataclass(frozen=True)
class CrtFaultScenario:
    message: int
    correct_signature: int
    faulty_signature: int
    faulted_branch: Branch


@dataclass(frozen=True)
class CrtFaultResult:
    succeeded: bool
    recovered_p: int | None
    recovered_q: int | None


def _flip_one_bit(value: int, modulus: int) -> int:
    """Flips a single random bit of `value` -- standing in for a real fault (a glitched clock
    edge, a laser pulse hitting one register) rather than an arbitrary convenient wrong number --
    then reduces mod `modulus` to stay a valid field element. Retries a different bit on the
    astronomically unlikely chance the flip lands back on the original value mod modulus, so this
    demo always actually demonstrates a fault rather than silently a no-op."""
    bit_length = max(modulus.bit_length(), 1)
    for _ in range(50):
        bit = secrets.randbelow(bit_length)
        candidate = (value ^ (1 << bit)) % modulus
        if candidate != value:
            return candidate
    raise RuntimeError("could not produce a distinct faulty value -- modulus too small")


def _crt_sign(message: int, p: int, q: int, d: int, fault_branch: Branch | None = None) -> int:
    """The standard CRT-optimized RSA private-key operation (Garner's formula) -- the real ~4x
    speedup essentially every production RSA implementation uses over plain pow(m, d, n). With
    fault_branch set, the named branch's intermediate result is corrupted before recombination,
    simulating exactly what a real glitch attack against signing hardware produces."""
    d_p = d % (p - 1)
    d_q = d % (q - 1)
    q_inv = mod_inverse(q, p)
    s_p = pow(message % p, d_p, p)
    s_q = pow(message % q, d_q, q)

    if fault_branch == "p":
        s_p = _flip_one_bit(s_p, p)
    elif fault_branch == "q":
        s_q = _flip_one_bit(s_q, q)

    h = (q_inv * (s_p - s_q)) % p
    return s_q + h * q


def generate_crt_fault_scenario(kp: KeyPair, message: int, branch: Branch | None = None) -> CrtFaultScenario:
    """Signs `message` twice with the same real key -- once correctly, once with a single fault
    injected into one randomly-chosen CRT branch. The correct signature is computed only so the
    demo can show it alongside the faulty one for comparison; the attack itself (crt_fault_attack
    below) never receives it."""
    p, q, d = kp.p, kp.q, kp.private.d
    correct = _crt_sign(message, p, q, d)
    chosen_branch: Branch = branch if branch is not None else ("p" if secrets.randbelow(2) == 0 else "q")
    faulty = _crt_sign(message, p, q, d, fault_branch=chosen_branch)
    return CrtFaultScenario(message=message, correct_signature=correct, faulty_signature=faulty, faulted_branch=chosen_branch)


def crt_fault_attack(n: int, e: int, message: int, faulty_signature: int) -> CrtFaultResult:
    """Recovers a full factorization of n from nothing but the public key, the signed message,
    and one faulty signature -- see this module's own docstring for why gcd(s'^e - m mod n, n)
    lands exactly on the prime whose branch was NOT faulted. Never receives d, p, or q -- exactly
    what a real attacker holding a faulted signature would have."""
    candidate = (pow(faulty_signature, e, n) - message) % n
    factor = math.gcd(candidate, n)
    if factor in (0, 1, n):
        return CrtFaultResult(succeeded=False, recovered_p=None, recovered_q=None)
    other = n // factor
    p, q = sorted((factor, other))
    return CrtFaultResult(succeeded=True, recovered_p=p, recovered_q=q)
