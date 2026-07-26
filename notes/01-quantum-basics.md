# Quantum computing basics, as implemented in `quantum/statevector.py`

Primary reference for this section: Scott Aaronson's ["Quantum Computing Since Democritus"
lecture notes](https://scottaaronson.blog/?p=208) — the linear-algebra-first framing there
(quantum mechanics as "probability theory with minus signs") is exactly the mental model
used below, and is the fastest route in if you already know linear algebra.

## A qubit is a unit vector in C²

One classical bit is 0 or 1. One qubit is a unit vector

    |ψ⟩ = α|0⟩ + β|1⟩,   α, β ∈ C,   |α|² + |β|² = 1

`|0⟩ = (1, 0)` and `|1⟩ = (0, 1)` are just basis vectors; `α`, `β` are amplitudes. The
constraint `|α|²+|β|²=1` is the only thing that makes this "quantum" rather than "a 2D
vector" — it's what turns amplitudes into a probability distribution via the **Born rule**:
measuring `|ψ⟩` gives outcome 0 with probability `|α|²`, outcome 1 with probability `|β|²`,
and the state collapses to whichever basis vector was observed. `QuantumRegister.measure()`
in `statevector.py` is a literal implementation of this rule (`probs = |amplitude|²`, sample,
collapse).

## n qubits is a unit vector in C^(2ⁿ) — not n separate qubits

This is the single most important fact in the whole project, and the reason quantum
simulation is classically expensive. n independent classical bits need n bits of storage.
n qubits need a vector of `2ⁿ` complex amplitudes — one per possible n-bit string — because
the joint state is a vector in the **tensor product** space `C²⊗C²⊗...⊗C²`, not a list of n
separate C² vectors. A *general* n-qubit state cannot be factored back into a product of n
single-qubit states; when it can't, the qubits are **entangled**.

`QuantumRegister` in `statevector.py` stores this directly: `self.state` is a length-`2ⁿ`
complex array. Nothing about that array knows or cares which subset of it "belongs" to which
qubit — that's an interpretation we impose via reshaping into a `[2]*n` tensor when applying
gates. This 2ⁿ blowup is *why* `quantum/shor.py` can only honestly simulate small N (see the
qubit-count discussion in `03-shors-algorithm-math.md`) — it's also, not coincidentally,
exactly the resource a real quantum computer *doesn't* pay, which is the entire premise of
this project.

## Gates are unitary matrices

A quantum gate is a unitary matrix `U` (i.e. `U†U = I`) applied to the state vector. Unitary
means norm-preserving — probabilities always sum to 1 after any gate, forever, which is why
`is_normalized()` is a useful sanity check throughout the test suite. The gates implemented
in `statevector.py`:

- **H (Hadamard)**: `(1/√2)[[1,1],[1,-1]]`. `H|0⟩ = (|0⟩+|1⟩)/√2` — turns a classical bit
  into an equal superposition. Applying H to every qubit of an n-qubit `|0...0⟩` register
  gives an equal superposition over **all 2ⁿ basis states at once** — this is the "try every
  input simultaneously" step at the start of Shor's period-finding circuit.
- **X, Y, Z**: the Pauli gates — X is a bit-flip (`|0⟩↔|1⟩`), Z is a phase-flip (`|1⟩→-|1⟩`),
  Y is both.
- **phase(θ)**: `diag(1, e^{iθ})` — a relative-phase rotation, the building block of the QFT
  (see `02-qft-and-period-finding.md`).
- **Controlled gates** (`apply_controlled_gate`): apply a single-qubit unitary to a target
  qubit, but only within the subspace where a control qubit is `|1⟩`. This is how classical
  "if" logic survives into a reversible, unitary world, and it's the mechanism behind both
  entanglement (`CNOT` on a superposed control produces a Bell state — see
  `test_bell_state_entanglement`) and the whole idea of "apply an operation conditioned on a
  register that's itself in superposition," which is exactly what Shor's algorithm needs for
  its `|x⟩ ↦ |x⟩|aˣ mod N⟩` step.

## Why gates are applied via `tensordot`, not by building a 2ⁿ×2ⁿ matrix

A single-qubit gate acting on qubit `k` of an n-qubit register is, formally,
`I⊗...⊗U⊗...⊗I` — a `2ⁿ×2ⁿ` matrix. Building that matrix explicitly costs `O(4ⁿ)` memory and
time, which is wasteful and would make even a 15-qubit simulation (N=15's honest Shor's run)
impractical. `apply_gate`/`apply_controlled_gate` instead reshape the length-`2ⁿ` state into
a `[2]*n` tensor and contract the small `2×2` gate against just the one axis that qubit
occupies — `O(2ⁿ)` time, matching the actual amount of information in the state. This is a
standard statevector-simulator technique, not a shortcut specific to this project — it's
just the numerically sane way to apply a sparse structured operator.

## Measurement, and why we use marginal probabilities

`measure()` collapses the *entire* register. But Shor's algorithm only measures a subset of
qubits (the control register — see `03-shors-algorithm-math.md`) while leaving the rest
(the target register) alone. The correct way to compute "what would measuring just these
qubits yield" is to marginalize: sum `|amplitude|²` over every basis state that agrees on the
measured qubits, for each measured-qubit outcome. That's `marginal_probabilities()` — tested
directly against a GHZ state (`test_marginal_probabilities_preserves_correlation_in_ghz`) to
confirm it preserves correlation between un-summed qubits rather than accidentally computing
independent per-qubit probabilities (a very easy bug to introduce here, since it would still
look plausible on independent/product states and only show up on entangled ones).
