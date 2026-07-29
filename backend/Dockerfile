# Build context must be the repository root (see docker-compose.yml) -- this backend imports
# rsa/, attacker/, quantum/ directly, so those need to be present in the image alongside
# backend/ itself.
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY rsa/ rsa/
COPY attacker/ attacker/
COPY quantum/ quantum/
COPY notes/ notes/
COPY SECURITY.md ./
COPY data/classical_benchmark.csv data/quantum_resource_estimate.csv data/ibm_hardware_run_a7_N15.json data/test_summary.json data/
COPY backend/ backend/

EXPOSE 8000
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
