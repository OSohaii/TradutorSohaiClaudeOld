"""Pipeline orchestrator.

This is the server-side equivalent of ``runPipeline`` in ``App.tsx``. Two
behavioural fixes are applied vs the original:

* B1 (diagnostic): a Torii cleaner failure no longer aborts the OCR result;
  it becomes a warning. Achieved with ``asyncio.gather(return_exceptions=True)``.
* B2 (diagnostic): the "is this a single-pass full pipeline" calculation lives
  in exactly one place (``plan_pipeline``), removing the duplicated boolean
  expressions that drifted in the frontend.
"""
from __future__ import annotations

import asyncio
import base64
import logging
from dataclasses import dataclass

from ..deps import KeyResolver
from ..errors import ErrorCode, ProviderError
from ..providers import deepl as deepl_provider
from ..providers import gemini as gemini_provider
from ..providers import google_translate as gt_provider
from ..providers import ichigo as ichigo_provider
from ..providers import openai as openai_provider
from ..providers import torii as torii_provider
from ..schemas.common import EngineId, TextBubble, TokenUsage
from ..schemas.pipeline import PipelineRequest, PipelineResponse

logger = logging.getLogger(__name__)


# --- Engine -> Gemini model id ----------------------------------------------

_GEMINI_MODELS: dict[EngineId, str] = {
    EngineId.GEMINI_FLASH: "gemini-2.5-flash",
    EngineId.GEMINI_FLASH_FULL: "gemini-2.5-flash",
    EngineId.GEMINI_3_FLASH: "gemini-3-flash-preview",
    EngineId.GEMINI_3_FLASH_FULL: "gemini-3-flash-preview",
    EngineId.GEMINI_PRO: "gemini-3.1-pro-preview",
    EngineId.GEMINI_PRO_FULL: "gemini-3.1-pro-preview",
    EngineId.GEMINI_35_FLASH: "gemini-3.5-flash",
    EngineId.GEMINI_35_FLASH_FULL: "gemini-3.5-flash",
}


def _is_gemini(engine: EngineId) -> bool:
    return engine in _GEMINI_MODELS


_OPENAI_MODELS: dict[EngineId, str] = {
    EngineId.GPT4O: "gpt-4o",
    EngineId.GPT4O_MINI: "gpt-4o-mini",
}


def _is_openai(engine: EngineId) -> bool:
    return engine in _OPENAI_MODELS


_FULL_PIPELINE_ENGINES = {
    EngineId.GEMINI_FLASH_FULL,
    EngineId.GEMINI_3_FLASH_FULL,
    EngineId.GEMINI_PRO_FULL,
    EngineId.GEMINI_35_FLASH_FULL,
}


# --- Plan -------------------------------------------------------------------


@dataclass(frozen=True)
class Plan:
    """Execution plan derived from a request.

    Three booleans describe the OCR side; whether translation runs as a
    second pass is determined by ``translation_done_in_ocr``.
    """

    use_torii_full: bool
    use_torii_cleaner: bool
    ocr_engine: EngineId
    translation_engine: EngineId
    ocr_skip_translation: bool
    translation_done_in_ocr: bool

    @property
    def needs_separate_translation(self) -> bool:
        return not self.translation_done_in_ocr


def plan_pipeline(req: PipelineRequest) -> Plan:
    """Single source of truth for OCR/translation routing decisions."""
    ocr = req.ocr.engine
    translation = req.translation.engine

    if ocr == EngineId.TORII or translation == EngineId.TORII:
        # Torii does OCR + translate + render in one call.
        return Plan(
            use_torii_full=True,
            use_torii_cleaner=False,
            ocr_engine=EngineId.TORII,
            translation_engine=EngineId.TORII,
            ocr_skip_translation=False,
            translation_done_in_ocr=True,
        )

    if ocr == EngineId.ICHIGO:
        # Ichigo also returns translated bubbles in one call.
        return Plan(
            use_torii_full=False,
            use_torii_cleaner=req.cleaner.enabled,
            ocr_engine=EngineId.ICHIGO,
            translation_engine=EngineId.ICHIGO,
            ocr_skip_translation=False,
            translation_done_in_ocr=True,
        )

    if _is_gemini(ocr):
        is_full = ocr in _FULL_PIPELINE_ENGINES
        is_native_match = ocr == translation and _is_gemini(ocr)
        unified = is_full or is_native_match
        return Plan(
            use_torii_full=False,
            use_torii_cleaner=req.cleaner.enabled,
            ocr_engine=ocr,
            translation_engine=translation,
            ocr_skip_translation=not unified,
            translation_done_in_ocr=unified,
        )

    if _is_openai(ocr):
        # OpenAI vision does OCR; if the same OpenAI engine is used for
        # translation, we let the OCR pass also translate (unified).
        is_native_match = ocr == translation
        unified = is_native_match
        return Plan(
            use_torii_full=False,
            use_torii_cleaner=req.cleaner.enabled,
            ocr_engine=ocr,
            translation_engine=translation,
            ocr_skip_translation=not unified,
            translation_done_in_ocr=unified,
        )

    # OCR engine that isn't Gemini/OpenAI/Ichigo/Torii doesn't make sense in the UI.
    raise ProviderError(
        ErrorCode.INVALID_INPUT,
        ocr.value,
        f"Engine '{ocr.value}' nao e uma OCR engine valida.",
    )


# --- Steps -------------------------------------------------------------------


async def _run_torii_full(
    image_bytes: bytes, req: PipelineRequest, keys: KeyResolver
) -> tuple[list[TextBubble], bytes]:
    api_key = keys.for_torii()
    output = await torii_provider.call(
        image_bytes,
        api_key=api_key,
        translator="gemini-2.5-flash",
        stroke_disabled=False,
        inpaint_only=False,
        target_lang=req.options.target_lang_code,
    )
    return [], output  # Torii doesn't expose bubble metadata.


async def _run_torii_cleaner(
    image_bytes: bytes, req: PipelineRequest, keys: KeyResolver
) -> bytes:
    api_key = keys.for_torii()
    return await torii_provider.call(
        image_bytes,
        api_key=api_key,
        translator="gemini-2.5-flash",
        stroke_disabled=False,
        inpaint_only=True,
        target_lang=req.options.target_lang_code,
    )


async def _run_ichigo(
    image_bytes: bytes, req: PipelineRequest, keys: KeyResolver
) -> list[TextBubble]:
    token = keys.for_ichigo()
    return await ichigo_provider.translate(
        image_bytes,
        token=token,
        target_language_name=req.options.target_language,
        translation_model=req.options.ichigo_model,
    )


async def _run_gemini_ocr(
    image_bytes: bytes,
    plan: Plan,
    keys: KeyResolver,
    source_language: str = "Japanese",
    target_language: str = "Portuguese (Brazil)",
) -> tuple[list[TextBubble], TokenUsage]:
    api_key = keys.for_gemini()
    model = _GEMINI_MODELS[plan.ocr_engine]
    return await gemini_provider.process_manga_page(
        image_bytes,
        model=model,
        api_key=api_key,
        skip_translation=plan.ocr_skip_translation,
        source_language=source_language,
        target_language=target_language,
    )


async def _run_openai_ocr(
    image_bytes: bytes,
    plan: Plan,
    keys: KeyResolver,
    source_language: str = "Japanese",
    target_language: str = "Portuguese (Brazil)",
) -> tuple[list[TextBubble], TokenUsage]:
    api_key = keys.for_openai()
    model = _OPENAI_MODELS[plan.ocr_engine]
    return await openai_provider.process_manga_page(
        image_bytes,
        model=model,
        api_key=api_key,
        skip_translation=plan.ocr_skip_translation,
        source_language=source_language,
        target_language=target_language,
    )


async def _run_translation_step(
    bubbles: list[TextBubble],
    plan: Plan,
    keys: KeyResolver,
    target_language: str = "Portuguese (Brazil)",
) -> tuple[list[TextBubble], TokenUsage | None]:
    engine = plan.translation_engine
    if engine == EngineId.GOOGLE:
        translated = await gt_provider.translate(bubbles)
        return translated, None
    if engine == EngineId.DEEPL:
        translated = await deepl_provider.translate_in_chunks(
            bubbles, api_key=keys.for_deepl()
        )
        return translated, None
    if _is_gemini(engine):
        translated, tokens = await gemini_provider.translate_bubbles(
            bubbles,
            model=_GEMINI_MODELS[engine],
            api_key=keys.for_gemini(),
        )
        return translated, tokens
    if _is_openai(engine):
        translated, tokens = await openai_provider.translate_bubbles(
            bubbles,
            model=_OPENAI_MODELS[engine],
            api_key=keys.for_openai(),
            target_language=target_language,
        )
        return translated, tokens
    raise ProviderError(
        ErrorCode.INVALID_INPUT,
        engine.value,
        f"Engine de traducao '{engine.value}' nao suportada.",
    )


# --- Public entrypoint -------------------------------------------------------


async def run_pipeline(
    req: PipelineRequest, keys: KeyResolver
) -> PipelineResponse:
    image_bytes = base64.b64decode(req.image_base64)
    plan = plan_pipeline(req)

    warnings: list[str] = []
    translated_image_b64: str | None = None
    cleaned_image_b64: str | None = None
    ocr_tokens: TokenUsage | None = None
    translation_tokens: TokenUsage | None = None
    bubbles: list[TextBubble] = []

    # --- Phase: translate-only ---
    # Skip OCR entirely; use the bubbles provided in the request and run
    # only the translation step on them.
    if req.phase == "translate-only":
        bubbles = list(req.bubbles)
        if bubbles:
            bubbles, translation_tokens = await _run_translation_step(
                bubbles, plan, keys, target_language=req.options.target_language
            )
        return PipelineResponse(
            bubbles=bubbles,
            translated_image_base64=None,
            cleaned_image_base64=None,
            tokens=translation_tokens,
            warnings=warnings,
            plan={
                "ocrEngine": plan.ocr_engine.value,
                "translationEngine": plan.translation_engine.value,
                "translationDoneInOcr": False,
                "useToriiFull": False,
                "useToriiCleaner": False,
            },
        )

    # --- Phase: ocr-only ---
    # Force skip_translation regardless of engine combo so we get bubbles
    # with originalText only (translatedText stays empty).
    if req.phase == "ocr-only":
        plan = Plan(
            use_torii_full=plan.use_torii_full,
            use_torii_cleaner=plan.use_torii_cleaner,
            ocr_engine=plan.ocr_engine,
            translation_engine=plan.translation_engine,
            ocr_skip_translation=True,
            translation_done_in_ocr=False,
        )

    # Step 1: OCR (and possibly translation, depending on the plan) plus the
    # optional cleaner — both run concurrently. Cleaner failure is a warning,
    # OCR failure is fatal (B1 fix vs the original Promise.all).
    ocr_task = asyncio.create_task(_run_main_ocr(image_bytes, plan, req, keys))
    cleaner_task: asyncio.Task[bytes] | None = None
    if plan.use_torii_cleaner and not plan.use_torii_full:
        cleaner_task = asyncio.create_task(_run_torii_cleaner(image_bytes, req, keys))

    tasks: list[asyncio.Task] = [ocr_task]
    if cleaner_task is not None:
        tasks.append(cleaner_task)

    results = await asyncio.gather(*tasks, return_exceptions=True)
    ocr_result = results[0]
    if isinstance(ocr_result, Exception):
        raise ocr_result

    bubbles, ocr_tokens, translated_image_b64 = ocr_result

    if cleaner_task is not None:
        cleaner_result = results[1]
        if isinstance(cleaner_result, Exception):
            logger.warning("Cleaner failed (non-fatal): %s", cleaner_result)
            warnings.append(f"Cleaner Torii falhou: {cleaner_result}")
        else:
            cleaned_image_b64 = base64.b64encode(cleaner_result).decode("ascii")

    # Step 2: Standalone translation pass when the OCR engine didn't already
    # translate (e.g. GEMINI_PRO -> DEEPL, or GEMINI_PRO_FULL -> X disabled).
    if plan.needs_separate_translation and bubbles:
        bubbles, translation_tokens = await _run_translation_step(
            bubbles, plan, keys, target_language=req.options.target_language
        )

    return PipelineResponse(
        bubbles=bubbles,
        translated_image_base64=translated_image_b64,
        cleaned_image_base64=cleaned_image_b64,
        tokens=_combine_tokens(ocr_tokens, translation_tokens),
        warnings=warnings,
        plan={
            "ocrEngine": plan.ocr_engine.value,
            "translationEngine": plan.translation_engine.value,
            "translationDoneInOcr": plan.translation_done_in_ocr,
            "useToriiFull": plan.use_torii_full,
            "useToriiCleaner": plan.use_torii_cleaner,
        },
    )


async def _run_main_ocr(
    image_bytes: bytes,
    plan: Plan,
    req: PipelineRequest,
    keys: KeyResolver,
) -> tuple[list[TextBubble], TokenUsage | None, str | None]:
    """Returns (bubbles, ocr_tokens, translated_image_base64)."""
    source_language = req.options.source_language
    target_language = req.options.target_language
    if plan.use_torii_full:
        bubbles, image_bytes_out = await _run_torii_full(image_bytes, req, keys)
        return bubbles, None, base64.b64encode(image_bytes_out).decode("ascii")
    if plan.ocr_engine == EngineId.ICHIGO:
        bubbles = await _run_ichigo(image_bytes, req, keys)
        return bubbles, None, None
    if _is_openai(plan.ocr_engine):
        bubbles, tokens = await _run_openai_ocr(image_bytes, plan, keys, source_language, target_language)
        return bubbles, tokens, None
    bubbles, tokens = await _run_gemini_ocr(image_bytes, plan, keys, source_language, target_language)
    return bubbles, tokens, None


def _combine_tokens(*entries: TokenUsage | None) -> TokenUsage | None:
    real = [e for e in entries if e is not None]
    if not real:
        return None
    if len(real) == 1:
        return real[0]
    return TokenUsage(
        input=sum(e.input for e in real),
        output=sum(e.output for e in real),
        total=sum(e.total for e in real),
        model="+".join(e.model for e in real if e.model),
    )
