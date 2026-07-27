"""Central error handling: every response the API sends back, on success or failure, is JSON
-- never a raw Python traceback. The underlying rsa/attacker/quantum modules already raise
ValueError with a clear message for invalid input (e.g. rsa.core.encrypt_int's range check,
quantum.modexp_circuit's coprimality check) -- AppError wraps those consistently, and the
catch-all handler makes sure anything unexpected still degrades to a clean 500 instead of
leaking internals.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("shors_rsa_cracker.api")


class AppError(Exception):
    def __init__(self, message: str, status_code: int = 400, headers: dict[str, str] | None = None) -> None:
        self.message = message
        self.status_code = status_code
        self.headers = headers
        super().__init__(message)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message}, headers=exc.headers)

    @app.exception_handler(ValueError)
    async def handle_value_error(request: Request, exc: ValueError) -> JSONResponse:
        # rsa/attacker/quantum raise ValueError for invalid mathematical input (e.g. "a must
        # be coprime with N") -- these are safe, already-human-readable messages, not internals.
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled error on %s", request.url.path)
        return JSONResponse(status_code=500, content={"detail": "internal server error"})
