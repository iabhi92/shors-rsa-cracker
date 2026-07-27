# Security

## What this project is

An educational demonstration of *why* quantum computing threatens RSA: a from-scratch,
deliberately unpadded ("textbook") RSA implementation, attacked both classically
(`attacker/classical.py`) and with a simulated quantum computer running Shor's algorithm
(`quantum/`). **This is not a cryptography library and must never be used to protect real
data.** Its RSA implementation is intentionally missing the defenses real-world RSA relies
on — that's the point: the weak points need to be visible and attackable to demonstrate them.

## Threat model

Two threat models coexist in this repo, and it matters which one applies to a given piece of
code:

1. **The demo's own threat model** (what `rsa/`, `attacker/`, and `quantum/` are built to
   explore): an attacker ("Mallory") who sees a public key and ciphertext and tries to
   recover the private key or plaintext, with no access to any private key material. This is
   the threat model `scripts/demo_crack.py` and `scripts/demo_crack_honest_circuit.py`
   narrate end to end.
2. **This repo's own supply-chain/CI security** (the ordinary sense of "is this codebase
   itself safe to clone and run"): covered below under "Project hygiene."

## Known limitations of the RSA implementation (by design, not oversights)

Every item below is a real, named weakness class in `rsa/`, kept intentionally rather than
patched, because patching it would remove the thing the project exists to demonstrate. Each
is cross-referenced to the code/notes that discuss it.

- **No OAEP padding.** `rsa/core.py` implements plain PKCS7-block textbook RSA
  (`m^e mod n`), not RSA-OAEP. Textbook RSA is deterministic and malleable — flip bits in a
  ciphertext block and get a related, decryptable-but-garbage plaintext block. Real RSA
  (TLS, etc.) always wraps the same mathematical primitive in OAEP specifically to prevent
  this.
- **No constant-time operations.** `decrypt_int`'s `pow(c, d, n)`, `is_prime`'s Miller-Rabin
  loop, and `_pkcs7_unpad`'s padding-validity check are all ordinary Python, not built for
  timing-attack resistance. A real system decrypting attacker-controlled ciphertext needs
  constant-time comparisons specifically to avoid a Bleichenbacher-style padding-oracle
  timing side channel — `_pkcs7_unpad` validates padding *shape* correctly (see next item)
  but does so with an early `raise`, which is not constant-time.
- **No RSA blinding.** Real implementations blind the ciphertext before the private-key
  operation to defeat timing/power side-channel attacks against the exponentiation itself.
  Not implemented here.
- **Key generation doesn't defend against close primes.** `rsa/keygen.py`'s
  `generate_keypair` draws `p` and `q` independently from a CSPRNG, so they land close
  together only with negligible probability — but nothing explicitly rejects that case, and
  `attacker/classical.py`'s `fermat_factorization` is specifically built to demonstrate why
  historically-real "close primes" implementation bugs were catastrophic. Demonstrating the
  attack and hardening the keygen against it are in tension; this project chose to keep the
  attack demonstrable.
- **No minimum key size enforced.** `generate_keypair(bits)` accepts toy sizes (the whole
  demo runs at 8–16 bit keys so the classical/quantum attacks finish in human time).

### What *is* handled correctly

- **Randomness.** All real key material (`rsa/primes.py`'s `generate_prime`,
  `rsa/keygen.py`) and the classical attacker's search randomness
  (`attacker/classical.py`'s `pollards_rho`) use Python's `secrets` module (CSPRNG), never
  `random`. The *only* place this project uses `numpy.random.Generator` is
  `quantum/`'s simulated measurement sampling — that's modeling a physical quantum
  computer's inherently random measurement outcome, not protecting secret material, so a
  non-cryptographic PRNG there is correct, not a bug.
- **Primality testing.** `is_prime` is Miller-Rabin with 40 rounds by default
  (false-positive probability ≤ 4⁻⁴⁰), after fast-path trial division against small primes.
- **Malformed-ciphertext handling.** `rsa/core.py`'s `_pkcs7_unpad` validates that the
  padding byte is in `[1, block_size]` and that every claimed padding byte actually matches,
  raising `ValueError` on anything else. An earlier version trusted the last byte blindly,
  which had two real bugs on malformed input: a decrypted block ending in `0x00` made
  `pad_len=0`, and Python's `data[:-0]` slices to `data[:0]` (empty) rather than "no
  truncation" — silently returning an empty message instead of raising; a `pad_len` larger
  than the data similarly sliced silently. Both are now caught explicitly
  (`tests/test_rsa.py`'s `test_pkcs7_unpad_rejects_*` tests pin this down).
- **No unsafe code execution.** No `eval`, `exec`, `pickle`, `subprocess`, `os.system`, or
  shell-injection-shaped string formatting anywhere in the codebase.

## Project hygiene

- **Dependencies:** pinned minimum versions in `requirements.txt`/`requirements-dev.txt`,
  scanned for known CVEs by `pip-audit` in CI (`.github/workflows/ci.yml`) on every push/PR.
- **CI permissions:** the GitHub Actions workflow declares `permissions: contents: read`
  explicitly (least privilege) rather than relying on the broader default token scope.
- **Static analysis:** `ruff` (lint) and `mypy` (strict-ish type checking) run in CI and via
  `.pre-commit-config.yaml` for local development.
- **Secrets:** none are stored in this repo (verified by grep for common credential/key
  patterns as part of this review); `.gitignore` excludes local environment/cache
  directories.

## Reporting an issue

This is a personal/educational project, not a maintained security-critical service. If you
find a genuine bug (including in the "known limitations" above, if you find something not
already listed there), please open a GitHub issue.
