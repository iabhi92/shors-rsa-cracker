"""Submit quantum/ibm_hardware.py's compiled Shor's-algorithm circuit to a real IBM quantum
computer, and plot the real, noisy measurement distribution against this project's own
theoretical prediction (quantum/shor.py's already-verified simulator).

Needs IBM_QUANTUM_API_KEY and IBM_QUANTUM_CRN set (see .env.example) and
`pip install -r requirements-hardware.txt`. Uses real hardware time on your IBM Quantum plan
-- this does not run automatically in CI or as part of the default test suite.

Run with: python scripts/run_on_ibm_hardware.py
Writes: data/ibm_hardware_run_a<a>_N<N>.json, data/ibm_hardware_comparison.png
"""

import datetime
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import matplotlib.pyplot as plt

from quantum.fast_sim import multiplicative_order
from quantum.ibm_hardware import run_on_hardware

A, N, N_COUNT, SHOTS = 7, 15, 3, 4000
DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def theoretical_distribution(a: int, N: int, n_count: int) -> dict[int, float]:
    """Exact peaks at k*2^n_count/r for k=0..r-1 -- valid whenever r divides 2^n_count evenly
    (true here: r=4 divides 2^3=8), matching quantum/shor.py's own documented exact-peak case."""
    r = multiplicative_order(a, N)
    dim = 2**n_count
    assert dim % r == 0, "this simple exact-peak formula needs r to divide 2^n_count evenly"
    peak_spacing = dim // r
    return {k * peak_spacing: 1.0 / r for k in range(r)}


def main() -> None:
    DATA_DIR.mkdir(exist_ok=True)

    print(f"Submitting a={A}, N={N}, n_count={N_COUNT}, shots={SHOTS} to real IBM hardware...")
    result = run_on_hardware(A, N, N_COUNT, shots=SHOTS)
    print(f"Ran on {result.backend_name}, job {result.job_id}")

    theory = theoretical_distribution(A, N, N_COUNT)
    measured_probs = {k: v / result.shots for k, v in result.counts.items()}
    dim = 2**N_COUNT
    tvd = 0.5 * sum(
        abs(measured_probs.get(x, 0.0) - theory.get(x, 0.0)) for x in range(dim)
    )
    leaked = sum(v for k, v in measured_probs.items() if k not in theory)

    record = {
        "a": A,
        "N": N,
        "n_count": N_COUNT,
        "r": multiplicative_order(A, N),
        "backend_name": result.backend_name,
        "job_id": result.job_id,
        "shots": result.shots,
        "timestamp_utc": datetime.datetime.now(datetime.UTC).isoformat(),
        "counts": result.counts,
        "theoretical_distribution": theory,
        "total_variation_distance": tvd,
        "probability_mass_on_theoretically_impossible_outcomes": leaked,
    }
    json_path = DATA_DIR / f"ibm_hardware_run_a{A}_N{N}.json"
    with open(json_path, "w") as f:
        json.dump(record, f, indent=2)
    print(f"Wrote {json_path}")
    print(f"Total variation distance from theory: {tvd:.4f}")
    print(f"Probability mass on theoretically-impossible outcomes: {leaked:.4f}")

    plot_path = DATA_DIR / "ibm_hardware_comparison.png"
    _plot(record, plot_path)
    print(f"Wrote {plot_path}")


def _plot(record: dict, out_path: Path) -> None:
    dim = 2 ** record["n_count"]
    xs = list(range(dim))
    theory = record["theoretical_distribution"]
    measured = record["counts"]
    shots = record["shots"]

    theory_y = [theory.get(str(x), theory.get(x, 0.0)) for x in xs]
    measured_y = [measured.get(str(x), measured.get(x, 0)) / shots for x in xs]

    fig, ax = plt.subplots(figsize=(9, 5))
    width = 0.4
    ax.bar([x - width / 2 for x in xs], theory_y, width=width, label="theoretical prediction (noiseless)")
    ax.bar([x + width / 2 for x in xs], measured_y, width=width, label=f"real hardware ({record['backend_name']})")
    ax.set_xlabel("measured value (counting register)")
    ax.set_ylabel("probability")
    ax.set_xticks(xs)
    ax.set_title(
        f"Shor's algorithm period-finding on real IBM hardware: a={record['a']}, N={record['N']}\n"
        f"total variation distance from theory: {record['total_variation_distance']:.4f} "
        f"({shots} shots, job {record['job_id']})"
    )
    ax.legend()
    ax.grid(True, axis="y", alpha=0.3)
    fig.tight_layout()
    fig.savefig(out_path, dpi=150)


if __name__ == "__main__":
    main()
