# The Quantum Fourier Transform, and why it finds periods

Implemented in `quantum/qft.py`. This is the piece that turns "we evaluated a function at
every input in superposition" into "we can read off the function's period" — the actual
quantum trick in Shor's algorithm. Phase estimation / QFT intuition cross-checked against
[Craig Gidney's Shor's-algorithm walkthrough](https://algassert.com/post/1718), which your
mentor flagged as the high-quality bar for this kind of explanation.

## Definition

For an n-qubit register, the QFT is the unitary

    QFT|x⟩ = (1/√(2ⁿ)) · Σ_{y=0}^{2ⁿ-1} exp(2πi·x·y / 2ⁿ) |y⟩

This is exactly the discrete Fourier transform, just relabeled as a unitary operator on
amplitudes instead of a transform on a classical signal. `quantum/qft.py`'s `dft_matrix()`
builds this definition directly (a `2ⁿ×2ⁿ` matrix) — but only as **ground truth for testing**.
The actual `apply_qft()` never builds that matrix; it builds the equivalent circuit from `H`
and controlled-`phase` gates (`O(n²)` gates total, vs. the `O(4ⁿ)` cost of the matrix), and
`tests/test_quantum_statevector.py` checks the two agree exactly on every basis state and on
random states across 1-6 qubits.

Getting this circuit's qubit ordering and rotation signs right by hand-derivation is a classic
source of silent, hard-to-notice bugs (the algorithm still "looks like it works" with a
wrong convention, since the output is still some unitary transform — it's just the *wrong*
one). Rather than trust a paper derivation, the approach here was: implement the circuit,
compare numerically against `dft_matrix()` for many random inputs, and treat any mismatch as
a bug to fix in the circuit code. That's the version now in the repo, verified rather than
merely derived.

## Why a Fourier transform finds a period

Say a function `f` (here, `f(x) = aˣ mod N`) has period `r`: `f(x+r) = f(x)` for all `x`.
If we could put a register into the state `(1/√k) Σ_j |x₀ + j·r⟩` for some fixed offset `x₀`
— i.e. an equally-weighted superposition over every point that shares the same `f` value —
its Fourier transform would have sharp peaks at multiples of `2ⁿ/r`, because a Fourier
transform of "evenly spaced spikes with spacing `r`" is itself "evenly spaced spikes with
spacing `2ⁿ/r`" (the same reason a Dirac comb's Fourier transform is a Dirac comb). Measuring
after the QFT then yields (with high probability) some `y ≈ k·2ⁿ/r` for a random integer `k`
— and from `y/2ⁿ ≈ k/r`, the classical continued-fractions algorithm recovers `r` (see
`03-shors-algorithm-math.md`).

Shor's algorithm doesn't literally prepare that clean periodic superposition directly — it
gets there via controlled modular exponentiation applied to a *uniform* superposition over
all `x` (see the next note), which produces a state that's periodic in exactly the sense
above once you look at what values of `x` share a target-register value. The QFT step is
identical either way.

## `apply_qft` vs `apply_inverse_qft`

Shor's algorithm applies the **inverse** QFT to the control register (this is the standard
convention across every reference on Shor's algorithm, including the Cirq tutorial your
mentor linked — the sign of the phase rotation is the only thing that differs from the
forward QFT). `apply_inverse_qft` is implemented as the literal gate-reversal of `apply_qft`:
same gates in reverse order, phase angles negated, since `H` and `SWAP` are self-inverse and
`phase(θ)⁻¹ = phase(-θ)`. `test_inverse_qft_undoes_qft` checks the round trip holds exactly
for random states across 1-6 qubits — a second, independent correctness signal beyond the
DFT-matrix comparison above.
