"""Typed errors and FastAPI exception handler."""
from __future__ import annotations

import logging
from enum import Enum

from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class ErrorCode(str, Enum):
    AUTH = "AUTH"
    RATE_LIMIT = "RATE_LIMIT"
    QUOTA = "QUOTA"
    INVALID_KEY = "INVALID_KEY"
    INVALID_INPUT = "INVALID_INPUT"
    NETWORK = "NETWORK"
    UNKNOWN = "UNKNOWN"


# HTTP status code per error category.
_STATUS_BY_CODE: dict[ErrorCode, int] = {
    ErrorCode.AUTH: 401,
    ErrorCode.INVALID_KEY: 422,
    ErrorCode.INVALID_INPUT: 400,
    ErrorCode.RATE_LIMIT: 429,
    ErrorCode.QUOTA: 429,
    ErrorCode.NETWORK: 502,
    ErrorCode.UNKNOWN: 500,
}


class ProviderError(Exception):
    """Error raised by a provider module; the handler turns it into JSON."""

    def __init__(
        self,
        code: ErrorCode,
        engine: str,
        message: str,
        *,
        recoverable: bool = False,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.engine = engine
        self.message = message
        self.recoverable = recoverable

    @property
    def http_status(self) -> int:
        return _STATUS_BY_CODE.get(self.code, 500)

    def to_dict(self) -> dict:
        return {
            "code": self.code.value,
            "engine": self.engine,
            "message": self.message,
            "recoverable": self.recoverable,
        }


async def provider_error_handler(_: Request, exc: ProviderError) -> JSONResponse:
    logger.warning(
        "ProviderError engine=%s code=%s message=%s",
        exc.engine,
        exc.code.value,
        exc.message,
    )
    return JSONResponse(status_code=exc.http_status, content={"error": exc.to_dict()})
