"""Wiener's attack (1990): recovers RSA's ENTIRE private key -- not just one message, the actual
d, p, and q -- from nothing but the public key (N, e), whenever d was chosen too small (roughly
d < N^0.25 / 3). No oracle, no ciphertext, no chosen-plaintext queries -- pure number theory
against the public key alone.

Reuses quantum/shor.py's own continued_fraction_convergents completely unchanged: the exact same
classical math that turns a noisy quantum measurement into a candidate period for Shor's algorithm
is *also* a complete classical attack on textbook RSA whenever d is small. One piece of number
theory, two unrelated-looking attack surfaces -- the quantum lab's post-processing step and this
classical key-recovery attack are, underneath, the same function.

Why it works: e*d - 1 = k*phi(N) for some integer k (the RSA keygen identity). Dividing through,
e/N is *close* to k/d (since phi(N) is close to N for large primes) -- close enough that when d is
small, k/d shows up exactly as one of the convergents of e/N's continued-fraction expansion. Each
convergent is a candidate (k, d); the correct one lets phi(N) = (ed-1)/k be recovered exactly,
which factors N via the quadratic p,q are roots of x^2 - (N-phi+1)x + N = 0.
"""

import math
from dataclasses import dataclass

from quantum.shor import continued_fraction_convergents
from rsa.keygen import KeyPair, PrivateKey, PublicKey, extended_gcd, mod_inverse
from rsa.primes import generate_prime


@dataclass(frozen=True)
class WienerResult:
    succeeded: bool
    recovered_d: int | None
    recovered_p: int | None
    recovered_q: int | None
    convergents_tried: int
    total_convergents: int


def wiener_attack(n: int, e: int) -> WienerResult:
    """Tries every convergent of e/N's continued-fraction expansion as a candidate k/d, exactly
    as described in this module's own docstring. Returns the first one that actually factors N --
    real RSA keygen makes this astronomically unlikely to happen by chance for a normal d, which
    is exactly what this function's own test suite confirms by throwing a normally-generated key
    at it and watching it correctly fail."""
    convergents = continued_fraction_convergents(e, n)
    for i, frac in enumerate(convergents):
        k, d = frac.numerator, frac.denominator
        if k == 0 or d == 0 or (e * d - 1) % k != 0:
            continue
        phi_candidate = (e * d - 1) // k
        s = n - phi_candidate + 1  # p + q, if this convergent is the right one
        discriminant = s * s - 4 * n
        if discriminant < 0:
            continue
        sqrt_disc = math.isqrt(discriminant)
        if sqrt_disc * sqrt_disc != discriminant:
            continue
        p, q = (s + sqrt_disc) // 2, (s - sqrt_disc) // 2
        if p > 1 and q > 1 and p * q == n:
            return WienerResult(True, d, p, q, i + 1, len(convergents))
    return WienerResult(False, None, None, None, len(convergents), len(convergents))


def generate_wiener_vulnerable_keypair(bits: int) -> KeyPair:
    """A real, mathematically valid RSA keypair (every identity generate_keypair's own real
    primes satisfy still holds) that's deliberately constructed to be Wiener-breakable: instead
    of picking e first and deriving d (this project's normal rsa/keygen.py path), this picks a
    *small* d first -- around N^0.2, safely under Wiener's ~N^0.25 bound -- and derives e as d's
    modular inverse. Exists only for this demo; nothing else in this project ever calls it, and
    real key generation should never do this."""
    half = bits // 2
    p, q = generate_prime(half), generate_prime(bits - half)
    while q == p:
        q = generate_prime(bits - half)
    n = p * q
    phi = (p - 1) * (q - 1)

    # d ~ N^0.2 (bits/5 bits) -- comfortably under Wiener's bound (~N^0.25) with margin, so the
    # attack succeeds reliably rather than sitting right on the theoretical edge.
    d_bits = max(4, bits // 5)
    d = generate_prime(d_bits)  # doesn't need to be prime, but guarantees oddness and simplicity
    while extended_gcd(d, phi)[0] != 1:
        d = generate_prime(d_bits)

    e = mod_inverse(d, phi)
    return KeyPair(public=PublicKey(n=n, e=e), private=PrivateKey(n=n, d=d), p=p, q=q)
