"""IBM Hardware Validation -- reads ONLY the specific, whitelisted result file(s) already
committed to this repo. There is no code path in this router (or anywhere else in backend/)
that imports qiskit_ibm_runtime, reads IBM_QUANTUM_API_KEY/IBM_QUANTUM_CRN, or could submit a
new job. That's a structural guarantee, not just a policy: the capability to talk to IBM
Quantum simply isn't imported into this process. See quantum/ibm_hardware.py (a separate,
credentialed, CLI-only module) for the code that actually submitted the runs shown here."""

import json
from pathlib import Path

from fastapi import APIRouter

from backend.app.errors import AppError
from backend.app.schemas.ibm import IbmHardwareResponse, IbmHardwareResult

router = APIRouter()

_DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"
# Explicit whitelist -- never a directory listing of data/, which could otherwise expose
# unrelated files (see WEBSITE_IMPLEMENTATION_PLAN.md's note on data/usage*.csv).
_ALLOWED_RESULT_FILES = ["ibm_hardware_run_a7_N15.json"]


@router.get("/results", response_model=IbmHardwareResponse)
def results() -> IbmHardwareResponse:
    runs = []
    for filename in _ALLOWED_RESULT_FILES:
        path = _DATA_DIR / filename
        if not path.exists():
            continue
        with open(path) as f:
            raw = json.load(f)
        runs.append(IbmHardwareResult(**raw))
    if not runs:
        raise AppError("No stored IBM hardware results found.", status_code=404)
    return IbmHardwareResponse(runs=runs)
