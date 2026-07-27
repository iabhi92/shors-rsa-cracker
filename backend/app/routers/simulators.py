"""Static comparison table -- every field here is a documented fact about this project's own
code, each citing the module/test that backs it (not a live computation, but not invented
either; see each row's `verified_by`)."""

from fastapi import APIRouter

from backend.app.schemas.simulators import SimulatorCompareResponse, SimulatorInfo

router = APIRouter()

_SIMULATORS = [
    SimulatorInfo(
        name="Honest statevector simulator",
        module="quantum/shor.py (find_period_quantum) + quantum/modexp.py",
        simulates_amplitudes=True,
        models_gates_directly=False,
        uses_classically_known_period=False,
        practical_limit="~24 qubits (N up to ~65) before O(2^qubits) memory becomes impractical",
        intended_purpose="The reference implementation: real superposition, real controlled-U, real inverse QFT; modular exponentiation computed as the permutation it mathematically is.",
        known_limitations="Modular exponentiation is a documented permutation shortcut, not built from elementary gates.",
        verified_by="tests/test_quantum_shor.py; QFT verified against the exact DFT matrix in tests/test_quantum_statevector.py",
    ),
    SimulatorInfo(
        name="Gate-level circuit (zero shortcuts)",
        module="quantum/modexp_circuit.py + quantum/adder.py (find_period_quantum_gate_level)",
        simulates_amplitudes=True,
        models_gates_directly=True,
        uses_classically_known_period=False,
        practical_limit="Smaller N than the honest simulator (extra n_target+2 ancilla qubits per notes/04)",
        intended_purpose="Modular exponentiation built entirely from elementary single- and multi-controlled single-qubit gates -- reversible Fourier adders, modular multiplication, exponentiation.",
        known_limitations="More ancilla qubits than the permutation shortcut for the same N -- the real, measured cost of not shortcutting the arithmetic.",
        verified_by="tests/test_quantum_modexp_circuit.py: statevector-exact match against the honest simulator, zero ancilla leakage",
    ),
    SimulatorInfo(
        name="Fast/sampling simulator",
        module="quantum/fast_sim.py (find_period_quantum_fast)",
        simulates_amplitudes=False,
        models_gates_directly=False,
        uses_classically_known_period=True,
        practical_limit="N=101*103=10403 factored in under a second",
        intended_purpose="Samples directly from the theoretical measurement distribution for N far beyond the honest simulator's qubit budget -- a demo convenience, not a scalability result.",
        known_limitations="Requires classically computing the multiplicative order first, which is exactly as hard as factoring for real RSA-sized N.",
        verified_by="tests/test_quantum_fast_sim.py: statistical cross-validation against the honest simulator",
    ),
    SimulatorInfo(
        name="Cirq cross-check",
        module="quantum/cirq_shor.py (find_period_quantum_cirq)",
        simulates_amplitudes=True,
        models_gates_directly=False,
        uses_classically_known_period=False,
        practical_limit="Small N only -- Cirq's general-purpose simulator costs ~10s/shot at 18 qubits vs. ~0.1s for this project's own simulator",
        intended_purpose="An independent, second implementation of the same circuit (superposition, controlled modular exponentiation, inverse QFT) using Google's Cirq, as a correctness cross-check.",
        known_limitations="Same permutation-based modular exponentiation shortcut as the honest simulator (standard practice, per Cirq's own tutorial).",
        verified_by="tests/test_quantum_cirq_shor.py: full statevectors match to floating-point precision (atol=1e-6)",
    ),
    SimulatorInfo(
        name="Real IBM quantum hardware",
        module="quantum/ibm_hardware.py (stored results only on this site)",
        simulates_amplitudes=False,
        models_gates_directly=True,
        uses_classically_known_period=True,
        practical_limit="N=15 only, using a compiled circuit valid specifically because every a mod 15 has an order that's a power of two",
        intended_purpose="Confirms the predicted interference pattern is physically real on today's noisy hardware, not just an artifact of simulators agreeing with each other.",
        known_limitations="Not a scalability result -- the compiled circuit needs the order known in advance, same caveat as the fast sampler.",
        verified_by="notes/05-real-hardware-validation.md: two independent hardware runs, total variation distance ~0.017 and ~0.0165 from theory",
    ),
]


@router.get("/compare", response_model=SimulatorCompareResponse)
def compare() -> SimulatorCompareResponse:
    return SimulatorCompareResponse(simulators=_SIMULATORS)
