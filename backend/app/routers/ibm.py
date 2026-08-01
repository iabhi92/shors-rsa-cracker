"""IBM Hardware Validation -- reads ONLY the specific, whitelisted result file(s) already
committed to this repo. This router itself never imports qiskit_ibm_runtime or reads
IBM_QUANTUM_API_KEY/IBM_QUANTUM_CRN; it can only serve what's already on disk. The backend as a
whole is no longer credential-free, though: backend/app/routers/ibm_live.py is a deliberately
separate, clearly-labeled router that DOES submit real, on-demand hardware jobs -- see its own
module docstring for the rate limits guarding it."""

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
