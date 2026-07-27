from pydantic import BaseModel


class BenchmarkRow(BaseModel):
    bits: int
    n: int
    trial_division_seconds: float
    trial_division_succeeded: bool
    pollards_rho_seconds: float
    pollards_rho_succeeded: bool


class BenchmarkResponse(BaseModel):
    rows: list[BenchmarkRow]
    source_file: str
