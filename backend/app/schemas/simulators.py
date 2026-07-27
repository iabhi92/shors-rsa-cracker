from pydantic import BaseModel


class SimulatorInfo(BaseModel):
    name: str
    module: str
    simulates_amplitudes: bool
    models_gates_directly: bool
    uses_classically_known_period: bool
    practical_limit: str
    intended_purpose: str
    known_limitations: str
    verified_by: str


class SimulatorCompareResponse(BaseModel):
    simulators: list[SimulatorInfo]
