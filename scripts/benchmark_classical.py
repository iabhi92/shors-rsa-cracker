"""Measure how classical factoring attacks actually scale with RSA key size.

This is the empirical backbone of the "classical computing fails" half of the project:
rather than asserting that factoring is exponentially hard, generate real RSA moduli at
increasing bit sizes and time real attacks against them, then plot the (unmistakably
exponential) growth curve.

Run with: python scripts/benchmark_classical.py
Writes: data/classical_benchmark.csv, data/classical_benchmark.png
"""

import csv
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import matplotlib.pyplot as plt

from attacker.classical import pollards_rho, trial_division
from rsa.keygen import generate_keypair

# Kept deliberately small — trial division is O(sqrt(n)), so bit sizes much past this
# would make the benchmark itself take hours. That escalation *is* the finding: a real
# RSA-2048 modulus is ~34x more bits than our largest point here, and sqrt(n) roughly
# doubles in difficulty for every 2 bits added to n.
BIT_SIZES = [16, 20, 24, 28, 32, 36, 40, 44, 48]
TIMEOUT_PER_ATTEMPT = 20.0
DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def main() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    rows = []

    for bits in BIT_SIZES:
        kp = generate_keypair(bits)
        n = kp.public.n
        print(f"n = {n} ({n.bit_length()} bits, p={kp.p}, q={kp.q})")

        td = trial_division(n, timeout=TIMEOUT_PER_ATTEMPT)
        print(f"  trial_division: succeeded={td.succeeded} time={td.elapsed_seconds:.4f}s ops={td.operations}")

        pr = pollards_rho(n, timeout=TIMEOUT_PER_ATTEMPT)
        print(f"  pollards_rho:   succeeded={pr.succeeded} time={pr.elapsed_seconds:.4f}s ops={pr.operations}")

        rows.append(
            {
                "bits": n.bit_length(),
                "n": n,
                "trial_division_seconds": td.elapsed_seconds,
                "trial_division_succeeded": td.succeeded,
                "pollards_rho_seconds": pr.elapsed_seconds,
                "pollards_rho_succeeded": pr.succeeded,
            }
        )

    csv_path = DATA_DIR / "classical_benchmark.csv"
    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"\nWrote {csv_path}")

    plot_path = DATA_DIR / "classical_benchmark.png"
    _plot(rows, plot_path)
    print(f"Wrote {plot_path}")


def _plot(rows: list[dict], out_path: Path) -> None:
    bits = [r["bits"] for r in rows]
    td_times = [r["trial_division_seconds"] for r in rows]
    pr_times = [r["pollards_rho_seconds"] for r in rows]

    fig, ax = plt.subplots(figsize=(8, 5))
    ax.plot(bits, td_times, marker="o", label="trial division")
    ax.plot(bits, pr_times, marker="s", label="Pollard's rho")
    ax.set_yscale("log")
    ax.set_xlabel("RSA modulus size (bits)")
    ax.set_ylabel("time to factor (seconds, log scale)")
    ax.set_title("Classical factoring time vs. RSA key size")
    ax.legend()
    ax.grid(True, which="both", alpha=0.3)
    fig.tight_layout()
    fig.savefig(out_path, dpi=150)


if __name__ == "__main__":
    main()
