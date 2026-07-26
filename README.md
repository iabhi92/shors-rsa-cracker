# Shor's Algorithm vs. RSA

A hands-on simulator (and eventually a live website) demonstrating why quantum computing breaks RSA:

1. RSA implemented from scratch in Python (`rsa/`) — no crypto libraries, so the weak points are visible.
2. A classical attacker (`attacker/`) that tries to factor the RSA modulus directly — fast for toy keys,
   exponentially hopeless for real ones.
3. A from-scratch quantum statevector simulator (`quantum/`) that runs the actual period-finding step of
   Shor's algorithm, plus the classical continued-fractions/gcd post-processing that turns a found period
   into RSA's secret factors.
4. `notes/` — crash-course writeups on the quantum computing concepts needed to understand the above,
   written while building this project.
5. `web/` — a live website: encrypt a message with RSA, watch a classical attacker fail, then hit a button
   to run the quantum simulator and crack it.

See `AI_USAGE.md` for a running log of AI-assisted work on this project (per project requirements).

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest
```

## Try it

```bash
python scripts/demo_cli.py         # RSA keygen/encrypt/decrypt round trip
python scripts/benchmark_classical.py   # measured classical-attack scaling -> data/
python scripts/demo_crack.py       # the full story: encrypt, then break it with Shor's algorithm
```

## Status

Core is built and tested (132 tests, `pytest`): RSA from scratch, a 4-method classical
attacker with a measured scaling benchmark, a from-scratch quantum statevector simulator
(gates, QFT verified against the exact DFT matrix), a full Shor's-algorithm pipeline that
handles every known real failure mode and breaks a real (toy-sized) RSA key end to end, a
fast/sampling simulator for N beyond the honest simulator's qubit budget, and an independent
cross-check against Google's Cirq (statevectors match to floating-point precision). Read
`notes/` for the math. The live website is intentionally deferred to a later stage.

See `AI_USAGE.md` and commit history for the full build log.
