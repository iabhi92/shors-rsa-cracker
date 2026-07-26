"""End-to-end demo: generate a (tiny, toy-sized) RSA keypair, encrypt a secret, then break
it purely by factoring the public modulus with the from-scratch quantum simulation of
Shor's algorithm — no access to the private key at any point until it's derived from the
recovered factors.

Run with: python scripts/demo_crack.py
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np

from rsa.core import decrypt_int, encrypt_int
from rsa.keygen import KeyPair, PrivateKey, PublicKey, mod_inverse
from quantum.shor import shors_algorithm


def small_keypair(p: int, q: int, e: int) -> KeyPair:
    n = p * q
    phi = (p - 1) * (q - 1)
    d = mod_inverse(e, phi)
    return KeyPair(public=PublicKey(n=n, e=e), private=PrivateKey(n=n, d=d), p=p, q=q)


def main() -> None:
    # A real RSA key is 2048+ bits; honestly simulating Shor's algorithm on a classical
    # computer costs O(2^qubits) memory, so N here is intentionally toy-sized (this is
    # exactly the point of the project: the *algorithm* is what scales, not this simulator).
    kp = small_keypair(p=11, q=13, e=7)
    secret = 42
    print(f"Alice's public key: n={kp.public.n}, e={kp.public.e}")
    print(f"(Private key p={kp.p}, q={kp.q}, d={kp.private.d} — known only to Alice)")

    ciphertext = encrypt_int(secret, kp.public)
    print(f"\nAlice encrypts her secret ({secret}) -> ciphertext {ciphertext}")

    print(f"\nMallory intercepts n={kp.public.n} and the ciphertext. She has no private key.")
    print("Running Shor's algorithm (quantum period-finding, honestly simulated)...")

    rng = np.random.default_rng()
    start = time.perf_counter()
    result = shors_algorithm(kp.public.n, rng, max_attempts=20, n_count=10)
    elapsed = time.perf_counter() - start

    for i, attempt in enumerate(result.attempts, 1):
        print(f"  attempt {i}: a={attempt.a} measured={attempt.measured} "
              f"period={attempt.period_candidate} -> {attempt.outcome}")

    if result.factors is None:
        print("Failed to factor within max_attempts (rare — rerun).")
        return

    p, q = result.factors
    print(f"\nFactored n = {p} * {q} in {elapsed:.3f}s ({len(result.attempts)} attempt(s))")

    phi = (p - 1) * (q - 1)
    d = mod_inverse(kp.public.e, phi)
    cracked_key = PrivateKey(n=kp.public.n, d=d)
    print(f"Recovered private exponent d={d} (Alice's real d was {kp.private.d})")

    recovered_secret = decrypt_int(ciphertext, cracked_key)
    print(f"\nDecrypted Alice's ciphertext without ever seeing her private key: {recovered_secret}")
    assert recovered_secret == secret
    print("Match. RSA broken.")


if __name__ == "__main__":
    main()
