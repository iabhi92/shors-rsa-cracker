from pydantic import BaseModel


class ProjectMeta(BaseModel):
    test_count: int
    classical_attack_methods: list[str]
    quantum_backends: list[str]
    supported_demonstrations: list[str]
    ibm_hardware_validated: bool
    ibm_hardware_backend_name: str | None
