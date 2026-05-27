"""Standalone translation endpoint (no OCR step)."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from ..deps import KeyResolver, get_key_resolver
from ..errors import ErrorCode, ProviderError
from ..providers import deepl as deepl_provider
from ..providers import gemini as gemini_provider
from ..providers import google_translate as gt_provider
from ..schemas.common import EngineId
from ..schemas.translate import TranslateRequest, TranslateResponse
from ..services.pipeline import _GEMINI_MODELS, _is_gemini

router = APIRouter()


@router.post("/translate", response_model=TranslateResponse)
async def translate(
    req: TranslateRequest,
    keys: Annotated[KeyResolver, Depends(get_key_resolver)],
) -> TranslateResponse:
    if not req.bubbles:
        return TranslateResponse(bubbles=[])

    engine = req.engine
    if engine == EngineId.GOOGLE:
        return TranslateResponse(bubbles=await gt_provider.translate(req.bubbles))
    if engine == EngineId.DEEPL:
        bubbles = await deepl_provider.translate_in_chunks(
            req.bubbles, api_key=keys.for_deepl()
        )
        return TranslateResponse(bubbles=bubbles)
    if _is_gemini(engine):
        bubbles, tokens = await gemini_provider.translate_bubbles(
            req.bubbles,
            model=_GEMINI_MODELS[engine],
            api_key=keys.for_gemini(),
        )
        return TranslateResponse(bubbles=bubbles, tokens=tokens)

    raise ProviderError(
        ErrorCode.INVALID_INPUT,
        engine.value,
        f"Engine '{engine.value}' não suporta tradução de balões pré-extraídos.",
    )
