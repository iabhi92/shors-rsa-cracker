"""FastAPI entrypoint. Run from the repo root with:

    uvicorn backend.app.main:app --reload

The sys.path insert below mirrors the pattern already used by scripts/*.py in this repo, so
`from rsa... / from attacker... / from quantum...` resolve regardless of how uvicorn was
invoked (module path vs. direct file execution).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.config import get_settings
from backend.app.errors import register_error_handlers
from backend.app.routers import (
    circuit,
    classical,
    docs,
    ibm,
    ibm_live,
    meta,
    quantum,
    resource,
    rsa,
    security_demo,
    shor,
    simulators,
    status,
)
from backend.app.security_headers import security_headers_middleware

app = FastAPI(
    title="Shor's RSA Cracker API",
    description=(
        "Backend for the shors-rsa-cracker demonstration site. Every computational endpoint "
        "calls this project's real rsa/, attacker/, and quantum/ modules directly -- nothing "
        "here is mocked or hardcoded. Educational key/input sizes only; see /api/meta and "
        "SECURITY.md for the full limitations list."
    ),
    version="0.1.0",
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
    # Without this, a cross-origin fetch() (GitHub Pages calling this Render-hosted API) can
    # only read the small CORS-safelisted response headers (Cache-Control, Content-Type, etc.)
    # via JS -- browsers hide every other header, including the security ones this project
    # actually sets, unless the server explicitly opts them in here. The Security Dashboard
    # page's live header self-check needs to read these directly, not just have them present.
    expose_headers=[
        "Content-Security-Policy",
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Permissions-Policy",
        "Strict-Transport-Security",
        "Cache-Control",
    ],
)

app.middleware("http")(security_headers_middleware)

register_error_handlers(app)

app.include_router(meta.router, prefix="/api", tags=["meta"])
app.include_router(rsa.router, prefix="/api/rsa", tags=["rsa"])
app.include_router(security_demo.router, prefix="/api/security-demo", tags=["security-demo"])
app.include_router(classical.router, prefix="/api/classical", tags=["classical"])
app.include_router(quantum.router, prefix="/api/quantum", tags=["quantum"])
app.include_router(shor.router, prefix="/api/shor", tags=["shor"])
app.include_router(circuit.router, prefix="/api/circuit", tags=["circuit"])
app.include_router(simulators.router, prefix="/api/simulators", tags=["simulators"])
app.include_router(resource.router, prefix="/api/resource-estimate", tags=["resource"])
app.include_router(ibm.router, prefix="/api/ibm-hardware", tags=["ibm-hardware"])
app.include_router(ibm_live.router, prefix="/api/ibm-hardware/live", tags=["ibm-hardware-live"])
app.include_router(docs.router, prefix="/api/docs", tags=["docs"])
app.include_router(status.router, prefix="/api/status", tags=["status"])


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
