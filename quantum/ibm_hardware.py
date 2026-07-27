"""Running Shor's period-finding on a real IBM quantum computer, not just simulating it.

quantum/shor.py's find_period_quantum (and its gate-level sibling,
find_period_quantum_gate_level, quantum/cirq_shor.py's Cirq cross-check) are all
noiseless simulations. None of them can answer the one question a simulator fundamentally
can't: does an actual, physically noisy quantum computer reproduce the theoretical
measurement distribution this project's simulator predicts? This module answers that by
submitting a real circuit to IBM Quantum hardware via qiskit-ibm-runtime and comparing the
real counts against the prediction.

Why the circuit can be small enough to survive real NISQ noise: quantum/modexp_circuit.py's
general gate-level circuit needs a target register of N.bit_length() qubits plus
ancilla_qubit_count(N.bit_length()) scratch qubits, and dozens of Fourier-adder gates per
exponentiation step -- far too deep for current hardware coherence times, which is exactly
why that circuit is only ever run on the honest simulator. This module instead exploits a
fact knowable classically in advance for a specific (a, N) pair (the same kind of classical
shortcut quantum/fast_sim.py already documents and uses): if a's multiplicative order r mod N
is a power of two, the r reachable target-register values {a^0, a^1, ..., a^(r-1)} mod N never
need to be represented by their actual N.bit_length()-bit values at all. Only *which one of
the r values* the target holds ever matters for period-finding -- the reduced state Shor's
construction depends on, after tracing out the target register, is invariant under any
relabeling of the target's basis states, since that's just a unitary change of basis applied
entirely within the traced-out subsystem. So re-encoding the target register as a compact
log2(r)-qubit "cycle position" counter, and implementing controlled-U_a as controlled modular
addition mod r (not mod N) on that tiny register, is an *exact* re-encoding, not an
approximation.

For N=15, every valid `a` automatically has order r in {1, 2, 4, 8}: the group (Z/15Z)* itself
has order phi(15) = 8 = 2^3, so by Lagrange's theorem every element's order divides 8 and is
therefore automatically a power of two. That's why N=15 is used here, same as everywhere else
in this project.

Note on QFT convention: this module does NOT use Qiskit's built-in QFTGate. That gate uses
the opposite qubit-order convention from quantum/qft.py's apply_qft (confirmed by direct
comparison while developing this module -- using it produced a measurably wrong distribution
until this was caught against the project's own ground-truth simulator). Instead,
_apply_qft_project_convention below is a direct, gate-by-gate translation of quantum/qft.py's
own H + controlled-phase + swap sequence, guaranteeing consistency with the rest of this
project rather than trusting Qiskit's differing convention to happen to line up.

Every case this module can build is cross-validated exactly (not approximately) against
quantum/modexp.py's already-verified permutation simulator in
tests/test_ibm_hardware.py -- before ever spending real hardware time on it.
"""

import math
import os
from dataclasses import dataclass
from typing import TYPE_CHECKING

from qiskit import QuantumCircuit
from qiskit.transpiler import PassManager

from quantum.fast_sim import multiplicative_order

if TYPE_CHECKING:
    from qiskit_ibm_runtime import QiskitRuntimeService


def _is_power_of_two(n: int) -> bool:
    return n > 0 and (n & (n - 1)) == 0


def compiled_target_qubit_count(a: int, N: int) -> int:
    """log2(r) qubits, where r = ord_N(a). Raises if r isn't a power of two (see module
    docstring) -- this compiled circuit only supports that case."""
    r = multiplicative_order(a, N)
    if r <= 1 or not _is_power_of_two(r):
        raise ValueError(
            f"this compiled circuit only supports a whose multiplicative order r is a "
            f"power of two greater than 1 (got r={r} for a={a}, N={N})"
        )
    return r.bit_length() - 1


def _apply_qft_project_convention(qc: QuantumCircuit, qubits: list[int], inverse: bool = False) -> None:
    """Direct gate-by-gate translation of quantum/qft.py's apply_qft/apply_inverse_qft:
    qubits[0] is MSB. See module docstring for why this isn't Qiskit's built-in QFTGate."""
    n = len(qubits)
    if not inverse:
        for i in range(n):
            target = qubits[i]
            qc.h(target)
            for j in range(i + 1, n):
                control = qubits[j]
                k = j - i + 1
                qc.cp(2 * math.pi / 2**k, control, target)
        for i in range(n // 2):
            qc.swap(qubits[i], qubits[n - 1 - i])
    else:
        for i in range(n // 2):
            qc.swap(qubits[i], qubits[n - 1 - i])
        for i in reversed(range(n)):
            target = qubits[i]
            for j in reversed(range(i + 1, n)):
                control = qubits[j]
                k = j - i + 1
                qc.cp(-2 * math.pi / 2**k, control, target)
            qc.h(target)


def build_compiled_circuit(a: int, N: int, n_count: int) -> QuantumCircuit:
    """The compiled period-finding circuit described in the module docstring: n_count
    counting qubits (measured, in this project's MSB-first convention -- see the measure()
    call's clbit mapping below) plus compiled_target_qubit_count(a, N) target qubits encoding
    cycle position rather than the actual mod-N value.
    """
    if math.gcd(a, N) != 1:
        raise ValueError(f"a={a} must be coprime with N={N}")
    r = multiplicative_order(a, N)
    n_target = compiled_target_qubit_count(a, N)

    counting = list(range(n_count))
    target = list(range(n_count, n_count + n_target))
    qc = QuantumCircuit(n_count + n_target, n_count, name=f"shor_compiled_a{a}_N{N}")

    qc.h(counting)
    _apply_qft_project_convention(qc, target)

    for i, c in enumerate(counting):
        weight = n_count - 1 - i  # matches quantum/shor.py's control-qubit weighting
        addend = pow(2, weight, r)  # U_{a^(2^weight)} <-> "add 2^weight mod r" to cycle position
        if addend == 0:
            continue
        for k in range(n_target):
            theta = 2 * math.pi * addend / 2 ** (k + 1)
            if abs((theta / math.pi) % 2) < 1e-9:
                continue  # a 2*pi*integer phase is the identity; skip a no-op gate
            qc.cp(theta, c, target[k])

    _apply_qft_project_convention(qc, counting, inverse=True)
    # Qiskit's bitstring convention places clbit 0 at the rightmost character; mapping
    # counting[i] -> clbit (n_count-1-i) means int(bitstring, 2) directly yields this
    # project's MSB-first integer convention with no manual reversal needed (verified
    # empirically against a known basis state while developing this module).
    qc.measure(counting, [n_count - 1 - i for i in range(n_count)])
    return qc


@dataclass
class HardwareRunResult:
    backend_name: str
    job_id: str
    shots: int
    counts: dict[int, int]  # measured integer (this project's convention) -> count


def get_service() -> "QiskitRuntimeService":
    """Load qiskit-ibm-runtime credentials from the environment (IBM_QUANTUM_API_KEY,
    IBM_QUANTUM_CRN) -- see .env.example. Never hardcode credentials; .env is git-ignored."""
    from dotenv import load_dotenv
    from qiskit_ibm_runtime import QiskitRuntimeService

    load_dotenv()
    api_key = os.environ.get("IBM_QUANTUM_API_KEY")
    crn = os.environ.get("IBM_QUANTUM_CRN")
    if not api_key or not crn:
        raise RuntimeError(
            "IBM_QUANTUM_API_KEY and IBM_QUANTUM_CRN must be set (see .env.example) "
            "before running anything against real hardware"
        )
    return QiskitRuntimeService(channel="ibm_cloud", token=api_key, instance=crn)


def run_on_hardware(
    a: int, N: int, n_count: int, shots: int = 4000, backend_name: str | None = None
) -> HardwareRunResult:
    """Transpile build_compiled_circuit(a, N, n_count) for a real backend and submit it via
    qiskit-ibm-runtime's SamplerV2 primitive. Picks the least-busy operational backend if
    `backend_name` isn't given."""
    from qiskit_ibm_runtime import SamplerV2

    service = get_service()
    backend = service.backend(backend_name) if backend_name else service.least_busy(operational=True)

    from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager

    qc = build_compiled_circuit(a, N, n_count)
    pm: PassManager = generate_preset_pass_manager(optimization_level=3, backend=backend)
    transpiled = pm.run(qc)

    sampler = SamplerV2(mode=backend)
    job = sampler.run([transpiled], shots=shots)
    result = job.result()
    raw_counts = result[0].data.c.get_counts()
    counts = {int(bitstring, 2): n for bitstring, n in raw_counts.items()}

    return HardwareRunResult(backend_name=backend.name, job_id=job.job_id(), shots=shots, counts=counts)
