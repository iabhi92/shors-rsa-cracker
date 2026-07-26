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

## Status

Work in progress — see `AI_USAGE.md` and commit history for the build log. Current milestone: RSA from scratch.
