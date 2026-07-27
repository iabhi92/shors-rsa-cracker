from pydantic import BaseModel


class IbmHardwareResult(BaseModel):
    a: int
    N: int  # matches data/ibm_hardware_run_*.json's own key, and quantum/shor.py's convention
    n_count: int
    r: int
    backend_name: str
    job_id: str
    shots: int
    timestamp_utc: str
    counts: dict[str, int]
    theoretical_distribution: dict[str, float]
    total_variation_distance: float
    probability_mass_on_theoretically_impossible_outcomes: float


class IbmHardwareResponse(BaseModel):
    runs: list[IbmHardwareResult]
    disclaimer: str = (
        "These are stored results from real IBM quantum hardware runs already documented in "
        "this repository (notes/05-real-hardware-validation.md). This website cannot submit "
        "a new hardware job -- IBM credentials are never imported into this backend at all."
    )
