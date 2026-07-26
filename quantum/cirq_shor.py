"""Cross-validation: the same period-finding circuit as quantum/shor.py, built and run with
Google's Cirq instead of our own from-scratch statevector.py — a genuinely independent
implementation to check ours against. This is the resource your mentor linked
(https://quantumai.google/cirq/experiments/shor); the point here isn't to replace our
from-scratch simulator with it, it's to use it as ground truth for a second opinion.

Structural note: `ModularExp` below follows the same pattern as Google's own Shor's-algorithm
tutorial — a `cirq.ArithmeticGate` that computes the classical permutation `target *= a**exponent
(mod N)` directly, rather than a cascade of elementary reversible-arithmetic gates. That's the
exact same scope boundary documented in `quantum/modexp.py` and `notes/03-shors-algorithm-math.md`
— it's not a shortcut specific to our own implementation, it's standard practice for this kind
of demo, including in the framework our mentor pointed us to for reference.

Verified directly against quantum/statevector.py + quantum/modexp.py + quantum/qft.py: building
this same circuit both ways and comparing `final_state_vector`s matches to ~1e-8 (floating point
precision) for every case tried — see tests/test_quantum_cirq_shor.py.
"""

import math
from typing import Optional

import cirq
import numpy as np

from quantum.shor import PeriodFindingResult, default_n_count, extract_period_from_measurement


class ModularExp(cirq.ArithmeticGate):
    """target, exponent -> (target * base**exponent) mod modulus. base/modulus are classical
    constants (not wired to qubits); target/exponent are quantum registers."""

    def __init__(self, target_register, exponent_register, base: int, modulus: int):
        self.target_register = target_register
        self.exponent_register = exponent_register
        self.base = base
        self.modulus = modulus

    def registers(self):
        return self.target_register, self.exponent_register, self.base, self.modulus

    def with_registers(self, *new_registers):
        return ModularExp(new_registers[0], new_registers[1], new_registers[2], new_registers[3])

    def apply(self, target: int, exponent: int, base: int, modulus: int):
        if target >= modulus:
            return target
        return (target * base**exponent) % modulus


def build_circuit(a: int, N: int, n_count: int) -> tuple[cirq.Circuit, list[cirq.LineQubit]]:
    """Same structure as quantum/shor.py's find_period_quantum: control (exponent) register
    in equal superposition, controlled modular exponentiation, inverse QFT on the control
    register. Control qubits are allocated at the lower LineQubit indices so Cirq's default
    qubit ordering matches our own convention (control register first) — confirmed by the
    direct statevector comparison in tests/test_quantum_cirq_shor.py."""
    n_target = N.bit_length()
    exponent_qubits = cirq.LineQubit.range(n_count)
    target_qubits = cirq.LineQubit.range(n_count, n_count + n_target)

    circuit = cirq.Circuit()
    circuit.append(cirq.X(target_qubits[-1]))  # target register := |1>
    circuit.append(cirq.H.on_each(*exponent_qubits))
    circuit.append(
        ModularExp([2] * n_target, [2] * n_count, a, N).on(*target_qubits, *exponent_qubits)
    )
    circuit.append(cirq.qft(*exponent_qubits, inverse=True))
    circuit.append(cirq.measure(*exponent_qubits, key="control"))
    return circuit, exponent_qubits


def find_period_quantum_cirq(
    a: int, N: int, rng: np.random.Generator, n_count: Optional[int] = None
) -> PeriodFindingResult:
    """Same signature/return type as quantum.shor.find_period_quantum, so this can be used
    interchangeably as shors_algorithm's `period_finder` — but runs the circuit through Cirq's
    own simulator rather than quantum/statevector.py."""
    if math.gcd(a, N) != 1:
        raise ValueError("a must be coprime with N")
    n_target = N.bit_length()
    if n_count is None:
        n_count = default_n_count(N)

    circuit, exponent_qubits = build_circuit(a, N, n_count)
    seed = int(rng.integers(0, 2**31 - 1))
    result = cirq.Simulator(seed=seed).run(circuit)
    bits = result.measurements["control"][0]
    measured = cirq.big_endian_bits_to_int(bits)

    period = extract_period_from_measurement(measured, n_count, a, N)

    return PeriodFindingResult(
        N=N,
        a=a,
        n_count=n_count,
        n_target=n_target,
        measured=int(measured),
        measured_probability=float("nan"),  # Cirq's .run() samples directly; we don't get the full distribution
        period=period,
    )
