# Gate-level modular exponentiation: crossing the one scope boundary

`quantum/modexp.py` computes `|x⟩|y⟩ ↦ |x⟩|y·aˣ mod N⟩` as the permutation matrix it
mathematically is — a deliberate, named scope boundary (see `03-shors-algorithm-math.md`).
This note covers `quantum/modexp_circuit.py` and `quantum/adder.py`: the same operation,
built entirely from elementary single- and multi-controlled single-qubit gates, with no
classical shortcut in the arithmetic anywhere. It's the standard construction used by real
Shor's-algorithm circuits (Vedral-Barenco-Ekert reversible arithmetic, redone in the Fourier
basis per Draper and assembled into modular exponentiation per Beauregard, 2002), rebuilt
here from the definitions rather than transcribed, and verified at every layer against
ground truth before being trusted as a building block for the next layer.

## Layer 1: addition, for free, in the Fourier basis

Draper's trick: a register already in the QFT basis can have a classical constant `a` added
to it using only single-qubit phase gates — no carry logic, no ancilla. Rederiving this
directly from *this project's own* QFT convention (`quantum/qft.py`'s docstring) rather than
copying a paper's differing qubit-ordering convention: `QFT|x⟩ = (1/√2ⁿ) Σᵧ
exp(2πixy/2ⁿ)|y⟩`. An operator `ADD(a)` satisfying `ADD(a)·QFT|x⟩ = QFT|x+a mod 2ⁿ⟩` must
multiply the `|y⟩`-amplitude of `QFT|x⟩` by `exp(2πiay/2ⁿ)` — a phase depending only on `y`.
Writing `y` in binary MSB-first (`y = Σₖ yₖ·2ⁿ⁻¹⁻ᵏ`, this project's convention everywhere),
that phase factors into independent single-qubit phases:

    exp(2πiay/2ⁿ) = ∏ₖ exp(2πi·a·yₖ / 2ᵏ⁺¹)

so `ADD(a)` is exactly `n` single-qubit phase gates — `phase(2πa/2ᵏ⁺¹)` on qubit `k` — with
no qubit-qubit interaction. `apply_fourier_add_constant` (`quantum/adder.py`) implements
exactly this, and makes it controlled "for free": each single-qubit phase gate just becomes
a multi-controlled phase gate via `QuantumRegister.apply_multi_controlled_gate`.

Not trusted on the derivation alone: `tests/test_quantum_adder.py` checks
`QFT → add → inverse-QFT` reproduces `(x+a) mod 2ⁿ` exactly against plain classical integer
addition, for every `x` and many random `a`, across several register sizes — the same
"verify against ground truth, not just the derivation" discipline as the QFT-vs-DFT-matrix
test in `02-qft-and-period-finding.md`.

## Layer 2: modular addition, via an overflow-detection trick

`apply_modular_add_constant` computes `b ↦ (b + a) mod N` for a register `b` sized
`N.bit_length() + 1` — one bit wider than strictly needed to hold values `< N`, so its top
bit can serve as an overflow flag. The construction (five steps, all in
`quantum/modexp_circuit.py`):

1. Add `a`, then unconditionally subtract `N`. If `b + a ≥ N`, the result lands in `[0, N)`
   with the extra top bit still `0`. If `b + a < N`, subtracting `N` underflows — the result
   wraps to a value `≥ 2ⁿ` in the `(n+1)`-bit register, setting that top bit to `1`.
2. Read that top bit into a scratch ancilla qubit via a CNOT (dropping briefly out of the
   Fourier basis to do it, then back in).
3. Conditionally add `N` back, controlled on the ancilla — undoing the underflow exactly
   when it happened.
4. Run the sign-check *again*, but on `b - a` instead of `b` (i.e. subtract `a`, check the
   sign, flip the ancilla). This is the part that isn't obvious on first read: steps 1-3
   leave the *correct output* in `b`, but the ancilla still holds a record of *which case
   happened* — and that record, left entangled with the rest of the computation, would
   destroy the interference the whole rest of Shor's algorithm depends on. Re-deriving the
   same sign bit from the now-correct `b` and using it to flip the ancilla back to `0` erases
   that record without touching the answer.
5. Add `a` back to restore the final value.

Making the whole thing doubly-controlled (needed for layer 3) turns out to only require
gating the three `±a` sub-steps (1's add, 4's subtract, 5's restore) by the outer controls —
the `±N` sub-steps stay unconditional. Tracing through the control=0 case by hand confirms
it: `b` gets perturbed by the unconditional `-N`/`+N` pair and ends up back where it
started, and the ancilla's sign-flip trick correctly nets to `0` regardless of whether the
`±a` steps fired. `apply_modular_subtract_constant` is the *mechanically derived* adjoint —
same five steps reversed and individually inverted (`phase(θ)→phase(-θ)`, `QFT↔inverse-QFT`,
self-adjoint `X`/CNOT unchanged) — not "just call add with `N-a`", specifically so it stays
correct on the full Hilbert space rather than only the input's physically-populated subspace.

Verified in `tests/test_quantum_modexp_circuit.py` by brute force: every `(N, a, b)` with
`N` up to 20 checked against plain `(b+a) mod N`, the controlled version checked to no-op at
control=`0`, and `add` followed by `subtract` checked to reproduce the identity exactly.

## Layer 3: controlled multiplication mod N, and the register-reuse trick

`apply_cmult_mod` computes `b ↦ (a·x) mod N` into a fresh scratch register `b` (starting at
`|0⟩`), by chaining one modular addition per bit of `x` — each addition doubly-controlled on
an outer control qubit *and* that bit of `x`, adding `a·2ʷ mod N` for that bit's place value
`w`. `x` itself is only ever read via control, never written.

The subtlety: Shor's algorithm needs the *result* sitting back on the `x`-shaped register
(so it can be fed into the next multiplication in the exponentiation chain), not stranded on
a separate scratch register — but allocating a fresh scratch register per multiplication
would make the qubit count grow with `n_count` instead of staying fixed.
`apply_controlled_multiply_mod_N` solves this with the standard three-step trick:

1. `apply_cmult_mod(a)`: scratch `b` becomes `a·x mod N`; `x` unchanged.
2. Controlled-swap `x` with `b`: now `x` holds `a·x mod N`, and `b` holds the *original* `x`.
3. Apply the *adjoint* of `apply_cmult_mod(a⁻¹ mod N)`, using the (now `a·x mod N`-holding)
   `x` register as the control-bit source and writing into `b` (which currently holds old
   `x`): this subtracts `a⁻¹·(a·x mod N) mod N = x` from `b`, leaving `b` back at `|0⟩`.

Net effect: `x → a·x mod N`, scratch register and flag ancilla both restored to `|0⟩`,
control=`0` a clean no-op throughout (every step above is itself controlled). `a⁻¹ mod N`
comes from `rsa.keygen.mod_inverse` — the same extended-Euclidean-algorithm code the RSA
keygen itself uses, not a new implementation.

Verified in `tests/test_quantum_modexp_circuit.py` against plain `(a*x) % N` for every valid
`(N, a, x, control)` with `N` up to 15, *and* checked that 100% of the resulting probability
mass sits on the expected `x`-value with the ancilla at `|0⟩` — i.e. zero leaked
entanglement, not just "the most likely outcome is right."

## Layer 4: exponentiation, and the honest-vs-shortcut cross-check

`apply_modular_exponentiation_circuit` chains `n_count` controlled multiplications — one per
control (exponent) qubit, by the classical constant `a^(2^w) mod N` for that qubit's place
value `w` — directly realizing `target *= aˣ mod N` for control-register value `x`, across
the whole superposition simultaneously. `quantum.shor.find_period_quantum_gate_level` wires
this into the same period-finding pipeline as `find_period_quantum`, as a drop-in
alternative `period_finder` for `shors_algorithm`.

The load-bearing test is `test_gate_level_modexp_matches_permutation_shortcut_statevector_exact`
in `tests/test_quantum_modexp_circuit.py`: build the same `(N, a, n_count)` circuit both ways
(this module's gate cascade, and `quantum/modexp.py`'s permutation), project the gate-level
result onto its ancilla-`|0⟩` subspace, and compare to the permutation-shortcut statevector
with `np.allclose(..., atol=1e-7)` — the same "two independent implementations, compared
bit-for-bit" standard already applied to the Cirq cross-check in `03-shors-algorithm-math.md`.
It passes across every `(N, a, n_count)` tried, with ancilla leakage below `1e-8` every time.
`scripts/demo_crack_honest_circuit.py` then runs the whole thing end to end — a real toy RSA
key, factored and decrypted, with zero shortcuts anywhere in the quantum arithmetic.

## The actual cost of honesty

This construction needs `n_target + 2` extra ancilla qubits beyond the permutation
shortcut's `n_count + n_target` (a `b` register of `n_target + 1` qubits, plus one flag,
reused across every multiplication rather than allocated fresh each time — see
`ancilla_qubit_count`). For `N=15` (`n_target=4`) that's 6 extra qubits; `demo_crack_honest_circuit.py`
prints the actual qubit counts for both paths side by side. This is exactly why the project
keeps *both* implementations rather than replacing the shortcut outright:
`find_period_quantum` (permutation) reaches larger `N` on a classical laptop;
`find_period_quantum_gate_level` (this construction) is the more honest one, and reaches
smaller `N` as the real, measured price of not shortcutting the arithmetic — not a claim
that one obsoletes the other.

## Resource estimate: what this construction would actually cost at N=2048 bits

Neither this circuit nor any classical computer can *run* at real RSA key sizes — the
statevector is `O(2^n_qubits)`, and `n_qubits` for a 2048-bit `N` is in the thousands. But
counting qubits and gates doesn't require simulating amplitudes at all: every loop bound and
branch in `quantum/adder.py`, `quantum/qft.py`, and `quantum/modexp_circuit.py` depends only
on classical parameters (`N`, `a`, `n_count`, `n_target` — never on the actual quantum
state), so `quantum/resource_estimate.py`'s `CountingRegister` runs that same, unmodified
circuit-emission code against a backend that counts gate calls instead of applying them, with
no `2^n_qubits` array ever allocated.

That still isn't enough on its own — literally executing the O(`n_count · n_target³`) nested
loops is fast for small `N` but would take on the order of `10^13` Python-level iterations at
`n_target=2048`, computationally infeasible. So `closed_form_gate_counts` derives the exact
polynomial by hand from the same structure (documented step by step in its docstring) and
`tests/test_resource_estimate.py` checks it reproduces `CountingRegister`'s real, measured
counts **exactly** — not approximately — across several small `(n_count, n_target)` pairs
before it's trusted to extrapolate anywhere CountingRegister itself can't reach.

`scripts/resource_estimate.py` runs that extrapolation out to `N=2048` bits and plots it
(`data/quantum_resource_estimate.png`) against Gidney & Ekerå's published estimate for an
actual fault-tolerant quantum computer (arXiv:1905.09749, "How to factor 2048 bit RSA
integers in 8 hours using 20 million noisy qubits", 2021 *Quantum* journal version; a 2025
follow-up, arXiv:2505.15917, brings the *physical*-qubit figure below one million). At
`N=2048`:

| | this project (unoptimized) | Gidney & Ekerå 2019 |
|---|---|---|
| qubits | 8,194 | 6,189 (logical) |
| gates | ~103 billion (Toffoli-equivalent) | ~2.6 billion (Toffolis) |

Reading that table honestly matters more than the numbers themselves. The qubit counts land
in the *same order of magnitude* — genuinely striking for a construction built purely to be
verified against ground truth at every layer, with zero effort spent minimizing qubit count.
The gate count is ~39x higher, which is the real, expected cost of that same lack of
optimization: this project's `apply_cmult_mod` does one modular addition per bit of `x`
sequentially (schoolbook-style), where Gidney & Ekerå's construction uses windowed arithmetic
and approximate adders specifically engineered to cut Toffoli count — optimizations this
project deliberately didn't build, because the point here was a construction whose every
piece could be checked against ground truth, not a minimal one. And Gidney & Ekerå's 20
million *physical* qubits (vs. their own 6,189 *logical* qubits) is a separate, much larger
gap again — the cost of surface-code error correction on real noisy hardware, which neither
construction here models at all.

The honest, falsifiable claim this table supports: **both are polynomial in `n`, not
exponential** — `tests/test_resource_estimate.py`'s
`test_qubit_count_is_linear_in_modulus_bits_not_exponential` pins this down concretely
(doubling the modulus size roughly doubles the qubit count, not squares it). That's the
actual mathematical content behind "Shor's algorithm breaks RSA," arrived at here completely
independently of Gidney & Ekerå's own numbers, which is a stronger form of confirmation than
matching their exact figures would have been.

## Development note: layered verification, not a single big test at the end

Each layer above was built and checked against ground truth *before* the next layer was
built on top of it — the Fourier adder against classical addition, the modular adder against
classical modular addition (including the controlled and adjoint variants separately), the
controlled multiplier against classical modular multiplication with an explicit
zero-ancilla-leakage check, and only then the full exponentiation circuit against the
existing permutation shortcut. That ordering is why the final cross-validation test passed
on the first run with no debugging: by the time it ran, every gate sequence underneath it had
already been independently confirmed correct, so there was no compounded, hard-to-localize
bug for it to catch — only a final confirmation that composing already-correct pieces
produced the already-expected whole.
