import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from quantum.modexp_circuit import ancilla_qubit_count
from quantum.resource_estimate import (
    GateCounts,
    closed_form_gate_counts,
    count_gates_for_modular_exponentiation,
    estimate_for_rsa_bits,
    gidney_ekera_2019_estimate,
)

# --- closed_form_gate_counts: exact match against real measured counts --------------------
#
# This is the load-bearing test: closed_form_gate_counts is a hand-derived formula, only
# trustworthy at 2048-bit scale (where actually running the circuit-emission code to count
# calls is computationally infeasible — see quantum/resource_estimate.py's module docstring)
# because it's proven here to reproduce CountingRegister's real, measured counts *exactly*
# at every small size that can be checked directly, not just asymptotically.


@pytest.mark.parametrize("n_target", [3, 4, 6, 8, 10, 12])
@pytest.mark.parametrize("n_count_offset", [0, 1, -1])  # exercise n_count != 2*n_target too
def test_closed_form_matches_measured_counts_exactly(n_target, n_count_offset):
    n_count = 2 * n_target + n_count_offset
    reg = count_gates_for_modular_exponentiation(n_target, n_count=n_count)
    measured = GateCounts.from_counting_register(reg)
    formula = closed_form_gate_counts(n_count, n_target)

    assert formula.single_qubit_gates == measured.single_qubit_gates
    assert formula.controlled_gates == measured.controlled_gates
    assert formula.multi_controlled_gates == measured.multi_controlled_gates
    assert formula.swaps == measured.swaps
    assert formula.controlled_swaps == measured.controlled_swaps


@settings(max_examples=30, deadline=None)
@given(n_target=st.integers(min_value=2, max_value=12), n_count=st.integers(min_value=2, max_value=20))
def test_closed_form_matches_measured_counts_property(n_target, n_count):
    reg = count_gates_for_modular_exponentiation(n_target, n_count=n_count)
    measured = GateCounts.from_counting_register(reg)
    formula = closed_form_gate_counts(n_count, n_target)
    assert formula == GateCounts(
        single_qubit_gates=measured.single_qubit_gates,
        controlled_gates=measured.controlled_gates,
        multi_controlled_gates=measured.multi_controlled_gates,
        swaps=measured.swaps,
        controlled_swaps=measured.controlled_swaps,
    )


def test_closed_form_never_emits_more_than_doubly_controlled_gates():
    # toffoli_equivalent_count()'s accounting assumes this; if the construction ever changed
    # to use a 3+-controlled gate somewhere, that method should fail loudly, not silently
    # undercount — this test pins down the assumption it relies on.
    counts = closed_form_gate_counts(n_count=64, n_target=32)
    assert set(counts.multi_controlled_gates.keys()) <= {1, 2}
    counts.toffoli_equivalent_count()  # must not raise


# --- estimate_for_rsa_bits: sane at both toy and real-world RSA scale ----------------------


def test_estimate_qubit_count_matches_the_actual_ancilla_formula():
    est = estimate_for_rsa_bits(2048)
    assert est.n_target == 2048
    assert est.n_ancilla == ancilla_qubit_count(est.n_target)
    assert est.total_qubits == est.n_count + est.n_target + est.n_ancilla


def test_estimate_is_fast_and_exact_at_real_rsa_scale():
    # The whole point of closed_form_gate_counts over count_gates_for_modular_exponentiation:
    # this must return instantly (no O(n_count * n_target^3) loop) even at 2048 bits.
    est = estimate_for_rsa_bits(2048)
    assert est.total_qubits > 0
    assert est.toffoli_equivalent_gates > 0
    assert est.total_gate_emissions > est.toffoli_equivalent_gates


@pytest.mark.parametrize("bits", [128, 256, 512, 1024, 2048])
def test_qubit_and_gate_counts_grow_monotonically_with_modulus_size(bits):
    smaller = estimate_for_rsa_bits(bits // 2)
    larger = estimate_for_rsa_bits(bits)
    assert larger.total_qubits > smaller.total_qubits
    assert larger.toffoli_equivalent_gates > smaller.toffoli_equivalent_gates


def test_qubit_count_is_linear_in_modulus_bits_not_exponential():
    # The actual, falsifiable version of "Shor's algorithm needs polynomially many qubits":
    # doubling the modulus size should roughly double the qubit count (linear), nowhere near
    # doubling *again* per extra bit (which is what exponential growth would look like).
    est_1024 = estimate_for_rsa_bits(1024)
    est_2048 = estimate_for_rsa_bits(2048)
    ratio = est_2048.total_qubits / est_1024.total_qubits
    assert 1.9 < ratio < 2.1


# --- gidney_ekera_2019_estimate: sanity on the published-formula transcription -------------


def test_gidney_ekera_formula_matches_paper_at_2048_bits():
    # From arXiv:1905.09749's abstract: "20 million noisy qubits" of *physical* qubits after
    # error-correction overhead; the paper's logical-qubit formula (3n + 0.002 n lg n) is what
    # gidney_ekera_2019_estimate implements, so it comes out far below 20 million here — that
    # gap (logical vs. physical, post-error-correction) is exactly the point, not an error.
    result = gidney_ekera_2019_estimate(2048)
    assert 6000 < result["logical_qubits"] < 6300
    assert 2.5e9 < result["toffoli_gates"] < 2.7e9
