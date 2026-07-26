"""RSA keypair generation, built from scratch."""

from dataclasses import dataclass

from rsa.primes import generate_prime


@dataclass(frozen=True)
class PublicKey:
    n: int
    e: int


@dataclass(frozen=True)
class PrivateKey:
    n: int
    d: int


@dataclass(frozen=True)
class KeyPair:
    public: PublicKey
    private: PrivateKey
    p: int  # kept on the object for teaching/demo purposes (a real keypair would discard these)
    q: int


def extended_gcd(a: int, b: int) -> tuple[int, int, int]:
    """Returns (g, x, y) such that a*x + b*y = g = gcd(a, b)."""
    old_r, r = a, b
    old_s, s = 1, 0
    old_t, t = 0, 1
    while r != 0:
        quotient = old_r // r
        old_r, r = r, old_r - quotient * r
        old_s, s = s, old_s - quotient * s
        old_t, t = t, old_t - quotient * t
    return old_r, old_s, old_t


def mod_inverse(a: int, m: int) -> int:
    """Modular inverse of a mod m via extended Euclidean algorithm."""
    g, x, _ = extended_gcd(a % m, m)
    if g != 1:
        raise ValueError(f"{a} has no inverse mod {m} (gcd = {g})")
    return x % m


def generate_keypair(bits: int, e: int = 65537) -> KeyPair:
    """Generate an RSA keypair with an n of approximately `bits` bits.

    p and q are each generated at bits/2, so n = p*q lands close to `bits` total.
    """
    if bits < 8:
        raise ValueError("bits must be >= 8 to leave room for two distinct primes")
    half = bits // 2

    while True:
        p = generate_prime(half)
        q = generate_prime(bits - half)
        if p == q:
            continue
        n = p * q
        phi = (p - 1) * (q - 1)
        if extended_gcd(e, phi)[0] != 1:
            continue  # e must be coprime with phi; retry with fresh primes
        d = mod_inverse(e, phi)
        return KeyPair(
            public=PublicKey(n=n, e=e),
            private=PrivateKey(n=n, d=d),
            p=p,
            q=q,
        )
