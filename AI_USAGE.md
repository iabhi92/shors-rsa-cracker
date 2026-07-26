# AI Usage Log

Per project requirements: this build is done collaboratively with AI (Claude Code). This file is a running,
honest log of what AI helped with, what decisions were made and why, and links/screenshots of any external
AI chats (e.g. ChatGPT) used for debugging or brainstorming. Add to this as we go — don't backfill at the end.

Format per entry: date, what was built/decided, what AI contributed vs. what was human-driven, links/screenshots.

---

## 2026-07-26 — Project kickoff & scaffold

- **What**: Defined project scope and phased build plan (RSA from scratch → classical attacker demo →
  quantum crash-course notes → from-scratch NumPy statevector simulator → Shor's algorithm → fast sampling
  simulator for the live demo → FastAPI backend → frontend website → Cirq cross-validation stretch goal).
  Scaffolded the repo structure, git init, Python venv, `requirements.txt`.
- **AI contribution**: Claude Code proposed the repo layout and milestone ordering, asked clarifying
  questions on quantum-sim approach (from-scratch NumPy vs. Cirq — chose from-scratch first, Cirq as a
  later cross-check) and project location, then scaffolded the empty project structure.
- **Human contribution**: Overall project brief, mentor's approval and reading list (Aaronson blog, Quirk,
  Google Cirq Shor's tutorial, algassert.com posts), quality bar set by mentor's feedback on prior toy demos.
- **Chat link / screenshot**: _(add link to this Claude Code session or screenshot here)_

## 2026-07-26 — Quantum statevector simulator + Shor's algorithm (website deferred)

- **What**: User steered scope: defer the website to a later stage, put the effort into
  making the RSA/classical-attacker/quantum core "rock solid" rather than something that
  looks skimmed in a couple of hours. Built `quantum/statevector.py` (a from-scratch NumPy
  statevector simulator — registers, single-qubit gates, controlled gates, entanglement,
  marginal probabilities, measurement) and `quantum/qft.py` (QFT/inverse-QFT circuits,
  deliberately verified against the exact DFT matrix — ground truth, not hand-derived — for
  every basis state and random states across 1-6 qubits, plus a round-trip check). Then
  `quantum/modexp.py` (controlled modular exponentiation, implemented as a permutation on
  the statevector — documented explicitly as the one scope boundary: we don't re-derive
  reversible arithmetic circuits gate-by-gate, we implement the exact unitary they'd realize)
  and `quantum/shor.py` (full pipeline: superposition, controlled-U, inverse QFT, measurement,
  continued-fractions period extraction, and the classical gcd step — with real handling of
  every known Shor's-algorithm failure mode: odd period, a^(r/2)=-1 mod N, gcd(a,N)!=1
  shortcuts, N even/prime-power pre-checks). 104 tests pass project-wide. `scripts/demo_crack.py`
  demonstrates the full circle: generate a real RSA keypair, encrypt a secret, factor the
  public modulus with nothing but Shor's algorithm, recover the private key, decrypt —
  without the "attacker" ever touching the private key.
- **AI contribution**: Claude Code wrote all of the above, including catching two real bugs
  via the test suite before they shipped: (1) a test's own wrong assumption that all four
  exact-peak measurements for N=15 recover the period — corrected after checking the math:
  measured=128 corresponds to k=2 sharing a factor with r=4, a genuine expected Shor's-
  algorithm collision, not a bug; (2) a real bug in `rsa/core.py` — `encrypt_bytes` on tiny
  demo-sized N (e.g. 35, 143) crashed with a bare `ZeroDivisionError` instead of a clear
  error, now fixed with an explicit message pointing at `encrypt_int`/`decrypt_int` for keys
  too small to hold a byte. Also decided the modexp-as-permutation scope boundary rather
  than building gate-level reversible arithmetic, and validated the QFT circuit numerically
  against the DFT matrix rather than trusting a hand derivation.
- **Human contribution**: The scope-narrowing steer (no website yet, make the core solid)
  that directly drove the property-based tests, the multi-failure-mode Shor's pipeline, and
  verifying the QFT against ground truth instead of shipping an unverified derivation.
- **Chat link / screenshot**: _(add link to this Claude Code session or screenshot here)_

## 2026-07-26 — Crash-course notes

- **What**: Wrote `notes/01-quantum-basics.md`, `notes/02-qft-and-period-finding.md`,
  `notes/03-shors-algorithm-math.md` — covering qubits/superposition/tensor products/gates,
  the QFT and why it finds periods, and the full factoring-to-order-finding reduction —
  written to explain *this specific codebase* (cites actual file/test names) rather than
  being generic textbook material, and citing the mentor-provided resources (Aaronson blog,
  algassert.com/post/1718, the Cirq Shor's tutorial) where they directly informed a design
  or verification choice.
- **AI contribution**: Claude Code wrote the notes, explicitly documenting the modexp-as-
  permutation scope boundary and the continued-fractions gcd-collision subtlety discovered
  while testing, so the reasoning behind both is traceable later.
- **Human contribution**: Requested the notes be built progressively alongside the code
  (not dumped at the end) as part of the "take me on a journey" framing for this project.
- **Chat link / screenshot**: _(add link to this Claude Code session or screenshot here)_

## 2026-07-26 — RSA core + classical attacker suite

- **What**: Implemented RSA fully from scratch (`rsa/primes.py` Miller-Rabin, `rsa/keygen.py`
  extended-Euclid keygen, `rsa/core.py` PKCS7-padded block encrypt/decrypt with an explicit
  docstring on why textbook RSA is insecure). Added 25 tests including hypothesis
  property-based tests for `extended_gcd`/`mod_inverse`/round-trip encryption, plus edge
  cases (empty message, block-boundary message, multibyte unicode, padding-lookalike bytes).
  Then implemented four classical factoring attacks from scratch (`attacker/classical.py`:
  trial division, Fermat's method, Pollard's rho, Pollard's p-1), each paired with tests that
  construct composites specifically designed to exercise that method's strength/weakness
  (close primes for Fermat, smooth p-1 for Pollard's p-1). Built `scripts/benchmark_classical.py`,
  which generates real RSA keypairs at increasing bit sizes and times real attacks against
  them, producing `data/classical_benchmark.{csv,png}` — measured evidence (not just
  assertion) that trial division blows up exponentially while Pollard's rho fares better
  but still can't touch real key sizes.
- **AI contribution**: Claude Code wrote all of the above, including deciding which
  classical algorithms were worth implementing (declined quadratic sieve / GNFS as
  disproportionate for the demo's scope) and designing the benchmark's bit-size range to
  stay within a few minutes of runtime while still being unambiguously exponential.
- **Human contribution**: Explicit steering — deferred the website build to a later stage
  and asked for the core (RSA/attacker/quantum) to be "rock solid," not something that
  looks skimmed in a couple of hours. That's what drove the property-based tests, the
  multi-method attacker (not just one factoring algorithm), and the measured-not-asserted
  benchmark plot.
- **Chat link / screenshot**: _(add link to this Claude Code session or screenshot here)_
