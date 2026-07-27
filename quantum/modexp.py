"""Controlled modular exponentiation: the arithmetic step of Shor's period-finding circuit.

The operation being realized is:

    U_a |x>|y> = |x>|y * a^x mod N>

for control-register value x and target-register value y < N (the target register starts
at |1> and a is invertible mod N, so its orbit under repeated multiplication by a stays
inside [0, N) — the "junk" states [N, 2^n_target) never get populated).

Implementation note — an explicit, deliberate scope boundary (see notes/03-shors-algorithm-math.md
for the full discussion): a real quantum computer builds this out of a cascade of controlled
modular multipliers, themselves built from reversible adders — dozens of elementary two-qubit
gates per multiplication, O(n^3) gates total for an n-bit N. Simulating that full gate-level
arithmetic circuit is a separate, large engineering project, and building it wouldn't change
what's actually being demonstrated here: the quantum speedup in Shor's algorithm comes from
evaluating a^x mod N *in superposition across every x at once* via this controlled-U
structure, then reading out the period with the inverse QFT. That's exactly what's simulated
below — U_a is implemented as the permutation matrix it mathematically is (computing a^x mod N
classically, once per control value x, and permuting target-register amplitudes accordingly)
rather than re-derived gate by gate. Everything else in the pipeline (superposition creation,
the controlled structure itself, the inverse QFT, measurement, and the classical
continued-fractions post-processing in shor.py) is genuine quantum simulation.

See quantum/modexp_circuit.py for the honest gate-level alternative (reversible adders,
modular multipliers, no shortcuts) that this permutation is cross-validated against, and
notes/04-gate-level-modular-exponentiation.md for the construction.
"""

import math

import numpy as np

from quantum.statevector import QuantumRegister


def apply_modular_exponentiation(
    register: QuantumRegister, n_control: int, n_target: int, a: int, N: int
) -> None:
    """In place. Assumes `register`'s first n_control qubits are the control register and
    the remaining n_target qubits (contiguous) are the target register."""
    if register.n_qubits != n_control + n_target:
        raise ValueError("register size must equal n_control + n_target")
    if math.gcd(a, N) != 1:
        raise ValueError(f"a={a} must be coprime with N={N}")
    dim_target = 2**n_target
    if dim_target < N:
        raise ValueError(f"target register of {n_target} qubits (dim {dim_target}) can't hold N={N}")

    tensor = register.state.reshape(2**n_control, dim_target)

    factors = np.array([pow(a, x, N) for x in range(2**n_control)])
    y = np.arange(dim_target)
    in_range = y < N
    # for y >= N (never actually populated, but kept as a valid permutation target anyway):
    # map to itself, so put_along_axis below stays a well-defined bijection per row.
    new_y = np.where(in_range[None, :], (y[None, :] * factors[:, None]) % N, y[None, :])

    new_tensor = np.zeros_like(tensor)
    np.put_along_axis(new_tensor, new_y, tensor, axis=1)
    register.state = new_tensor.reshape(-1)
