"""Schema for the standalone /api/translate endpoint."""
from __future__ import annotations

from .common import CamelModel, EngineId, TextBubble, TokenUsage


class TranslateRequest(CamelModel):
    bubbles: list[TextBubble]
    engine: EngineId


class TranslateResponse(CamelModel):
    bubbles: list[TextBubble]
    tokens: TokenUsage | None = None
