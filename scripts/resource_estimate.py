"""The quantum-side companion to benchmark_classical.py: how many qubits and gates this
project's honest gate-level circuit (quantum/modexp_circuit.py, via
quantum/resource_estimate.py) would need at real RSA key sizes, plotted alongside the
published Gidney & Ekera (2019) estimate for an actual fault-tolerant quantum computer.

Unlike benchmark_classical.py, this isn't a runtime measurement — nothing (this simulator or
any classical computer) can actually run a thousands-of-qubits circuit. It's an exact gate
count computed in closed form (see quantum/resource_estimate.py's docstring for how that
formula is derived and validated against real measured counts at small scale), which is
possible precisely because Shor's algorithm's resource requirements are polynomial, not
exponential, in the modulus size — the qualitative claim this whole project is built to
demonstrate.

Run with: python scripts/resource_estimate.py
Writes: data/quantum_resource_estimate.csv, data/quantum_resource_estimate.png
"""

import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import matplotlib.pyplot as plt

from quantum.resource_estimate import estimate_for_rsa_bits, gidney_ekera_2019_estimate

BIT_SIZES = [16, 32, 64, 128, 256, 512, 1024, 2048]
DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def main() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    rows = []

    for bits in BIT_SIZES:
        est = estimate_for_rsa_bits(bits)
        ge = gidney_ekera_2019_estimate(bits)
        print(
            f"{bits:5d} bits: this project's circuit needs {est.total_qubits:,} qubits, "
            f"{est.toffoli_equivalent_gates:,} Toffoli-equivalent gates  "
            f"[Gidney & Ekera 2019: {ge['logical_qubits']:,.0f} logical qubits, "
            f"{ge['toffoli_gates']:,.3e} Toffolis]"
        )
        rows.append(
            {
                "bits": bits,
                "this_project_qubits": est.total_qubits,
                "this_project_toffoli_equivalent_gates": est.toffoli_equivalent_gates,
                "gidney_ekera_2019_logical_qubits": ge["logical_qubits"],
                "gidney_ekera_2019_toffoli_gates": ge["toffoli_gates"],
            }
        )

    csv_path = DATA_DIR / "quantum_resource_estimate.csv"
    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"\nWrote {csv_path}")

    plot_path = DATA_DIR / "quantum_resource_estimate.png"
    _plot(rows, plot_path)
    print(f"Wrote {plot_path}")


def _plot(rows: list[dict], out_path: Path) -> None:
    bits = [r["bits"] for r in rows]
    fig, (ax_qubits, ax_gates) = plt.subplots(1, 2, figsize=(12, 5))

    ax_qubits.plot(bits, [r["this_project_qubits"] for r in rows], marker="o", label="this project (unoptimized)")
    ax_qubits.plot(
        bits, [r["gidney_ekera_2019_logical_qubits"] for r in rows], marker="s", label="Gidney & Ekera 2019 (logical)"
    )
    ax_qubits.set_xscale("log", base=2)
    ax_qubits.set_yscale("log")
    ax_qubits.set_xlabel("RSA modulus size (bits)")
    ax_qubits.set_ylabel("qubits (log scale)")
    ax_qubits.set_title("Qubit count: both O(n)")
    ax_qubits.legend()
    ax_qubits.grid(True, which="both", alpha=0.3)

    ax_gates.plot(
        bits, [r["this_project_toffoli_equivalent_gates"] for r in rows], marker="o", label="this project (unoptimized)"
    )
    ax_gates.plot(
        bits, [r["gidney_ekera_2019_toffoli_gates"] for r in rows], marker="s", label="Gidney & Ekera 2019 (Toffolis)"
    )
    ax_gates.set_xscale("log", base=2)
    ax_gates.set_yscale("log")
    ax_gates.set_xlabel("RSA modulus size (bits)")
    ax_gates.set_ylabel("gates (log scale)")
    ax_gates.set_title("Gate count: both O(n^3)-ish")
    ax_gates.legend()
    ax_gates.grid(True, which="both", alpha=0.3)

    fig.suptitle(
        "Resource scaling is polynomial either way\n"
        "this project's textbook circuit vs. a real optimized fault-tolerant estimate (different constants, same shape)",
        fontsize=11,
    )
    fig.tight_layout(rect=(0, 0, 1, 0.93))
    fig.savefig(out_path, dpi=150)


if __name__ == "__main__":
    main()
