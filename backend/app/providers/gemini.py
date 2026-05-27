"""Gemini provider: OCR+translate (full pass) and translate-only.

Mirrors the behaviour of the original ``services/geminiService.ts`` but runs
server-side using the Python ``google-genai`` SDK so the API key never reaches
the browser.
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import re
from typing import Any

from google import genai
from google.genai import types as gtypes

from ..errors import ErrorCode, ProviderError
from ..schemas.common import BoundingBox, TextBubble, TokenUsage

logger = logging.getLogger(__name__)


# Schema for OCR + (optional) translation pass.
_BUBBLE_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "bubbles": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "originalText": {"type": "STRING"},
                    "translatedText": {"type": "STRING"},
                    "box_2d": {
                        "type": "ARRAY",
                        "items": {"type": "INTEGER"},
                    },
                },
                "required": ["originalText", "translatedText", "box_2d"],
            },
        }
    },
    "required": ["bubbles"],
}


# Schema for the standalone re-translation pass.
_TRANSLATIONS_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "translations": {
            "type": "ARRAY",
            "items": {"type": "STRING"},
        }
    },
    "required": ["translations"],
}


_SYSTEM_INSTRUCTION = """You are an expert Manga Translator and Localizer specialized in Brazilian Portuguese (PT-BR), with a focus on Fantasy, RPG, and Action genres (Isekai/Shonen).

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
- English Source: localize Brazilian Portuguese equivalents.

4. Honorifics Policy (Japanese Source):
- STRICTLY PRESERVE: -san, -sama, -kun, -chan, Senpai, Sensei, Kohai.

5. INTELLIGENT TERMINOLOGY DETECTION (the "Cool Factor" Rule):
- Combat Moves/Attacks, Magic Spells & Skills, Fantasy Titles & Ranks and System
  Notifications must be PRESERVED in English. Translate the surrounding sentence,
  not the term itself. Examples to keep: "Fireball", "Demon Lord", "Rank S",
  "Level Up", "Quest Clear".

Your output must be strict JSON following the provided schema."""


def _ocr_prompt(skip_translation: bool, source_language: str = "Japanese", target_language: str = "Portuguese (Brazil)") -> str:
    if skip_translation:
        return (
            f"Analyze this manga page. The source language is {source_language}.\n"
            "1. Visual Detection: Identify all text regions (bubbles, narration, "
            "floating text, SFX).\n"
            "2. Extraction ONLY: Extract the text exactly as shown. DO NOT TRANSLATE. "
            "Copy the extracted text into the 'translatedText' field as well.\n"
            "3. Bounding Boxes: Provide [ymin, xmin, ymax, xmax] coordinates "
            "(0-1000 scale)."
        )
    return (
        f"Analyze this manga page for translation. The source language is {source_language}.\n"
        "1. Visual Detection: Identify all text regions (bubbles, narration, SFX).\n"
        "2. Extraction & Translation: Extract the text exactly and translate it to "
        f"{target_language} following the System Instructions.\n"
        "3. Fantasy Terminology: keep Skill names / Attack shouts / Fantasy "
        "Titles / Ranks in English.\n"
        "4. Bounding Boxes: Provide [ymin, xmin, ymax, xmax] coordinates "
        "(0-1000 scale)."
    )


_RETRY_CODES = {429}
_RETRY_SUBSTRINGS = ("429", "quota", "RESOURCE_EXHAUSTED")


async def _retry_with_backoff(op, *, max_retries: int = 3, base_delay: float = 2.0):
    last: Exception | None = None
    for attempt in range(max_retries):
        try:
            return await op()
        except Exception as exc:  # noqa: BLE001 - intentional broad retry
            last = exc
            msg = str(exc)
            status = getattr(exc, "status", None) or getattr(exc, "code", None)
            is_rate_limit = status in _RETRY_CODES or any(
                token in msg for token in _RETRY_SUBSTRINGS
            )
            if is_rate_limit and attempt < max_retries - 1:
                delay = base_delay * (2**attempt)
                logger.warning("Gemini 429, retrying in %.1fs", delay)
                await asyncio.sleep(delay)
                continue
            raise
    assert last is not None  # pragma: no cover
    raise last


def _classify_error(exc: Exception) -> ProviderError:
    msg = str(exc)
    status = getattr(exc, "status", None) or getattr(exc, "code", None)
    if status in (401, 403) or "API key not valid" in msg or "PERMISSION_DENIED" in msg:
        return ProviderError(
            ErrorCode.AUTH, "gemini",
            "Chave Gemini inválida ou sem acesso ao modelo solicitado.",
        )
    if status == 429 or any(s in msg for s in _RETRY_SUBSTRINGS):
        return ProviderError(
            ErrorCode.RATE_LIMIT, "gemini",
            "Limite de uso do Gemini atingido. Tente novamente em alguns instantes.",
            recoverable=True,
        )
    return ProviderError(ErrorCode.UNKNOWN, "gemini", f"Falha Gemini: {msg}")


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

    return TextBubble(
        id=f"bubble-{index}-{int(asyncio.get_event_loop().time() * 1000)}",
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
    """Run a single OCR (or OCR+translate) pass over an image."""
    client = genai.Client(api_key=api_key)
    image_b64 = base64.b64encode(image_bytes).decode("ascii")

    async def _call():
        return await asyncio.to_thread(
            client.models.generate_content,
            model=model,
            contents=[
                gtypes.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
                _ocr_prompt(skip_translation, source_language, target_language),
            ],
            config=gtypes.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=_BUBBLE_SCHEMA,
                system_instruction=_SYSTEM_INSTRUCTION,
            ),
        )

    try:
        response = await _retry_with_backoff(_call)
    except Exception as exc:  # noqa: BLE001
        raise _classify_error(exc) from exc

    text = getattr(response, "text", None)
    if not text:
        raise ProviderError(ErrorCode.UNKNOWN, "gemini", "Resposta vazia do Gemini.")

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ProviderError(
            ErrorCode.UNKNOWN, "gemini", f"JSON inválido do Gemini: {exc}"
        ) from exc

    bubbles_raw = parsed.get("bubbles") or []
    bubbles: list[TextBubble] = []
    for i, raw in enumerate(bubbles_raw):
        bubble = _bubble_from_raw(raw, i)
        if bubble is not None:
            bubbles.append(bubble)

    tokens = _extract_tokens(response, model)
    # Silence the unused import warning when image_b64 isn't needed in this path.
    _ = image_b64
    return bubbles, tokens


async def translate_bubbles(
    bubbles: list[TextBubble],
    *,
    model: str,
    api_key: str,
) -> tuple[list[TextBubble], TokenUsage]:
    if not bubbles:
        return [], TokenUsage(model=model)

    client = genai.Client(api_key=api_key)
    lines = "\n".join(
        f"Line {i}: {b.original_text or b.translated_text}" for i, b in enumerate(bubbles)
    )

    prompt = f"""Translate the following manga text lines to Portuguese (Brazil).

STRICT RULES:
1. Style: Informal, natural Brazilian Portuguese appropriate for manga/comics.
2. Honorifics: Preserve Japanese honorifics (San, Sama, Kun, Chan, Sensei, Senpai).
3. Slang: Localize English/American slang (e.g. "dude" -> "cara").
4. FANTASY & RPG TERMINOLOGY: keep Skill / Attack / Rank / Title proper nouns
   IN ENGLISH. Translate the sentence around them, not the term itself.
   Ex: "Use Fireball now!" -> "Use Fireball agora!" (NOT "Bola de Fogo agora!").
5. Return exactly one translation per line in the JSON array, in the same order.

Input:
{lines}"""

    async def _call():
        return await asyncio.to_thread(
            client.models.generate_content,
            model=model,
            contents=[prompt],
            config=gtypes.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=_TRANSLATIONS_SCHEMA,
                system_instruction=(
                    "You are a professional manga translator. "
                    "Follow the Fantasy/RPG terminology rules strictly."
                ),
            ),
        )

    try:
        response = await _retry_with_backoff(_call)
    except Exception as exc:  # noqa: BLE001
        raise _classify_error(exc) from exc

    text = getattr(response, "text", None)
    if not text:
        raise ProviderError(
            ErrorCode.UNKNOWN, "gemini", "Resposta vazia da tradução Gemini."
        )

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ProviderError(
            ErrorCode.UNKNOWN, "gemini", f"JSON inválido na tradução: {exc}"
        ) from exc

    translations = parsed.get("translations") or []
    if len(translations) != len(bubbles):
        logger.warning(
            "Gemini translation length mismatch (got %d, expected %d); keeping originals",
            len(translations),
            len(bubbles),
        )
        return list(bubbles), _extract_tokens(response, model)

    out: list[TextBubble] = []
    for bubble, translated in zip(bubbles, translations, strict=True):
        display = translated or ""
        bubble_type = bubble.type
        if display and re.match(r"^\[?SFX:", display, flags=re.IGNORECASE):
            bubble_type = "sfx"
            display = re.sub(r"^\[?SFX:\s*", "", display, flags=re.IGNORECASE).rstrip("]").strip()
        out.append(bubble.model_copy(update={"translated_text": display, "type": bubble_type}))

    return out, _extract_tokens(response, model)


def _extract_tokens(response: Any, model: str) -> TokenUsage:
    meta = getattr(response, "usage_metadata", None)
    if meta is None:
        return TokenUsage(model=model)
    return TokenUsage(
        input=getattr(meta, "prompt_token_count", 0) or 0,
        output=getattr(meta, "candidates_token_count", 0) or 0,
        total=getattr(meta, "total_token_count", 0) or 0,
        model=model,
    )
