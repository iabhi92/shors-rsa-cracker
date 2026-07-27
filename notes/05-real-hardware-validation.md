# Real hardware validation: running Shor's algorithm on an actual IBM quantum computer

Every other quantum result in this project — the honest statevector simulator
(`quantum/shor.py`), the gate-level circuit with zero shortcuts (`quantum/modexp_circuit.py`),
the Cirq cross-check (`quantum/cirq_shor.py`) — is a *simulation*. All three agree with each
other to floating-point precision, which is a genuinely strong correctness signal, but it's
still three programs agreeing with each other on a classical computer. None of them can
answer the one question a simulator fundamentally can't: does an actual, physically noisy
quantum computer reproduce the theoretical measurement distribution at all?

This note covers `quantum/ibm_hardware.py`, which answers that directly: a real circuit,
submitted to a real IBM quantum processor, compared against this project's own theoretical
prediction.

## Why a different, smaller circuit was needed

`quantum/modexp_circuit.py`'s general construction needs a target register of
`N.bit_length()` qubits plus `ancilla_qubit_count(N.bit_length())` scratch qubits, and dozens
of Fourier-adder gates per exponentiation step. That's fine for a noiseless simulator, but on
real NISQ hardware every extra gate accumulates decoherence and gate error — a circuit that
deep would almost certainly return noise, not signal.

The way around this, for a *specific* small `(a, N)` pair, exploits something knowable
classically in advance (the same category of shortcut `quantum/fast_sim.py` already documents
and uses): if `a`'s multiplicative order `r` mod `N` happens to be a power of two, the target
register never needs to represent its actual mod-`N` value at all. Only *which one* of the
`r` reachable values `{a^0, a^1, ..., a^(r-1)} mod N` the target holds ever matters for
period-finding — the state Shor's construction depends on, after tracing out the target
register, is invariant under any relabeling of the target's basis states, because that's just
a change of basis applied entirely within the part of the system that gets traced out. So
re-encoding the target as a compact `log2(r)`-qubit "cycle position" counter, and implementing
controlled-`U_a` as controlled modular addition mod `r` (not mod `N`) on that tiny register,
is an **exact** re-encoding, not an approximation.

`N=15` is used here for the same reason it's used everywhere else in this project: the group
`(Z/15Z)*` has order `phi(15) = 8 = 2^3`, so by Lagrange's theorem *every* valid `a` mod 15
automatically has an order that's a power of two. `tests/test_ibm_hardware.py`'s
`test_compiled_circuit_matches_ground_truth_exactly` proves this compiled circuit reproduces
`quantum/modexp.py`'s already-verified permutation simulator's exact marginal distribution,
for ten different `(a, n_count)` combinations, to `1e-9` — before any of this was trusted to
spend real hardware time on.

## A bug the local simulator caught before it ever reached real hardware

Two mistakes were made and caught during development, both against the local exact
simulator, neither on real hardware:

1. **Wrong exponent arithmetic.** The first version computed `addend = weight % r` for each
   counting qubit's contribution, where `weight` is the *exponent* (`quantum/modexp_circuit.py`'s
   own convention: counting qubit `i` controls `U_{a^(2^weight)}`). The correct addend is
   `2^weight mod r`, not `weight mod r` — conflating an exponent with the power it produces.
   Caught by comparing against `quantum/modexp.py`'s ground truth and seeing an obviously
   wrong (near-uniform, spread across values the theory says are impossible) distribution.
2. **Qiskit's `QFTGate` uses the opposite qubit-order convention from this project's own
   `quantum/qft.py`.** Using Qiskit's built-in gate produced a different, still-wrong
   distribution even after fixing (1). The fix: don't use it at all — `_apply_qft_project_convention`
   in `quantum/ibm_hardware.py` is a direct, gate-by-gate translation of `quantum/qft.py`'s own
   H + controlled-phase + swap sequence, removing any ambiguity about which convention is in
   effect.

Both were confirmed fixed by comparing exact statevector probabilities (not sampled counts)
against `quantum/modexp.py`'s ground truth across ten `(a, n_count)` pairs before writing a
single line intended for real hardware — the same layered-verification discipline documented
in `notes/04-gate-level-modular-exponentiation.md`.

## Qubit-ordering convention, verified empirically

Qiskit's returned bitstrings put classical bit 0 at the *rightmost* character, the opposite of
what a naive `int(bitstring, 2)` would assume if this project's own MSB-first convention were
used unchanged. Rather than reason this out and hope, it was checked directly: prepare a known
basis state, measure it, and confirm what Qiskit actually returns (see the git history of this
module's development, or re-derive it yourself — flip qubit 0, measure, and check
`int(bitstring, 2)` gives the expected integer). `build_compiled_circuit` maps counting qubit
`i` to classical bit `n_count-1-i` specifically so `int(bitstring, 2)` on Qiskit's own output
directly yields this project's MSB-first integer convention with no manual reversal needed.

## The actual result

Circuit: `a=7`, `N=15`, `n_count=3` (so `2^n_count=8`, and `r=4` divides `8` evenly — an exact-peak
case, the same one already used in `tests/test_quantum_shor.py`'s
`test_period_finding_distribution_matches_theory_exactly_for_power_of_two_period`). Theory
predicts probability exactly `0.25` at each of `{0, 2, 4, 6}` and exactly `0` everywhere else.

Transpiled for `ibm_marrakesh` (a 156-qubit IBM Heron-class processor) at optimization level 3:
depth 47, 77 gates total (30 `sx`, 27 `rz`, 16 `cz`, 3 `measure`, 1 `x`) — shallow enough to
survive real hardware noise while still doing the real thing.

Run twice independently, both on `ibm_marrakesh`, 4000 shots each (raw data:
`data/ibm_hardware_run_a7_N15.json` holds the second/latest run; comparison chart:
`data/ibm_hardware_comparison.png`):

| measured | theory | run 1 (job `d9j28pjhdfks73chmgr0`) | run 2 (job `d9j2eurhdfks73chmnmg`) |
|---|---|---|---|
| 0 | 0.250 | 0.246 | 0.243 |
| 2 | 0.250 | 0.259 | 0.241 |
| 4 | 0.250 | 0.257 | 0.264 |
| 6 | 0.250 | 0.237 | 0.253 |
| 1, 3, 5, 7 (combined) | 0.000 | 0.001 | 0.000 |

**Total variation distance from the theoretical prediction: 0.017 (run 1), 0.0165 (run 2).**
Run 1 had 4 of 4000 shots (0.1%) land on an outcome theory says is impossible; run 2 had zero.
Both are indistinguishable from the hardware's baseline readout error rate, not a sign the
algorithm's structure broke down, and the fact that two independent submissions landed this
close to each other is a real reproducibility signal — the first run wasn't a lucky sample.

This is, honestly, a better result than the circuit's depth alone would predict — real
2-qubit gate error rates on current hardware are typically in the 0.1–0.5% range, and a
16-CZ-gate circuit accumulating error naively could plausibly have shown a much larger
deviation on either run. That it didn't, twice, is worth taking as "this circuit and backend
combination happens to land well right now," not "this circuit is immune to noise" — a
different backend, a different day's calibration, or more shots could show a larger total
variation distance on a future run, and that would be a real result too, not a failure of the
method.

## What this does and doesn't prove

**Does**: confirms that the actual quantum interference structure this project's simulator
predicts — the specific, non-uniform, exactly-four-peaks-and-nothing-else distribution that
falls out of superposition, controlled-U, and the inverse QFT — is physically real and
observable on today's hardware, not just an artifact of the simulator's own math being
internally consistent.

**Doesn't**: this is not a claim that real hardware can factor real RSA-sized `N`. The compiled
circuit here only works because `r`'s value (and that it's a power of two) was known
classically in advance for this specific tiny `N=15` — exactly the same caveat
`quantum/fast_sim.py` already states about its own shortcut, and for the same reason: knowing
`r` in advance is exactly as hard as factoring for real RSA sizes. `quantum/resource_estimate.py`'s
qubit/gate counts (`notes/04`) are what actually addresses scaling to real key sizes; this note
is a physical-reality check at the one scale where a physical check is currently possible at all.
