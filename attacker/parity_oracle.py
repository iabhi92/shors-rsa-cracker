"""The parity (LSB) oracle attack: a full plaintext recovery attack using only the public key
and a single-bit oracle, no private key ever touched. This is one of the more startling classical
results against textbook RSA -- if an attacker has *any* way to learn just the least significant
bit of the plaintext for a ciphertext of their choosing (a timing difference, a distinct error
page, a cache side channel -- any real-world leak that boils down to one bit), that alone is
enough to recover the *entire* plaintext, bit by bit, in ceil(log2(N)) queries.

The idea: RSA is multiplicatively homomorphic (see security_demo.py's own malleability() for the
same fact used differently), so an attacker can ask the oracle for the parity of 2^i * m mod N for
increasing i, without ever knowing m. Since N is odd:

    2*x mod N is EVEN  <=>  2*x  < N  <=>  x < N/2   (no wraparound -- doubling stayed even)
    2*x mod N is ODD   <=>  2*x >= N  <=>  x >= N/2  (wrapped past N, which is odd, flipping parity)

So each oracle query reveals which half of the current interval m actually falls in -- exactly one
bit of binary search per query, using nothing but c' = c * (2^e)^i mod N (computable from the
public key alone) and the oracle's single-bit answer.

This module's `oracle` parameter is deliberately just `Callable[[int], int]` -- in this project's
own live demo, it happens to be implemented by actually decrypting with the real private key and
returning the parity bit (there is no other way to honestly *compute* what a real oracle would
leak in a simulated demo), but the attack function itself never receives d, never receives m, and
never receives anything but that single bit per call -- faithfully reproducing exactly what a real
attacker exploiting a real side channel would see.
"""

from collections.abc import Callable
from dataclasses import dataclass
from fractions import Fraction

from rsa.keygen import PublicKey


@dataclass(frozen=True)
class OracleQuery:
    query_number: int
    oracle_bit: int
    lo: int
    hi: int


@dataclass(frozen=True)
class ParityOracleResult:
    recovered_message: int
    total_queries: int
    queries: list[OracleQuery]


def recover_via_parity_oracle(ciphertext: int, public_key: PublicKey, oracle: Callable[[int], int]) -> ParityOracleResult:
    """Recovers the plaintext behind `ciphertext` using only public_key and a parity oracle --
    see this module's own docstring for the real math. Exact throughout (Fraction, not float):
    at N up to a few thousand bits this is still instant, and floating-point interval halving
    would silently lose the low-order bits that are exactly what this attack is trying to prove
    it can recover."""
    n, e = public_key.n, public_key.e
    two_e = pow(2, e, n)  # ciphertext of "2" -- multiplying by this doubles the plaintext each round

    lo = Fraction(0)
    hi = Fraction(n)
    current_ciphertext = ciphertext
    queries: list[OracleQuery] = []

    bits_needed = n.bit_length()
    for i in range(1, bits_needed + 1):
        current_ciphertext = (current_ciphertext * two_e) % n
        bit = oracle(current_ciphertext)
        if bit not in (0, 1):
            raise ValueError(f"oracle must return 0 or 1, got {bit!r}")
        mid = (lo + hi) / 2
        if bit == 0:
            hi = mid
        else:
            lo = mid
        queries.append(OracleQuery(query_number=i, oracle_bit=bit, lo=int(lo), hi=int(hi.__ceil__())))

    # After bits_needed halvings the interval width (N / 2^bits_needed) is under 1, so exactly one
    # integer satisfies lo <= m < hi -- take the ceiling of *lo* specifically (not hi: an earlier
    # version of this used ceil(hi), which is systematically one too high, caught by this
    # module's own test suite hitting the m=0 and m=n-1 boundary cases first).
    recovered = int(lo.__ceil__())
    return ParityOracleResult(recovered_message=recovered, total_queries=len(queries), queries=queries)
