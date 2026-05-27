"""Unified OCR + translation + cleaner pipeline."""
from __future__ import annotations

import base64
from typing import Annotated

from fastapi import APIRouter, Depends

from ..config import Settings, get_settings
from ..deps import KeyResolver, get_key_resolver
from ..errors import ErrorCode, ProviderError
from ..schemas.pipeline import PipelineRequest, PipelineResponse
from ..services import pipeline as pipeline_service

router = APIRouter()


def _validate_image_size(image_base64: str, max_bytes: int) -> None:
    # base64 length is ~ 4/3 * binary length; quick reject to avoid full decode
    estimated_bytes = (len(image_base64) * 3) // 4
    if estimated_bytes > max_bytes:
        raise ProviderError(
            ErrorCode.INVALID_INPUT,
            engine="pipeline",
            message=(
                f"Imagem muito grande: ~{estimated_bytes // 1024} KB > "
                f"{max_bytes // 1024} KB."
            ),
        )
    try:
        # Validate that it's actually base64-decodable.
        base64.b64decode(image_base64, validate=True)
    except Exception as exc:  # noqa: BLE001
        raise ProviderError(
            ErrorCode.INVALID_INPUT,
            engine="pipeline",
            message=f"imageBase64 não é base64 válido: {exc}",
        ) from exc


@router.post("/pipeline", response_model=PipelineResponse)
async def run_pipeline(
    req: PipelineRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    keys: Annotated[KeyResolver, Depends(get_key_resolver)],
) -> PipelineResponse:
    _validate_image_size(req.image_base64, settings.max_image_bytes)
    return await pipeline_service.run_pipeline(req, keys)
