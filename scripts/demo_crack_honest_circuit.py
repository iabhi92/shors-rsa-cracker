"""End-to-end demo: the same "break real RSA with Shor's algorithm" story as demo_crack.py,
but using quantum/modexp_circuit.py's gate-level modular exponentiation circuit instead of
quantum/modexp.py's permutation shortcut. Nothing in this path is a documented shortcut:
modular exponentiation is realized entirely from elementary single- and multi-controlled
single-qubit gates (reversible Fourier adders -> modular multipliers -> exponentiation).

The tradeoff for removing that shortcut is ancilla qubits: this circuit needs
n_target + 2 extra scratch qubits beyond what the permutation shortcut needs for the same
N, so it honestly reaches smaller N. That's why this demo uses N=15 rather than
demo_crack.py's N=143 — printed below alongside the actual qubit counts, so the cost of
honesty here is a measured number, not an assertion.

Run with: python scripts/demo_crack_honest_circuit.py
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np

from quantum.modexp_circuit import ancilla_qubit_count
from quantum.shor import default_n_count, find_period_quantum_gate_level, shors_algorithm
from rsa.core import decrypt_int, encrypt_int
from rsa.keygen import KeyPair, PrivateKey, PublicKey, mod_inverse


def small_keypair(p: int, q: int, e: int) -> KeyPair:
    n = p * q
    phi = (p - 1) * (q - 1)
    d = mod_inverse(e, phi)
    return KeyPair(public=PublicKey(n=n, e=e), private=PrivateKey(n=n, d=d), p=p, q=q)


def main() -> None:
    kp = small_keypair(p=3, q=5, e=3)  # N=15, the largest N this honest circuit reaches fast
    secret = 7
    n_count = 6  # reduced from default_n_count's 8 to keep the honest circuit's qubit count down

    n_target = kp.public.n.bit_length()
    n_ancilla = ancilla_qubit_count(n_target)
    permutation_qubits = default_n_count(kp.public.n) + n_target
    gate_level_qubits = n_count + n_target + n_ancilla

    print(f"Alice's public key: n={kp.public.n}, e={kp.public.e}")
    print(f"(Private key p={kp.p}, q={kp.q}, d={kp.private.d} — known only to Alice)")
    print(
        f"\nQubit cost for n={kp.public.n}: permutation shortcut would use "
        f"{permutation_qubits} qubits; this honest gate-level circuit uses {gate_level_qubits} "
        f"({n_count} control + {n_target} target + {n_ancilla} ancilla) at a reduced "
        f"n_count={n_count} to stay fast — the real price of not shortcutting the arithmetic."
    )

    ciphertext = encrypt_int(secret, kp.public)
    print(f"\nAlice encrypts her secret ({secret}) -> ciphertext {ciphertext}")

    print(f"\nMallory intercepts n={kp.public.n} and the ciphertext. She has no private key.")
    print("Running Shor's algorithm with the gate-level circuit (every gate elementary,")
    print("no modular-exponentiation permutation shortcut anywhere in this path)...")

    # Seeded (rather than default_rng()'s fresh entropy) specifically so this demo reliably
    # lands on a coprime `a` and exercises the actual quantum circuit — shors_algorithm's own
    # free classical shortcut for gcd(a,N)!=1 is real and tested elsewhere
    # (test_shors_algorithm_attempt_log_shows_the_known_failure_modes_eventually), but this
    # script's whole point is to show the gate-level circuit measurement actually happening.
    rng = np.random.default_rng(1)
    start = time.perf_counter()
    result = shors_algorithm(
        kp.public.n,
        rng,
        max_attempts=20,
        n_count=n_count,
        period_finder=find_period_quantum_gate_level,
    )
    elapsed = time.perf_counter() - start

    for i, attempt in enumerate(result.attempts, 1):
        print(
            f"  attempt {i}: a={attempt.a} measured={attempt.measured} "
            f"period={attempt.period_candidate} -> {attempt.outcome}"
        )

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
    print("Match. RSA broken — with zero simulation shortcuts in the quantum circuit.")


if __name__ == "__main__":
    main()
