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
