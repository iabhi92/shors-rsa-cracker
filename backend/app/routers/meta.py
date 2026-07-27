"""Home-page project statistics -- computed from the repository, not hardcoded figures that
could silently drift out of date.

Test count reads data/test_summary.json, a precomputed value (same pattern as
data/classical_benchmark.csv: measured once by actually running the tools, checked in, loaded
by the backend rather than regenerated on every request). This deliberately does NOT run
`pytest --collect-only` as a subprocess from inside the running web server -- that was tried
during development and caused a real problem: this backend's own test suite (backend/tests/)
imports this module, so a subprocess call to pytest from here becomes pytest invoking pytest
from within pytest, which hung rather than completing. Falls back to a regex count of `def
test_` (an undercount vs. pytest's parametrize-expanded total, but always safe and fast) if
the precomputed file is missing.
"""

import json
import re
from pathlib import Path

from fastapi import APIRouter

from attacker.classical import ATTACK_METHODS
from backend.app.schemas.meta import ProjectMeta

router = APIRouter()

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
_TEST_SUMMARY_PATH = _REPO_ROOT / "data" / "test_summary.json"
_TEST_DEF_RE = re.compile(r"^\s*(?:async\s+)?def (test_\w+)", re.MULTILINE)


def _count_tests_via_regex() -> int:
    total = 0
    for path in (_REPO_ROOT / "tests").glob("test_*.py"):
        total += len(_TEST_DEF_RE.findall(path.read_text()))
    return total


def _load_test_count() -> int:
    if _TEST_SUMMARY_PATH.exists():
        try:
            return int(json.loads(_TEST_SUMMARY_PATH.read_text())["test_count"])
        except (json.JSONDecodeError, KeyError, ValueError):
            pass
    return _count_tests_via_regex()


_CACHED_TEST_COUNT = _load_test_count()


@router.get("/meta", response_model=ProjectMeta)
def meta() -> ProjectMeta:
    ibm_path = _REPO_ROOT / "data" / "ibm_hardware_run_a7_N15.json"
    ibm_validated = ibm_path.exists()
    backend_name = None
    if ibm_validated:
        backend_name = json.loads(ibm_path.read_text()).get("backend_name")

    return ProjectMeta(
        test_count=_CACHED_TEST_COUNT,
        classical_attack_methods=list(ATTACK_METHODS.keys()),
        quantum_backends=["honest statevector", "gate-level (zero shortcuts)", "fast sampler", "Cirq cross-check"],
        supported_demonstrations=[
            "RSA keygen/encrypt/decrypt",
            "Classical factoring attacks",
            "Quantum gate/Bell-state demos",
            "QFT period-finding demo",
            "Full Shor's algorithm pipeline",
            "Circuit resource estimation",
            "Real IBM hardware validation",
        ],
        ibm_hardware_validated=ibm_validated,
        ibm_hardware_backend_name=backend_name,
    )
