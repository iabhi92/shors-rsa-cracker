"""How many qubits and gates quantum/modexp_circuit.py's honest, gate-level construction
would actually need to factor a *real* RSA modulus (2048 bits), and how that compares to
published resource estimates for real fault-tolerant hardware.

Two layers, deliberately kept separate and cross-checked against each other:

1. CountingRegister: satisfies quantum.statevector.GateSink's structural interface, but
   counts gate calls instead of simulating amplitudes — no 2^n_qubits array is ever
   allocated. Since every loop bound and branch in quantum/adder.py, quantum/qft.py, and
   quantum/modexp_circuit.py depends only on classical parameters (N, a, n_count, n_target —
   never on register.state), pointing the project's real, *unmodified* circuit-emission code
   at this backend gives exact gate counts for small N without a separate, independently-
   trustable formula. This is only usable for N small enough that the O(n_count * n_target^3)
   number of Python-level loop iterations stays fast — which rules out real RSA sizes (a
   2048-bit modulus would need on the order of 10^13 loop iterations; measured directly for a
   16-bit modulus in tests/test_resource_estimate.py, which takes well under a second).

2. closed_form_gate_counts: an exact polynomial formula in (n_count, n_target), derived by
   hand from that same code's structure (see the derivation comment above the function). It's
   not trusted on the derivation alone: tests/test_resource_estimate.py checks it reproduces
   CountingRegister's *actual measured* counts exactly (not approximately) across several
   small (n_count, n_target) pairs before it's used to extrapolate to sizes CountingRegister
   itself can't reach, like a 2048-bit RSA modulus.

The comparison to published literature (see estimate_for_rsa_bits's docstring) is deliberately
apples-to-oranges and says so explicitly: this project's construction is an unoptimized
textbook circuit with no error-correction modeling, compared against a highly-optimized,
fault-tolerant estimate. The honest takeaway is qualitative — both are O(n) qubits and
O(poly(n)) gates, confirming Shor's algorithm's polynomial scaling from a second, independent
angle — not a claim that this project's numbers are competitive with real hardware estimates.
"""

import math
from dataclasses import dataclass, field

from quantum.modexp_circuit import ancilla_qubit_count, apply_modular_exponentiation_circuit
from quantum.shor import default_n_count


class CountingRegister:
    """Duck-typed GateSink backend: same apply_gate / apply_controlled_gate /
    apply_multi_controlled_gate / apply_swap / apply_controlled_swap methods a real
    QuantumRegister exposes, except these just increment counters. See module docstring."""

    def __init__(self, n_qubits: int):
        self.n_qubits = n_qubits
        self.single_qubit_gates = 0
        self.controlled_gates = 0
        # keyed by number of control qubits: a real controlled-swap or k-controlled gate
        # needs a different (and, for k>1, ancilla-dependent) hardware decomposition
        self.multi_controlled_gates: dict[int, int] = {}
        self.swaps = 0
        self.controlled_swaps = 0

    def apply_gate(self, gate: object, qubit: int) -> None:
        self.single_qubit_gates += 1

    def apply_controlled_gate(self, gate: object, control: int, target: int) -> None:
        self.controlled_gates += 1

    def apply_multi_controlled_gate(self, gate: object, controls: list[int], target: int) -> None:
        k = len(controls)
        self.multi_controlled_gates[k] = self.multi_controlled_gates.get(k, 0) + 1

    def apply_swap(self, qubit_a: int, qubit_b: int) -> None:
        self.swaps += 1

    def apply_controlled_swap(self, control: int, qubit_a: int, qubit_b: int) -> None:
        self.controlled_swaps += 1


def _synthetic_modulus(n_bits: int) -> int:
    """An odd integer with exactly `n_bits` bits, used only to drive the gate-counting walk
    through apply_modular_exponentiation_circuit's real control flow. Gate *counts* in that
    function depend only on n_count and n_target = N.bit_length() (every classical value
    computed from N, like a^(2^k) mod N or mod_inverse(a, N), only ever becomes a *parameter*
    to a fixed-shape gate call — never changes how many gates are called), so this doesn't
    need to be, and deliberately isn't, a real semiprime."""
    return (1 << (n_bits - 1)) | 1


def count_gates_for_modular_exponentiation(n_bits: int, n_count: int | None = None) -> CountingRegister:
    """Run the real apply_modular_exponentiation_circuit (unmodified) against a
    CountingRegister for a modulus of `n_bits` bits, and return the resulting gate-call
    counts. Only practical for small n_bits — see module docstring."""
    N = _synthetic_modulus(n_bits)
    a = 2  # coprime with any odd N
    if n_count is None:
        n_count = default_n_count(N)
    n_target = N.bit_length()
    n_ancilla = ancilla_qubit_count(n_target)

    reg = CountingRegister(n_count + n_target + n_ancilla)
    apply_modular_exponentiation_circuit(reg, n_count, n_target, a, N)
    return reg


@dataclass
class GateCounts:
    single_qubit_gates: int
    controlled_gates: int
    multi_controlled_gates: dict[int, int] = field(default_factory=dict)
    swaps: int = 0
    controlled_swaps: int = 0

    def total_gate_emissions(self) -> int:
        """Total count of gate calls of every kind — this project's own circuit's logical
        gate count. Not a hardware-native gate count: a k-controlled single-qubit gate for
        k>=2 (and a controlled-swap) would still need decomposing into multiple elementary
        two-qubit gates on real hardware — see toffoli_equivalent_count."""
        return (
            self.single_qubit_gates
            + self.controlled_gates
            + sum(self.multi_controlled_gates.values())
            + self.swaps
            + self.controlled_swaps
        )

    def toffoli_equivalent_count(self) -> int:
        """A rough hardware-native proxy: count every 2-controlled gate or controlled-swap
        as "one Toffoli-class operation" (the standard unit real resource estimates, like
        Gidney & Ekera's, are quoted in), treating every controlled (1-control) or
        single-qubit gate as free relative to that (both are cheap Clifford/near-Clifford
        operations on real fault-tolerant hardware, where Toffolis/T-gates dominate cost).
        This project never emits controls of length > 2 (see quantum/modexp_circuit.py's
        module docstring's construction), so this is a complete accounting, not an
        approximation of some larger family of gate types."""
        if any(k > 2 for k in self.multi_controlled_gates):
            raise AssertionError("unexpected >2-controlled gate; accounting above is incomplete")
        return self.multi_controlled_gates.get(2, 0) + self.controlled_swaps

    @classmethod
    def from_counting_register(cls, reg: CountingRegister) -> "GateCounts":
        return cls(
            single_qubit_gates=reg.single_qubit_gates,
            controlled_gates=reg.controlled_gates,
            multi_controlled_gates=dict(reg.multi_controlled_gates),
            swaps=reg.swaps,
            controlled_swaps=reg.controlled_swaps,
        )


def closed_form_gate_counts(n_count: int, n_target: int) -> GateCounts:
    """Exact polynomial gate-call counts for apply_modular_exponentiation_circuit(n_count,
    n_target, ...), derived by hand from that function's structure rather than measured by
    running it — the only way to reach a modulus size (2048 bits) where actually running the
    circuit-emission code, even just to count calls, is computationally infeasible (see
    module docstring). Cross-checked exactly against CountingRegister's real measured counts
    for several small (n_count, n_target) pairs in tests/test_resource_estimate.py.

    Derivation, bottom-up:

    - apply_qft/apply_inverse_qft on an m-qubit register: m single-qubit gates (Hadamards),
      m(m-1)/2 single-controlled gates (the rotation cascade), floor(m/2) swaps. Read
      directly off quantum/qft.py's nested loop structure.
    - apply_modular_add_constant on a b register of n_b = n_target+1 qubits, with a control
      list of length `ctrl_len`: 3 QFT + 3 inverse-QFT brackets on the b register (the
      add-a/sub-N bracket, the add-N/sub-a bracket, and the final add-a restore bracket —
      quantum/modexp_circuit.py's five labelled steps), contributing 6 * QFT(n_b)'s counts;
      plus 3 calls to apply_fourier_add_constant gated by `ctrl_len` controls (the three ±a
      sub-steps) = 3*n_b gates at that control-length; plus 1 unconditional SUB(N) = n_b
      single-qubit gates; plus 1 ADD(N) gated by the flag qubit alone = n_b 1-controlled
      gates; plus 2 X gates and 2 CNOTs (the sign-flip trick). apply_modular_subtract_constant
      is the mechanically-derived adjoint of the same gates, so it has identical counts.
    - apply_cmult_mod: n_target calls to the above with ctrl_len=2 (doubly-controlled by the
      outer control qubit and one bit of x).
    - apply_controlled_multiply_mod_N: apply_cmult_mod forward + n_target controlled-swaps +
      apply_cmult_mod inverse = 2*n_target modular-add-constant(ctrl_len=2) calls + n_target
      controlled-swaps.
    - apply_modular_exponentiation_circuit: n_count calls to the above.
    """
    n_b = n_target + 1
    qft_h, qft_ctrl, qft_swap = n_b, n_b * (n_b - 1) // 2, n_b // 2

    # one apply_modular_add_constant (or subtract) call with a control list of length 2
    addmod_single_qubit = 6 * qft_h + n_b + 2  # 6 QFT-bracket Hadamards + SUB(N) + 2 X gates
    addmod_controlled = 6 * qft_ctrl + 2  # 6 QFT-bracket rotations + 2 CNOTs (1-controlled)
    addmod_multi_1 = n_b  # ADD(N) gated by the flag qubit alone
    addmod_multi_2 = 3 * n_b  # the three +-a sub-steps, each doubly-controlled
    addmod_swap = 6 * qft_swap

    addmods_per_cmultmodn = 2 * n_target  # forward cmult_mod + its inverse
    per_cmultmodn = GateCounts(
        single_qubit_gates=addmods_per_cmultmodn * addmod_single_qubit,
        controlled_gates=addmods_per_cmultmodn * addmod_controlled,
        multi_controlled_gates={
            1: addmods_per_cmultmodn * addmod_multi_1,
            2: addmods_per_cmultmodn * addmod_multi_2,
        },
        swaps=addmods_per_cmultmodn * addmod_swap,
        controlled_swaps=n_target,
    )

    return GateCounts(
        single_qubit_gates=n_count * per_cmultmodn.single_qubit_gates,
        controlled_gates=n_count * per_cmultmodn.controlled_gates,
        multi_controlled_gates={k: n_count * v for k, v in per_cmultmodn.multi_controlled_gates.items()},
        swaps=n_count * per_cmultmodn.swaps,
        controlled_swaps=n_count * per_cmultmodn.controlled_swaps,
    )


@dataclass
class ResourceEstimate:
    n_bits: int
    n_count: int
    n_target: int
    n_ancilla: int
    total_qubits: int
    gate_counts: GateCounts

    @property
    def toffoli_equivalent_gates(self) -> int:
        return self.gate_counts.toffoli_equivalent_count()

    @property
    def total_gate_emissions(self) -> int:
        return self.gate_counts.total_gate_emissions()


def estimate_for_rsa_bits(n_bits: int, n_count: int | None = None) -> ResourceEstimate:
    """Qubit and gate counts for factoring an n_bits-bit RSA modulus with this project's
    honest gate-level circuit (find_period_quantum_gate_level), computed via
    closed_form_gate_counts so this works at real RSA sizes (2048 bits) in O(1) time.

    For context, Gidney & Ekera (arXiv:1905.09749, "How to factor 2048 bit RSA integers in 8
    hours using 20 million noisy qubits", 2019) publish, for an n-bit modulus: logical qubits
    = 3n + 0.002*n*log2(n), Toffoli gates = 0.3*n^3 + 0.0005*n^3*log2(n) — for a
    highly-optimized (windowed arithmetic, approximate adders), fault-tolerant circuit, with
    the 20-million figure being *physical* qubits after surface-code error-correction
    overhead on top of those logical qubits (a 2025 follow-up, arXiv:2505.15917, brings the
    physical-qubit estimate below one million using further optimizations). This project's
    construction has none of that optimization or error-correction modeling — it's a textbook
    circuit built to be verified against ground truth at every layer, not to minimize resource
    counts — so a direct numeric comparison is apples-to-oranges. What *is* a fair, meaningful
    comparison: both this project's qubit count and Gidney & Ekera's are O(n) in the modulus
    size, and both gate/Toffoli counts are O(n^3)-ish — the same polynomial scaling, arrived
    at independently, is exactly the mathematically real claim this whole project is
    demonstrating (see notes/03-shors-algorithm-math.md's closing section).
    """
    N = _synthetic_modulus(n_bits)
    if n_count is None:
        n_count = default_n_count(N)
    n_target = N.bit_length()
    n_ancilla = ancilla_qubit_count(n_target)

    return ResourceEstimate(
        n_bits=n_bits,
        n_count=n_count,
        n_target=n_target,
        n_ancilla=n_ancilla,
        total_qubits=n_count + n_target + n_ancilla,
        gate_counts=closed_form_gate_counts(n_count, n_target),
    )


def gidney_ekera_2019_estimate(n_bits: int) -> dict[str, float]:
    """Published formulas from Gidney & Ekera 2019 (arXiv:1905.09749) for comparison — see
    estimate_for_rsa_bits's docstring for the caveats on comparing these directly to this
    project's numbers."""
    logical_qubits = 3 * n_bits + 0.002 * n_bits * math.log2(n_bits)
    toffoli_gates = 0.3 * n_bits**3 + 0.0005 * n_bits**3 * math.log2(n_bits)
    return {"logical_qubits": logical_qubits, "toffoli_gates": toffoli_gates}
