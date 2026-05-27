"""Torii Translate provider.

Torii is unique in the lineup because a single API call performs OCR,
translation, AND in-painting of the original text — the response is the
final rendered image. We expose two modes:

- ``translate``     full pass; returns the translated image as bytes.
- ``inpaint_only``  cleaner mode; returns the page with original text removed,
                     no translation rendered.
"""
from __future__ import annotations

import json

import httpx

from ..errors import ErrorCode, ProviderError

TORII_API_URL = "https://api.toriitranslate.com/api/upload"


async def call(
    image_bytes: bytes,
    *,
    api_key: str,
    translator: str = "gemini-2.5-flash",
    stroke_disabled: bool = False,
    inpaint_only: bool = False,
    target_lang: str = "pt-br",
    file_name: str = "page.jpg",
) -> bytes:
    """Send the page to Torii and return the raw image bytes from the response."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "target_lang": target_lang,
        "translator": translator,
        "font": "wildwords",
        "text_align": "auto",
        "stroke_disabled": str(stroke_disabled).lower(),
        "inpaint_only": str(inpaint_only).lower(),
    }
    files = {"file": (file_name, image_bytes, "image/jpeg")}

    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(TORII_API_URL, headers=headers, files=files)
    except httpx.HTTPError as exc:
        raise ProviderError(
            ErrorCode.NETWORK, "torii", f"Falha de rede no Torii: {exc}"
        ) from exc

    success_header = response.headers.get("success", "").lower()
    if response.status_code in (401, 403):
        raise ProviderError(
            ErrorCode.AUTH, "torii", "Chave Torii inválida ou expirada."
        )
    if response.status_code == 429:
        raise ProviderError(
            ErrorCode.RATE_LIMIT,
            "torii",
            "Limite do Torii atingido.",
            recoverable=True,
        )
    if response.status_code >= 400 or (success_header and success_header != "true"):
        body = response.text
        message: str
        try:
            parsed = json.loads(body)
            message = parsed.get("detail") or parsed.get("error") or body
        except json.JSONDecodeError:
            message = body or response.reason_phrase
        raise ProviderError(
            ErrorCode.UNKNOWN, "torii", f"Erro Torii: {message}"
        )

    return response.content
