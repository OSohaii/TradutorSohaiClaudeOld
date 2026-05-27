"""Request/response models for /api/pipeline."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from .common import CamelModel, EngineId, TextBubble, TokenUsage


class OcrConfig(CamelModel):
    engine: EngineId


class TranslationConfig(CamelModel):
    engine: EngineId


class CleanerConfig(CamelModel):
    """Optional second pass that produces a text-free version of the page.

    Only Torii currently supports inpaint-only mode. The cleaner runs in
    parallel with OCR and a failure here never aborts the OCR result — it is
    surfaced as a warning.
    """

    enabled: bool = False
    engine: EngineId = EngineId.TORII


class PipelineOptions(CamelModel):
    target_language: str = "Português (Brasil)"
    target_lang_code: str = "pt-BR"
    ichigo_model: str = "Gemini 3 Pro"
    source_language: str = "Japanese"


class PipelineRequest(CamelModel):
    image_base64: str = Field(min_length=4)
    ocr: OcrConfig
    translation: TranslationConfig
    cleaner: CleanerConfig = CleanerConfig()
    options: PipelineOptions = PipelineOptions()
    phase: Literal['full', 'ocr-only', 'translate-only'] = 'full'
    bubbles: list[TextBubble] = []


class PipelineResponse(CamelModel):
    bubbles: list[TextBubble]
    translated_image_base64: str | None = None
    cleaned_image_base64: str | None = None
    tokens: TokenUsage | None = None
    warnings: list[str] = []
    plan: dict[str, Any] = {}
