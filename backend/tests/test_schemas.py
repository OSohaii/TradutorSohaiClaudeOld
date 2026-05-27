"""Schema round-trip tests.

The wire format is camelCase but Python uses snake_case. These tests pin that
contract so a refactor cannot silently change the JSON shape the frontend
already depends on.
"""
from __future__ import annotations

from app.schemas.common import BoundingBox, EngineId, TextBubble, TokenUsage
from app.schemas.pipeline import (
    CleanerConfig,
    OcrConfig,
    PipelineRequest,
    TranslationConfig,
)


def test_text_bubble_serializes_camel_case():
    bubble = TextBubble(
        id="b1",
        original_text="こんにちは",
        translated_text="Olá",
        type="dialogue",
        box=BoundingBox(ymin=10, xmin=20, ymax=100, xmax=200),
    )
    raw = bubble.model_dump(by_alias=True)
    assert raw == {
        "id": "b1",
        "originalText": "こんにちは",
        "translatedText": "Olá",
        "type": "dialogue",
        "box": {"ymin": 10, "xmin": 20, "ymax": 100, "xmax": 200},
    }


def test_text_bubble_accepts_camel_case_input():
    bubble = TextBubble.model_validate({
        "id": "b1",
        "originalText": "ABC",
        "translatedText": "DEF",
        "box": {"ymin": 0, "xmin": 0, "ymax": 100, "xmax": 100},
    })
    assert bubble.original_text == "ABC"
    assert bubble.translated_text == "DEF"
    assert bubble.type == "dialogue"


def test_pipeline_request_validates_engines():
    req = PipelineRequest.model_validate({
        "imageBase64": "AAAA",
        "ocr": {"engine": "GEMINI_PRO"},
        "translation": {"engine": "DEEPL"},
    })
    assert req.ocr.engine == EngineId.GEMINI_PRO
    assert req.translation.engine == EngineId.DEEPL
    assert req.cleaner.enabled is False  # default


def test_pipeline_request_round_trip():
    payload = {
        "imageBase64": "AAAA",
        "ocr": {"engine": "TORII"},
        "translation": {"engine": "TORII"},
        "cleaner": {"enabled": True, "engine": "TORII"},
        "options": {
            "targetLanguage": "Português (Brasil)",
            "targetLangCode": "pt-BR",
            "ichigoModel": "Gemini 3 Pro",
        },
    }
    req = PipelineRequest.model_validate(payload)
    out = req.model_dump(by_alias=True)
    assert out["ocr"]["engine"] == "TORII"
    assert out["cleaner"]["enabled"] is True
    assert out["options"]["targetLangCode"] == "pt-BR"


def test_engine_ids_match_frontend_strings():
    """Pin the wire values so frontend/backend can't drift."""
    assert {e.value for e in EngineId} == {
        "GEMINI_FLASH",
        "GEMINI_FLASH_FULL",
        "GEMINI_3_FLASH",
        "GEMINI_3_FLASH_FULL",
        "GEMINI_PRO",
        "GEMINI_PRO_FULL",
        "GEMINI_35_FLASH",
        "GEMINI_35_FLASH_FULL",
        "ICHIGO",
        "TORII",
        "DEEPL",
        "GOOGLE",
        "GPT4O",
        "GPT4O_MINI",
    }


def test_token_usage_defaults():
    t = TokenUsage()
    assert t.input == 0 and t.output == 0 and t.total == 0 and t.model == ""


def test_ocr_config_round_trip():
    cfg = OcrConfig.model_validate({"engine": "GEMINI_3_FLASH"})
    assert cfg.engine == EngineId.GEMINI_3_FLASH
    assert cfg.model_dump(by_alias=True) == {"engine": "GEMINI_3_FLASH"}


def test_cleaner_config_defaults_to_disabled():
    cfg = CleanerConfig()
    assert cfg.enabled is False
    assert cfg.engine == EngineId.TORII


def test_translation_config_defaults():
    cfg = TranslationConfig.model_validate({"engine": "GOOGLE"})
    assert cfg.engine == EngineId.GOOGLE
