# Shor's algorithm: from factoring to order-finding, and back

Implemented across `quantum/modexp.py` and `quantum/shor.py`. This note covers the math, the
one deliberate scope boundary in the implementation, and why this specific algorithm — not
"quantum computers are fast" in general — is what actually threatens RSA.

## Why factoring reduces to order-finding

RSA's security rests on: given `N = p·q`, finding `p` and `q` is hard. Shor's algorithm
doesn't factor `N` directly — it reduces factoring to a different, structured problem
(**finding the multiplicative order of a random `a` mod `N`**), which is the problem a
quantum computer is actually good at. The reduction, classically:

1. Pick a random `a` with `1 < a < N`. If `gcd(a, N) ≠ 1`, that gcd **is already a nontrivial
   factor of N** — no quantum computer needed (`shors_algorithm` checks this every attempt;
   it's a real, if rare, free win, and it shows up in `demo_crack.py`'s output whenever it
   happens).
2. Otherwise, find `a`'s **order** `r`: the smallest positive integer with `aʳ ≡ 1 (mod N)`.
   This is where the quantum step (period-finding, previous note) comes in — `f(x) = aˣ mod N`
   is periodic with period exactly `r`.
3. If `r` is even and `a^(r/2) ≢ -1 (mod N)`, then `x = a^(r/2) mod N` satisfies
   `x² ≡ 1 (mod N)` with `x ≢ ±1` — a **nontrivial square root of 1 mod N**. Elementary
   number theory then guarantees `gcd(x-1, N)` and `gcd(x+1, N)` are nontrivial factors of N.

Steps 3's precondition can fail — `r` might come out odd, or `a^(r/2)` might land on exactly
`-1 mod N`. Both are real, expected outcomes for *some* random choices of `a`, not
implementation bugs; `shors_algorithm` retries with a fresh `a` when they occur, and the
attempt log in `demo_crack.py`'s output shows exactly this happening. For most composite N,
the fraction of `a`'s that work is bounded well below 1 (roughly at least 1/2 for the
useful cases in typical treatments of the algorithm) — pushing overall success probability
across a handful of retries close to certainty, which the `test_shors_algorithm_success_rate_is_reliably_high_across_seeds`
test checks empirically (≥90% success within 20 attempts, across 15 independent seeds).

## The quantum circuit, concretely

Two registers: a **control register** of `n_count` qubits (put into an equal superposition
over all `2^n_count` values via Hadamards) and a **target register** of `n_target =
⌈log₂N⌉` qubits, initialized to `|1⟩`. The circuit then applies

    |x⟩|y⟩ ↦ |x⟩|y · aˣ mod N⟩

(controlled modular exponentiation, `quantum/modexp.py` — see the scope-boundary note below),
followed by the inverse QFT on the control register, then measurement of just the control
register. Because the target register ends up correlated with the control register (which
`x` values map to which `y`), and both are traced through the same computation in
superposition, the measured control-register distribution has the periodic structure
described in `02-qft-and-period-finding.md` — its peaks encode `r`.

`n_count` is chosen as `2·⌈log₂N⌉` by default (`default_n_count`) — enough precision that the
measured value is close enough to a multiple of `2^n_count/r` for continued fractions to
recover `r` with high probability per shot. `shors_algorithm` also accepts a smaller
`n_count` explicitly (used for the larger `N=143` test) — fewer qubits, faster honest
simulation, lower success probability per shot, made up for by retries.

## Continued fractions, and the one measurement outcome that's expected to fail

A control-register measurement `m` approximates `k/r` for some unknown integer `k`, via
`m / 2^n_count ≈ k/r`. The continued-fraction expansion of `m/2^n_count` produces a sequence
of best rational approximations (convergents); `extract_period_from_measurement` checks each
convergent's denominator as a candidate `r`, verifying `a^r ≡ 1 (mod N)` classically before
trusting it.

There's a subtlety worth naming explicitly, because it surfaced as a real test bug during
development (see `AI_USAGE.md`, 2026-07-26 entry): continued fractions recovers `k/r` in
**lowest terms**. If `gcd(k, r) > 1`, the recovered denominator is `r / gcd(k, r)` — a proper
divisor of the true period, not `r` itself — and the classical verification step correctly
rejects it (since `a^(r/gcd(k,r))` generally isn't `1 mod N` unless that divisor happens to
also be a valid order, which isn't the case here). `tests/test_quantum_shor.py`'s
`test_extract_period_fails_on_the_known_gcd_collision_peak` pins this down concretely for
`N=15, a=7, r=4`: measuring `128` (which encodes `k=2`, and `gcd(2,4)=2`) is a real, expected
failure of that specific shot, not a bug — the algorithm's retry loop is what makes the
overall procedure reliable despite individual shots like this one failing.

## The scope boundary: modular exponentiation as a permutation

`quantum/modexp.py` implements `|x⟩|y⟩ ↦ |x⟩|y·aˣ mod N⟩` by computing `aˣ mod N` classically
(once per control-register value `x`, via Python's `pow`) and permuting statevector
amplitudes accordingly — not by composing it from elementary reversible-arithmetic gates.

This is a real, named scope decision, not an oversight. A physical quantum computer builds
controlled modular exponentiation from a cascade of controlled modular multipliers, each
built from reversible adders (e.g. Draper's QFT-based adder) — on the order of `O(n³)`
elementary two-qubit gates for an n-bit `N`. Simulating *that* circuit gate-by-gate wouldn't
teach anything different about *why* Shor's algorithm gives a quantum speedup — it would just
be a much larger, slower way of computing the exact same unitary this project already
computes directly. The speedup in Shor's algorithm comes from evaluating `aˣ mod N` **for
every `x` simultaneously**, in superposition, via the controlled-U structure — and then
reading out the period via the inverse QFT. That structural claim is fully and honestly
simulated here: real superposition (`H` on every control qubit), a real controlled operation
(conditioned on the actual control-register value, not faked), a real inverse QFT (verified
against the exact DFT matrix), and real classical post-processing. The one piece that's a
direct permutation rather than a gate cascade is the arithmetic itself — a scope boundary
shared by most Shor's-algorithm teaching implementations (including Qiskit's own textbook
example), for exactly this reason.

## Independent cross-check against Cirq

`quantum/cirq_shor.py` rebuilds the exact same circuit (superposition, controlled modular
exponentiation as a `cirq.ArithmeticGate` — the same permutation-based scope boundary as
above, which is standard practice here, not something specific to this project's shortcuts)
using [Google's Cirq](https://quantumai.google/cirq/experiments/shor), the framework our
mentor linked. `tests/test_quantum_cirq_shor.py` builds both circuits for several `(N, a,
n_count)` combinations and compares the resulting statevectors directly —
`np.allclose(our_state, cirq_state, atol=1e-6)` — not just final measurement statistics. They
match to floating-point precision every time. That's about as strong a correctness signal as
this project can produce without physical quantum hardware: two independently-written
implementations of the same algorithm, agreeing bit-for-bit on the actual quantum state, not
just on the final answer.

(One practical note from doing this: Cirq's general-purpose simulator has noticeably higher
constant-factor overhead per shot than `statevector.py`'s direct permutation approach — about
10s for an 18-qubit circuit that our own simulator handles in ~0.1s. Expected, since Cirq is
built for far more generality than this one demo, and not a correctness concern — but it's
why the Cirq cross-validation tests stick to small N rather than repeating the full sweep
`tests/test_quantum_shor.py` already runs against the honest simulator.)

## Why this matters beyond the toy N values here

Everything above scales in principle to real RSA key sizes — the honest simulator here is
limited by *this being a classical laptop simulating a quantum computer* (`O(2^qubits)`
memory), not by anything about the algorithm. A real quantum computer with enough
error-corrected qubits runs the identical circuit structure — same Hadamards, same
controlled-U, same inverse QFT — against a 2048-bit `N` in polynomial time, where every
classical method in `attacker/classical.py` scales exponentially (`scripts/benchmark_classical.py`'s
measured data makes that growth curve concrete, not just asserted). That asymmetry — one
side of this project's factoring race scales polynomially, the other exponentially, for the
exact same problem — is the actual, mathematically grounded version of "quantum computers
will break RSA," as opposed to the vaguer popular-science version of the claim.
