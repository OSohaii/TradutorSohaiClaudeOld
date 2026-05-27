"""Google Translate provider via the public 'gtx' endpoint.

This endpoint requires no API key and was the one previously called from the
browser through corsproxy.io. Now we call it server-to-server.
"""
from __future__ import annotations

import asyncio
import logging

import httpx

from ..errors import ErrorCode, ProviderError
from ..schemas.common import TextBubble

logger = logging.getLogger(__name__)


async def _translate_one(
    client: httpx.AsyncClient, bubble: TextBubble, *, target: str
) -> TextBubble:
    text = (bubble.original_text or "").strip()
    if not text:
        return bubble
    url = "https://translate.googleapis.com/translate_a/single"
    params = {
        "client": "gtx",
        "sl": "auto",
        "tl": target,
        "dt": "t",
        "q": text,
    }
    try:
        response = await client.get(url, params=params, timeout=30.0)
    except httpx.HTTPError as exc:
        logger.warning("google_translate failed for bubble %s: %s", bubble.id, exc)
        return bubble

    if response.status_code != 200:
        logger.warning(
            "google_translate non-200 for bubble %s: %s",
            bubble.id,
            response.status_code,
        )
        return bubble

    try:
        data = response.json()
        if data and data[0]:
            translated = "".join(seg[0] for seg in data[0] if seg and seg[0])
            return bubble.model_copy(update={"translated_text": translated})
    except (ValueError, IndexError, TypeError) as exc:
        logger.warning("google_translate parse error for bubble %s: %s", bubble.id, exc)
    return bubble


async def translate(
    bubbles: list[TextBubble],
    *,
    target: str = "pt",
) -> list[TextBubble]:
    if not bubbles:
        return []
    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(
            *(_translate_one(client, b, target=target) for b in bubbles),
            return_exceptions=True,
        )
    out: list[TextBubble] = []
    for original, result in zip(bubbles, results, strict=True):
        if isinstance(result, Exception):
            logger.warning("google_translate task failed: %s", result)
            out.append(original)
        else:
            out.append(result)
    # Surface a clear error only if every single call failed (network down).
    if all(isinstance(r, Exception) for r in results):
        raise ProviderError(
            ErrorCode.NETWORK,
            "google",
            "Nenhuma tradução do Google Translate foi bem-sucedida.",
        )
    return out
