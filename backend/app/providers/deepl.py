"""DeepL translation provider."""
from __future__ import annotations

import asyncio
from typing import Any

import httpx

from ..errors import ErrorCode, ProviderError
from ..schemas.common import TextBubble


async def translate(
    bubbles: list[TextBubble],
    *,
    api_key: str,
    target_lang: str = "PT-BR",
) -> list[TextBubble]:
    if not bubbles:
        return []

    api_domain = "api-free.deepl.com" if api_key.endswith(":fx") else "api.deepl.com"
    url = f"https://{api_domain}/v2/translate"

    data: list[tuple[str, str]] = [("text", b.original_text or " ") for b in bubbles]
    data.append(("target_lang", target_lang))

    headers = {
        "Authorization": f"DeepL-Auth-Key {api_key}",
        "Content-Type": "application/x-www-form-urlencoded",
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, data=data, headers=headers)
    except httpx.HTTPError as exc:
        raise ProviderError(
            ErrorCode.NETWORK, "deepl", f"Falha de rede no DeepL: {exc}"
        ) from exc

    if response.status_code in (401, 403):
        raise ProviderError(
            ErrorCode.AUTH, "deepl", "Chave DeepL inválida."
        )
    if response.status_code == 429 or response.status_code == 456:
        raise ProviderError(
            ErrorCode.QUOTA,
            "deepl",
            "Cota do DeepL atingida.",
            recoverable=True,
        )
    if response.status_code != 200:
        raise ProviderError(
            ErrorCode.UNKNOWN,
            "deepl",
            f"Erro DeepL ({response.status_code}): {response.text}",
        )

    payload: dict[str, Any] = response.json()
    translations = payload.get("translations")
    if not translations or len(translations) != len(bubbles):
        raise ProviderError(
            ErrorCode.UNKNOWN, "deepl", "Resposta inválida do DeepL."
        )

    return [
        bubble.model_copy(update={"translated_text": item["text"]})
        for bubble, item in zip(bubbles, translations, strict=True)
    ]


async def translate_in_chunks(
    bubbles: list[TextBubble],
    *,
    api_key: str,
    chunk_size: int = 50,
    target_lang: str = "PT-BR",
) -> list[TextBubble]:
    """Convenience wrapper for very large pages."""
    if len(bubbles) <= chunk_size:
        return await translate(bubbles, api_key=api_key, target_lang=target_lang)

    chunks = [bubbles[i : i + chunk_size] for i in range(0, len(bubbles), chunk_size)]
    results = await asyncio.gather(
        *(translate(c, api_key=api_key, target_lang=target_lang) for c in chunks)
    )
    out: list[TextBubble] = []
    for chunk in results:
        out.extend(chunk)
    return out
