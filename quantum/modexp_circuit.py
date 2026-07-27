"""The honest, gate-by-gate alternative to quantum/modexp.py's permutation shortcut.

quantum/modexp.py documents an explicit scope boundary: rather than building the cascade of
reversible adders that a real quantum computer needs to realize controlled modular
exponentiation, it computes the same unitary directly as the permutation it mathematically
is. This module removes that shortcut: controlled modular exponentiation built from nothing
but single- and multi-controlled single-qubit gates, following the standard construction for
Shor's algorithm using O(n) ancilla qubits (Vedral-Barenco-Ekert reversible arithmetic,
redone in the Fourier basis per Draper/Beauregard so the adder needs no carry ancilla — see
quantum/adder.py):

  1. apply_modular_add_constant: |b> -> |(b + a) mod N>, for a classical constant a and a
     quantum register b holding a value < N. Needs one extra "overflow" qubit in the b
     register (sized N.bit_length() + 1, not just N.bit_length()) and one ancilla qubit used
     as scratch and always restored to |0> by the end (the crux of the construction: add a,
     unconditionally subtract N, inspect the sign to decide whether to add N back, then run
     the whole sign-inspection again in reverse to erase the record of which case happened —
     otherwise the ancilla would carry which-way-did-it-go information and destroy the
     interference the rest of Shor's algorithm depends on).
  2. apply_cmult_mod / apply_controlled_multiply_mod_N: chains n_target modular additions
     (one per bit of x, doubly-controlled by an outer control qubit AND that bit of x) to
     compute b = a*x mod N, then uses a controlled-swap plus the *exact adjoint* of the same
     construction run with a^-1 to transplant that result back onto the x register itself —
     the standard trick (Beauregard 2002) for reusing one register as both scratch and output
     without needing a second full-size register per multiplication.
  3. apply_modular_exponentiation_circuit: chains n_count controlled multiplications — one
     per control (exponent) qubit, by the classical constant a^(2^k) mod N — exactly
     realizing target *= a^x mod N for control-register value x, across the full
     superposition at once. This is the same operation quantum/modexp.py's
     apply_modular_exponentiation performs; the two are cross-validated statevector-exact in
     tests/test_quantum_modexp_circuit.py.

Qubit layout of the full register this module expects (all contiguous, in this order):
  control (n_count qubits) | x/target (n_target qubits) | b ancilla (n_target+1 qubits) |
  flag ancilla (1 qubit)
The b and flag qubits are pure scratch: guaranteed |0> both before and after every call here
(that's what makes this honestly reversible rather than a measurement-and-classical-control
trick), so callers can reuse the same ancilla across repeated calls.
"""

import math

from quantum.adder import apply_fourier_add_constant
from quantum.qft import apply_inverse_qft, apply_qft
from quantum.statevector import GateSink, X
from rsa.keygen import mod_inverse


def ancilla_qubit_count(n_target: int) -> int:
    """How many scratch qubits (b register + flag) a target register of `n_target` qubits
    needs for the constructions in this module."""
    return (n_target + 1) + 1


def apply_modular_add_constant(
    register: GateSink,
    b_qubits: list[int],
    flag_qubit: int,
    a: int,
    N: int,
    controls: list[int] | None = None,
) -> None:
    """In place: b_qubits (length N.bit_length() + 1, computational basis, holding a value
    0 <= b < N) becomes (b + a) mod N. flag_qubit must be |0> on entry and is restored to
    |0> on exit. If `controls` is given, the whole operation is a no-op (identity) unless
    every control qubit is |1> — flag_qubit is still touched transiently but always ends
    back at |0> regardless, since the unconditional N-subtraction/restoration machinery
    below must run either way for that to hold (see module docstring)."""
    controls = controls or []
    a %= N
    top = b_qubits[0]

    apply_qft(register, b_qubits)
    apply_fourier_add_constant(register, b_qubits, a, controls)
    apply_fourier_add_constant(register, b_qubits, -N, [])
    apply_inverse_qft(register, b_qubits)

    register.apply_controlled_gate(X, top, flag_qubit)

    apply_qft(register, b_qubits)
    apply_fourier_add_constant(register, b_qubits, N, [flag_qubit])
    apply_fourier_add_constant(register, b_qubits, -a, controls)
    apply_inverse_qft(register, b_qubits)

    register.apply_gate(X, top)
    register.apply_controlled_gate(X, top, flag_qubit)
    register.apply_gate(X, top)

    apply_qft(register, b_qubits)
    apply_fourier_add_constant(register, b_qubits, a, controls)
    apply_inverse_qft(register, b_qubits)


def apply_modular_subtract_constant(
    register: GateSink,
    b_qubits: list[int],
    flag_qubit: int,
    a: int,
    N: int,
    controls: list[int] | None = None,
) -> None:
    """The exact adjoint of apply_modular_add_constant: same gates, reverse order, each
    individually adjointed (phase(theta) -> phase(-theta), QFT <-> inverse-QFT, X and CNOT
    self-adjoint). Mechanically derived, not just "call add with N-a", so it stays correct
    on the full Hilbert space rather than only the physically-populated subspace."""
    controls = controls or []
    a %= N
    top = b_qubits[0]

    apply_qft(register, b_qubits)
    apply_fourier_add_constant(register, b_qubits, -a, controls)
    apply_inverse_qft(register, b_qubits)

    register.apply_gate(X, top)
    register.apply_controlled_gate(X, top, flag_qubit)
    register.apply_gate(X, top)

    apply_qft(register, b_qubits)
    apply_fourier_add_constant(register, b_qubits, a, controls)
    apply_fourier_add_constant(register, b_qubits, -N, [flag_qubit])
    apply_inverse_qft(register, b_qubits)

    register.apply_controlled_gate(X, top, flag_qubit)

    apply_qft(register, b_qubits)
    apply_fourier_add_constant(register, b_qubits, N, [])
    apply_fourier_add_constant(register, b_qubits, -a, controls)
    apply_inverse_qft(register, b_qubits)


def apply_cmult_mod(
    register: GateSink,
    control: int,
    x_qubits: list[int],
    b_qubits: list[int],
    flag_qubit: int,
    a: int,
    N: int,
    inverse: bool = False,
) -> None:
    """b_qubits (starting at |0>) accumulates (a * x) mod N, controlled by `control`, by
    chaining one modular addition per bit of x — doubly-controlled on `control` AND that bit
    (so a bit only contributes its place-value power of two times a, mod N, and only when
    the outer control is set). x_qubits is read via control only, never modified.

    `inverse=True` runs the exact adjoint (apply_modular_subtract_constant, in reverse bit
    order) — used by apply_controlled_multiply_mod_N to uncompute this register."""
    n = len(x_qubits)
    a %= N
    bit_range = reversed(range(n)) if inverse else range(n)
    op = apply_modular_subtract_constant if inverse else apply_modular_add_constant
    for i in bit_range:
        weight = n - 1 - i
        addend = (a * pow(2, weight, N)) % N
        op(register, b_qubits, flag_qubit, addend, N, controls=[control, x_qubits[i]])


def apply_controlled_multiply_mod_N(
    register: GateSink,
    control: int,
    x_qubits: list[int],
    b_qubits: list[int],
    flag_qubit: int,
    a: int,
    N: int,
) -> None:
    """Controlled |x> -> |a*x mod N> (identity when control=|0>). x_qubits holds the value
    being multiplied both before and after; b_qubits (length N.bit_length()+1) and
    flag_qubit are scratch, required |0> on entry and guaranteed |0> on exit.

    Construction (Beauregard 2002): compute b = a*x mod N into the scratch register via
    apply_cmult_mod, controlled-swap that result onto x_qubits itself, then uncompute the
    (now b-holds-old-x) scratch register back to |0> using the exact adjoint of the same
    construction run with a^-1 mod N — see module docstring for why this nets out to
    x_qubits ending at a*x mod N with everything else clean.
    """
    if len(b_qubits) != len(x_qubits) + 1:
        raise ValueError(f"b_qubits must have len(x_qubits)+1={len(x_qubits) + 1} qubits, got {len(b_qubits)}")
    all_qubits = [control, *x_qubits, *b_qubits, flag_qubit]
    if len(set(all_qubits)) != len(all_qubits):
        raise ValueError("control, x_qubits, b_qubits, and flag_qubit must all be pairwise distinct")

    a %= N
    a_inv = mod_inverse(a, N)

    apply_cmult_mod(register, control, x_qubits, b_qubits, flag_qubit, a, N)
    for xq, bq in zip(x_qubits, b_qubits[1:], strict=True):
        register.apply_controlled_swap(control, xq, bq)
    apply_cmult_mod(register, control, x_qubits, b_qubits, flag_qubit, a_inv, N, inverse=True)


def apply_modular_exponentiation_circuit(
    register: GateSink,
    n_count: int,
    n_target: int,
    a: int,
    N: int,
) -> None:
    """Gate-level equivalent of quantum/modexp.py's apply_modular_exponentiation: realizes
    target *= a^x mod N for control-register value x, across the full superposition.
    `register` must have exactly n_count + n_target + ancilla_qubit_count(n_target) qubits,
    laid out as [control | x/target | b ancilla | flag ancilla] (see module docstring). The
    ancilla qubits must be |0> on entry and are guaranteed |0> on exit — the state on exit,
    restricted to the control+target qubits, is bit-for-bit (statevector-exact) what
    apply_modular_exponentiation produces on a register of just those n_count + n_target
    qubits (tests/test_quantum_modexp_circuit.py checks this directly).
    """
    if math.gcd(a, N) != 1:
        raise ValueError(f"a={a} must be coprime with N={N}")
    n_target_bits = N.bit_length()
    if n_target != n_target_bits:
        raise ValueError(f"n_target must equal N.bit_length()={n_target_bits}")
    expected_qubits = n_count + n_target + ancilla_qubit_count(n_target)
    if register.n_qubits != expected_qubits:
        raise ValueError(
            f"register must have {expected_qubits} qubits "
            f"(n_count={n_count} + n_target={n_target} + ancilla={ancilla_qubit_count(n_target)})"
        )

    control_qubits = list(range(n_count))
    x_qubits = list(range(n_count, n_count + n_target))
    b_qubits = list(range(n_count + n_target, n_count + n_target + n_target + 1))
    flag_qubit = register.n_qubits - 1

    for i, control in enumerate(control_qubits):
        weight = n_count - 1 - i
        a_pow = pow(a, 1 << weight, N)
        apply_controlled_multiply_mod_N(register, control, x_qubits, b_qubits, flag_qubit, a_pow, N)
