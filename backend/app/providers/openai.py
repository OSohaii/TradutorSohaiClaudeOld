"""OpenAI provider: OCR (vision) + translation via chat completions.

Uses GPT-4o and GPT-4o-mini models. The OCR function uses the vision
capability to read manga pages; the translation function uses regular
chat completions. Follows the same retry-with-backoff pattern as gemini.py.
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import re
import uuid
from typing import Any

import httpx

from ..errors import ErrorCode, ProviderError
from ..schemas.common import BoundingBox, TextBubble, TokenUsage

logger = logging.getLogger(__name__)

_API_URL = "https://api.openai.com/v1/chat/completions"

_RETRY_CODES = {429, 529}
_RETRY_SUBSTRINGS = ("429", "rate_limit", "quota", "Too Many Requests")


async def _retry_with_backoff(op, *, max_retries: int = 3, base_delay: float = 2.0):
    last: Exception | None = None
    for attempt in range(max_retries):
        try:
            return await op()
        except Exception as exc:  # noqa: BLE001
            last = exc
            msg = str(exc)
            status = getattr(exc, "status_code", None) or getattr(exc, "status", None)
            is_rate_limit = status in _RETRY_CODES or any(
                token in msg for token in _RETRY_SUBSTRINGS
            )
            if is_rate_limit and attempt < max_retries - 1:
                delay = base_delay * (2**attempt)
                logger.warning("OpenAI rate-limit, retrying in %.1fs", delay)
                await asyncio.sleep(delay)
                continue
            raise
    assert last is not None
    raise last


def _classify_error(exc: Exception) -> ProviderError:
    msg = str(exc)
    status = getattr(exc, "status_code", None) or getattr(exc, "status", None)
    if status in (401, 403) or "invalid_api_key" in msg or "Incorrect API key" in msg:
        return ProviderError(
            ErrorCode.AUTH,
            "openai",
            "Chave OpenAI invalida ou sem acesso ao modelo solicitado.",
        )
    if status == 429 or any(s in msg for s in _RETRY_SUBSTRINGS):
        return ProviderError(
            ErrorCode.RATE_LIMIT,
            "openai",
            "Limite de uso do OpenAI atingido. Tente novamente em alguns instantes.",
            recoverable=True,
        )
    return ProviderError(ErrorCode.UNKNOWN, "openai", f"Falha OpenAI: {msg}")


def _system_instruction(source_language: str) -> str:
    return f"""You are an expert Manga Translator and Localizer specialized in Brazilian Portuguese (PT-BR), with a focus on Fantasy, RPG, and Action genres (Isekai/Shonen).

Source language: {source_language}

1. OCR & Reading Direction (Critical):
- Vertical Text (Tategaki): Read top-to-bottom, right-to-left. Merge characters into coherent sentences.
- Horizontal Text: Read left-to-right.
- Furigana: Ignore ruby text; extract only the main Kanji/Kana.

2. SFX & Onomatopoeia:
- Identify handwritten sound effects.
- Output Format: [SFX: Som/Significado] (e.g., [SFX: Estrondo]).

3. Translation & Localization Strategy:
- Target Audience: Brazilian fans of Shonen/Seinen manga.
- Tone: Natural, conversational, and culturally adapted.

4. Honorifics Policy ({source_language} Source):
- STRICTLY PRESERVE: -san, -sama, -kun, -chan, Senpai, Sensei, Kohai.

5. INTELLIGENT TERMINOLOGY DETECTION (the "Cool Factor" Rule):
- Combat Moves/Attacks, Magic Spells & Skills, Fantasy Titles & Ranks and System
  Notifications must be PRESERVED in English. Translate the surrounding sentence,
  not the term itself.

Your output must be strict JSON following the schema provided."""


def _ocr_prompt(skip_translation: bool, source_language: str, target_language: str = "Portuguese (Brazil)") -> str:
    if skip_translation:
        return (
            f"Analyze this manga page. The source language is {source_language}.\n"
            "1. Visual Detection: Identify all text regions (bubbles, narration, "
            "floating text, SFX).\n"
            "2. Extraction ONLY: Extract the text exactly as shown. DO NOT TRANSLATE. "
            "Copy the extracted text into the 'translatedText' field as well.\n"
            "3. Bounding Boxes: Provide [ymin, xmin, ymax, xmax] coordinates "
            "(0-1000 scale).\n\n"
            "Respond with JSON: {\"bubbles\": [{\"originalText\": \"...\", \"translatedText\": \"...\", \"box_2d\": [ymin, xmin, ymax, xmax]}]}"
        )
    return (
        f"Analyze this manga page for translation. The source language is {source_language}.\n"
        "1. Visual Detection: Identify all text regions (bubbles, narration, SFX).\n"
        "2. Extraction & Translation: Extract the text exactly and translate it to "
        f"{target_language} following the System Instructions.\n"
        "3. Fantasy Terminology: keep Skill names / Attack shouts / Fantasy "
        "Titles / Ranks in English.\n"
        "4. Bounding Boxes: Provide [ymin, xmin, ymax, xmax] coordinates "
        "(0-1000 scale).\n\n"
        "Respond with JSON: {\"bubbles\": [{\"originalText\": \"...\", \"translatedText\": \"...\", \"box_2d\": [ymin, xmin, ymax, xmax]}]}"
    )


def _bubble_from_raw(raw: dict, index: int) -> TextBubble | None:
    box = raw.get("box_2d")
    if not box or len(box) != 4:
        return None
    ymin, xmin, ymax, xmax = box
    if xmax <= xmin or ymax <= ymin or (xmax - xmin) <= 5 or (ymax - ymin) <= 5:
        return None

    display = raw.get("translatedText") or ""
    bubble_type = "dialogue"
    if display and re.match(r"^\[?SFX:", display, flags=re.IGNORECASE):
        bubble_type = "sfx"
        display = re.sub(r"^\[?SFX:\s*", "", display, flags=re.IGNORECASE).rstrip("]").strip()

    # Use uuid for collision-free IDs across parallel pipeline calls.
    # Previously used asyncio.get_event_loop().time() * 1000 which could
    # produce duplicate IDs when multiple OCR requests completed in the
    # same millisecond (common in batch translation), causing React key
    # collisions and cross-image state bleed in the frontend.
    return TextBubble(
        id=f"bubble-{index}-{uuid.uuid4().hex[:8]}",
        original_text=raw.get("originalText", ""),
        translated_text=display,
        type=bubble_type,
        box=BoundingBox(ymin=ymin, xmin=xmin, ymax=ymax, xmax=xmax),
    )


async def process_manga_page(
    image_bytes: bytes,
    *,
    model: str,
    api_key: str,
    skip_translation: bool,
    source_language: str = "Japanese",
    target_language: str = "Portuguese (Brazil)",
) -> tuple[list[TextBubble], TokenUsage]:
    """Run a single OCR (or OCR+translate) pass over an image using OpenAI vision."""
    image_b64 = base64.b64encode(image_bytes).decode("ascii")

    messages = [
        {
            "role": "system",
            "content": _system_instruction(source_language),
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{image_b64}",
                        "detail": "high",
                    },
                },
                {
                    "type": "text",
                    "text": _ocr_prompt(skip_translation, source_language, target_language),
                },
            ],
        },
    ]

    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": 4096,
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        async def _call():
            resp = await client.post(
                _API_URL,
                json=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
            if resp.status_code != 200:
                error_body = resp.text
                exc = Exception(f"OpenAI API error {resp.status_code}: {error_body}")
                exc.status_code = resp.status_code  # type: ignore[attr-defined]
                raise exc
            return resp.json()

        try:
            data = await _retry_with_backoff(_call)
        except Exception as exc:
            raise _classify_error(exc) from exc

    # Extract response text
    text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    if not text:
        raise ProviderError(ErrorCode.UNKNOWN, "openai", "Resposta vazia do OpenAI.")

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ProviderError(
            ErrorCode.UNKNOWN, "openai", f"JSON invalido do OpenAI: {exc}"
        ) from exc

    bubbles_raw = parsed.get("bubbles") or []
    bubbles: list[TextBubble] = []
    for i, raw in enumerate(bubbles_raw):
        bubble = _bubble_from_raw(raw, i)
        if bubble is not None:
            bubbles.append(bubble)

    tokens = _extract_tokens(data, model)
    return bubbles, tokens


async def translate_bubbles(
    bubbles: list[TextBubble],
    *,
    model: str,
    api_key: str,
    target_language: str = "Portuguese (Brazil)",
) -> tuple[list[TextBubble], TokenUsage]:
    """Translate already-extracted bubbles using OpenAI chat completions."""
    if not bubbles:
        return [], TokenUsage(model=model)

    lines = "\n".join(
        f"Line {i}: {b.original_text or b.translated_text}" for i, b in enumerate(bubbles)
    )

    prompt = f"""Translate the following manga text lines to {target_language}.

STRICT RULES:
1. Style: Informal, natural Brazilian Portuguese appropriate for manga/comics.
2. Honorifics: Preserve Japanese honorifics (San, Sama, Kun, Chan, Sensei, Senpai).
3. Slang: Localize English/American slang (e.g. "dude" -> "cara").
4. FANTASY & RPG TERMINOLOGY: keep Skill / Attack / Rank / Title proper nouns
   IN ENGLISH. Translate the sentence around them, not the term itself.
5. Return exactly one translation per line in the JSON array, in the same order.

Input:
{lines}

Respond with JSON: {{"translations": ["translated line 1", "translated line 2", ...]}}"""

    messages = [
        {
            "role": "system",
            "content": "You are a professional manga translator. Follow the Fantasy/RPG terminology rules strictly.",
        },
        {"role": "user", "content": prompt},
    ]

    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": 4096,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        async def _call():
            resp = await client.post(
                _API_URL,
                json=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
            if resp.status_code != 200:
                error_body = resp.text
                exc = Exception(f"OpenAI API error {resp.status_code}: {error_body}")
                exc.status_code = resp.status_code  # type: ignore[attr-defined]
                raise exc
            return resp.json()

        try:
            data = await _retry_with_backoff(_call)
        except Exception as exc:
            raise _classify_error(exc) from exc

    text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    if not text:
        raise ProviderError(
            ErrorCode.UNKNOWN, "openai", "Resposta vazia da traducao OpenAI."
        )

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ProviderError(
            ErrorCode.UNKNOWN, "openai", f"JSON invalido na traducao: {exc}"
        ) from exc

    translations = parsed.get("translations") or []
    if len(translations) != len(bubbles):
        logger.warning(
            "OpenAI translation length mismatch (got %d, expected %d); keeping originals",
            len(translations),
            len(bubbles),
        )
        return list(bubbles), _extract_tokens(data, model)

    out: list[TextBubble] = []
    for bubble, translated in zip(bubbles, translations, strict=True):
        display = translated or ""
        bubble_type = bubble.type
        if display and re.match(r"^\[?SFX:", display, flags=re.IGNORECASE):
            bubble_type = "sfx"
            display = re.sub(r"^\[?SFX:\s*", "", display, flags=re.IGNORECASE).rstrip("]").strip()
        out.append(bubble.model_copy(update={"translated_text": display, "type": bubble_type}))

    return out, _extract_tokens(data, model)


def _extract_tokens(data: dict[str, Any], model: str) -> TokenUsage:
    usage = data.get("usage")
    if not usage:
        return TokenUsage(model=model)
    return TokenUsage(
        input=usage.get("prompt_tokens", 0),
        output=usage.get("completion_tokens", 0),
        total=usage.get("total_tokens", 0),
        model=model,
    )
