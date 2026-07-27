import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.rate_limit import (
    classical_attack_limiter,
    dashboard_demo_limiter,
    rsa_keygen_limiter,
    shor_run_limiter,
)


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(autouse=True)
def _reset_rate_limiters() -> None:
    # The limiter instances are module-level singletons (shared across every request in the
    # process, by design -- that's what makes them an actual limit), and TestClient's requests
    # all appear to originate from the same source IP ("testclient"), so without this, one
    # test's requests would count against the next test's budget.
    rsa_keygen_limiter.reset()
    classical_attack_limiter.reset()
    shor_run_limiter.reset()
    dashboard_demo_limiter.reset()
