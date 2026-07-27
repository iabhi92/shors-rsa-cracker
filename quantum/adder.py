"""Draper's Fourier-basis constant adder: the elementary arithmetic primitive underneath
quantum/modexp_circuit.py's gate-level (honest, non-permutation-shortcut) controlled modular
exponentiation circuit.

Derivation (Draper, "Addition on a Quantum Computer", quant-ph/0008033), rederived here
directly from *this project's own* QFT convention (see quantum/qft.py's docstring) rather
than copied from a paper's differing qubit-ordering convention, specifically so it can be
verified against ground truth instead of trusted on faith:

QFT|x> = (1/sqrt(2^n)) * sum_y exp(2*pi*i*x*y/2^n) |y>. An operator ADD(a) satisfying
ADD(a) QFT|x> = QFT|x+a mod 2^n> must therefore act on the Fourier-basis state QFT|x> by
multiplying its |y>-amplitude by exp(2*pi*i*a*y/2^n) — a phase depending only on y, i.e.
ADD(a) is diagonal in the Fourier basis. Writing y in binary MSB-first (this project's
qubit-index convention throughout: qubits[0] is most significant), y = sum_k y_k * 2^{n-1-k},
that phase factors into a product of independent single-qubit phases:

    exp(2*pi*i*a*y/2^n) = prod_k exp(2*pi*i*a*y_k / 2^{k+1})

so ADD(a) is exactly `n` single-qubit phase gates — phase(2*pi*a/2^{k+1}) on qubits[k],
k=0..n-1 — with no qubit-qubit interaction at all. That's what makes it "free" to make
controlled (see apply_fourier_add_constant's `controls` argument): each single-qubit phase
gate just becomes a multi-controlled phase gate.

Not trusted on the derivation alone: tests/test_quantum_adder.py checks
QFT -> apply_fourier_add_constant -> inverse-QFT reproduces (x+a) mod 2^n exactly, for
every x and many random a, across several register sizes — ground truth is plain classical
integer addition, not a hand-derived formula.
"""

import math

from quantum.statevector import GateSink, phase


def apply_fourier_add_constant(
    register: GateSink,
    qubits: list[int],
    a: int,
    controls: list[int] | None = None,
) -> None:
    """Add classical constant `a` (mod 2^len(qubits)) to `qubits`, which must already be in
    the QFT basis (apply_qft(register, qubits) beforehand; see module docstring). In place.
    If `controls` is given (0, 1, or more control qubits), the whole addition only happens
    on the subspace where every control qubit is |1>."""
    controls = controls or []
    for k, q in enumerate(qubits):
        theta = 2 * math.pi * a / 2 ** (k + 1)
        gate = phase(theta)
        if controls:
            register.apply_multi_controlled_gate(gate, controls, q)
        else:
            register.apply_gate(gate, q)


def apply_fourier_subtract_constant(
    register: GateSink,
    qubits: list[int],
    a: int,
    controls: list[int] | None = None,
) -> None:
    """Subtract classical constant `a` (mod 2^len(qubits)): the exact same single-qubit
    phase gates as apply_fourier_add_constant with negated angles, hence its own adjoint's
    forward form (ADD(a) and ADD(-a) are mutual inverses by construction)."""
    apply_fourier_add_constant(register, qubits, -a, controls)
