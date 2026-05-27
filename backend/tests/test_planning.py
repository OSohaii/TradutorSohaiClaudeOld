"""Tests for the orchestrator's plan calculation.

These pin the routing decisions and document them. Each test names the
combination from the perspective of a frontend user.
"""
from __future__ import annotations

import pytest

from app.errors import ProviderError
from app.schemas.common import EngineId
from app.schemas.pipeline import (
    CleanerConfig,
    OcrConfig,
    PipelineOptions,
    PipelineRequest,
    TranslationConfig,
)
from app.services.pipeline import plan_pipeline


def _req(ocr: str, translation: str, *, cleaner: bool = False) -> PipelineRequest:
    return PipelineRequest(
        image_base64="AAAA",
        ocr=OcrConfig(engine=EngineId(ocr)),
        translation=TranslationConfig(engine=EngineId(translation)),
        cleaner=CleanerConfig(enabled=cleaner),
        options=PipelineOptions(),
    )


def test_torii_anywhere_means_full_torii():
    plan = plan_pipeline(_req("TORII", "DEEPL"))
    assert plan.use_torii_full is True
    assert plan.translation_done_in_ocr is True


def test_torii_as_translation_means_full_torii():
    plan = plan_pipeline(_req("GEMINI_PRO", "TORII"))
    assert plan.use_torii_full is True


def test_ichigo_handles_translation_in_one_call():
    plan = plan_pipeline(_req("ICHIGO", "DEEPL"))
    assert plan.translation_done_in_ocr is True
    assert plan.use_torii_full is False


def test_ichigo_can_run_with_torii_cleaner():
    plan = plan_pipeline(_req("ICHIGO", "GOOGLE", cleaner=True))
    assert plan.use_torii_cleaner is True


def test_gemini_full_engine_skips_second_pass():
    plan = plan_pipeline(_req("GEMINI_PRO_FULL", "DEEPL"))
    assert plan.translation_done_in_ocr is True
    assert plan.ocr_skip_translation is False


def test_gemini_pro_with_deepl_runs_two_passes():
    plan = plan_pipeline(_req("GEMINI_PRO", "DEEPL"))
    assert plan.translation_done_in_ocr is False
    assert plan.ocr_skip_translation is True
    assert plan.needs_separate_translation is True


def test_gemini_pro_with_same_engine_is_unified():
    plan = plan_pipeline(_req("GEMINI_PRO", "GEMINI_PRO"))
    assert plan.translation_done_in_ocr is True
    assert plan.ocr_skip_translation is False


def test_invalid_ocr_engine_raises():
    # GOOGLE is translate-only and shouldn't be selectable as OCR.
    with pytest.raises(ProviderError) as exc_info:
        plan_pipeline(_req("GOOGLE", "GOOGLE"))
    assert exc_info.value.code.value == "INVALID_INPUT"
