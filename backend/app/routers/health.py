"""Liveness probe."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from ..config import Settings, get_settings

router = APIRouter()


@router.get("/health")
async def health(settings: Annotated[Settings, Depends(get_settings)]) -> dict:
    """Returns ``{"status": "ok", "providers": {...}}`` without leaking keys.

    The ``providers`` map only reports whether each server-side key is
    configured (``true``) or absent (``false``). Knowing which providers can
    be used without BYOK is useful for frontend UIs (e.g. greying-out engines
    that need a user-supplied key).
    """
    return {
        "status": "ok",
        "environment": settings.environment,
        "providers": {
            "gemini": bool(settings.gemini_api_key),
            "deepl": bool(settings.deepl_api_key),
            "torii": bool(settings.torii_api_key),
            "google": bool(settings.google_api_key),
            "ichigo": False,  # Ichigo always requires user login (BYOK only).
            "openai": bool(settings.openai_api_key),
        },
    }
