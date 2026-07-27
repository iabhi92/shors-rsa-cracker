"""Every input range the API accepts, in one place, so the safety story is auditable without
hunting through each router. These aren't arbitrary: they're chosen so the *slowest* case of
each operation still finishes in low single-digit seconds on an ordinary server.

RSA keygen: rsa.primes.generate_prime does trial division against small primes then
Miller-Rabin; bits capped at 24 keeps worst-case generation well under a second even for an
unlucky run of composite candidates.

Classical attacks: attacker.classical's functions already accept a `timeout` parameter
(seconds) -- this backend always passes one, and additionally caps the input `n` itself so
trial_division's O(sqrt(n)) worst case can't be reached by a huge n before the timeout logic
even gets a chance to check the clock (trial_division only checks elapsed time every 200_000
iterations).

Shor's algorithm: N is restricted to a fixed allow-list rather than an open range, matching
tests/test_quantum_shor.py's SMALL_COMPOSITES -- these are exactly the values the honest
simulator has already been proven correct and fast against. The gate-level backend is
additionally restricted to its own, much smaller allow-list (SHOR_GATE_LEVEL_ALLOWED_N):
its ancilla cost (see notes/04) is driven by N.bit_length(), not by n_count, so capping
n_count alone doesn't bound its runtime -- N=65 with the gate-level backend was measured
directly during development to take minutes, not seconds (22 qubits total), while N=15 was
repeatedly measured at ~2s/attempt throughout this project's own development and its IBM
hardware validation work. Rather than a guessed cutoff, this is the one value that's been
directly, repeatedly measured as fast.

Quantum demo endpoints: capped at a small qubit count for the same reason quantum.statevector
itself is only ever used at small scale in this project -- the state vector is O(2^n).
"""

# --- RSA -----------------------------------------------------------------------------------
RSA_MIN_BITS = 8
RSA_MAX_BITS = 24
RSA_MAX_MESSAGE_BYTES = 256

# --- classical attacks -----------------------------------------------------------------------
CLASSICAL_MIN_N = 4
CLASSICAL_MAX_N = 10_000_000
CLASSICAL_ATTACK_TIMEOUT_SECONDS = 5.0

# --- quantum statevector demos ----------------------------------------------------------------
STATEVECTOR_DEMO_MAX_QUBITS = 4
QFT_DEMO_MAX_QUBITS = 6

# --- Shor's algorithm --------------------------------------------------------------------------
SHOR_ALLOWED_N = (15, 21, 33, 35, 51, 55, 65)
SHOR_GATE_LEVEL_ALLOWED_N = (15,)  # see docstring above -- the one directly-measured-fast case
SHOR_MAX_ATTEMPTS = 20
# The Cirq backend (notes/03: ~10s/shot at 18 qubits on Cirq's general-purpose simulator, vs.
# ~0.1s for this project's own statevector.py) is far more expensive per n_count than the
# honest/fast backends -- capped low so a synchronous web request stays responsive.
SHOR_MAX_SLOW_BACKEND_N_COUNT = 6

# --- resource estimate -------------------------------------------------------------------------
RESOURCE_ESTIMATE_MIN_BITS = 8
RESOURCE_ESTIMATE_MAX_BITS = 4096
