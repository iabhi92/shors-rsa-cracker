"""Terminal walkthrough of the RSA-from-scratch implementation.

Run with: python scripts/demo_cli.py
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from rsa.core import decrypt_text, encrypt_text
from rsa.keygen import generate_keypair


def main() -> None:
    bits = 256
    print(f"Generating a {bits}-bit RSA keypair from scratch...")
    start = time.perf_counter()
    kp = generate_keypair(bits)
    elapsed = time.perf_counter() - start
    print(f"  done in {elapsed:.3f}s")
    print(f"  p = {kp.p}")
    print(f"  q = {kp.q}")
    print(f"  n = p*q = {kp.public.n}  ({kp.public.n.bit_length()} bits)")
    print(f"  e = {kp.public.e}")
    print(f"  d = {kp.private.d}")

    message = "Meet me at the old bridge at midnight."
    print(f"\nPlaintext: {message!r}")

    ciphertext = encrypt_text(message, kp.public)
    print(f"Ciphertext (as {len(ciphertext)} RSA block(s)):")
    for block in ciphertext:
        print(f"  {block}")

    recovered = decrypt_text(ciphertext, kp.private)
    print(f"\nDecrypted with private key: {recovered!r}")
    assert recovered == message
    print("Round trip OK.")


if __name__ == "__main__":
    main()
