"""Ichigo provider: server-to-server (no corsproxy.io).

Replicates ``services/ichigoService.ts`` exactly: same headers, same payload,
same response handling. The only difference is the request goes from this
backend to ichigoreader.com directly, so the proxy that previously could
inspect bearer tokens and image bytes is gone.
"""
from __future__ import annotations

import base64
import io
import logging
import uuid
from typing import Any

import httpx

from ..errors import ErrorCode, ProviderError
from ..schemas.common import BoundingBox, TextBubble

logger = logging.getLogger(__name__)

ICHIGO_API_URL = "https://ichigoreader.com"
CLIENT_VERSION = "1.0.8"

LANGUAGE_CODES: dict[str, str] = {
    "Português (Brasil)": "pt",
    "English": "en",
    "Español": "es",
    "Français": "fr",
    "Italiano": "it",
    "Deutsch": "de",
    "日本語": "ja",
}

# Backend-side identity per process. Frontend used localStorage; backend doesn't
# have that, so we generate a stable UUID per process and a fingerprint that's
# more anonymous than the browser's. This is the smallest behaviour change
# necessary for moving off corsproxy.io.
_CLIENT_UUID = str(uuid.uuid4())
_FINGERPRINT = f"backend-bff-{_CLIENT_UUID[:8]}"


async def login(email: str, password: str) -> str:
    """Exchange Ichigo credentials for a bearer token."""
    url = f"{ICHIGO_API_URL}/auth/login"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Client-Version": CLIENT_VERSION,
    }
    payload = {"email": email, "password": password}

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(url, json=payload, headers=headers)
    except httpx.HTTPError as exc:
        raise ProviderError(
            ErrorCode.NETWORK, "ichigo", f"Falha de rede no login Ichigo: {exc}"
        ) from exc

    if response.status_code in (401, 403):
        raise ProviderError(
            ErrorCode.AUTH, "ichigo", "Credenciais Ichigo inválidas."
        )
    if response.status_code != 200:
        raise ProviderError(
            ErrorCode.UNKNOWN,
            "ichigo",
            f"Erro de Login Ichigo ({response.status_code}).",
        )

    data: dict[str, Any] = response.json()
    token = (data.get("tokens") or {}).get("accessToken") or data.get("accessToken")
    if not token:
        raise ProviderError(
            ErrorCode.UNKNOWN, "ichigo", "Token não retornado pelo servidor Ichigo."
        )
    return token


def _resize_if_needed(image_bytes: bytes, max_dim: int = 1600) -> tuple[bytes, int, int]:
    """Resize the image down so its largest side equals ``max_dim``.

    The resize is mainly to reduce upload payload to Ichigo, which behaves
    badly with very large images. Falls back to the original bytes if Pillow
    is unavailable or the image is already small.
    """
    try:
        from PIL import Image  # type: ignore[import-untyped]
    except ImportError:  # pragma: no cover - Pillow optional
        return image_bytes, 0, 0

    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            img.load()
            width, height = img.size
            if width <= max_dim and height <= max_dim:
                return image_bytes, width, height

            scale = min(max_dim / width, max_dim / height)
            new_size = (round(width * scale), round(height * scale))
            resized = img.convert("RGB").resize(new_size, Image.LANCZOS)
            buf = io.BytesIO()
            resized.save(buf, format="JPEG", quality=80)
            return buf.getvalue(), new_size[0], new_size[1]
    except Exception as exc:  # noqa: BLE001 - resizing is best-effort
        logger.warning("Ichigo image resize failed: %s; sending original", exc)
        return image_bytes, 0, 0


async def translate(
    image_bytes: bytes,
    *,
    token: str,
    target_language_name: str = "Português (Brasil)",
    translation_model: str = "Gemini 3 Pro",
) -> list[TextBubble]:
    """Send the page to Ichigo and convert its response to ``TextBubble``s."""
    target_code = LANGUAGE_CODES.get(target_language_name, "pt")
    resized_bytes, width, height = _resize_if_needed(image_bytes)
    if width == 0 or height == 0:
        # Fallback: if PIL didn't run, we can't normalize boxes. Use raw bytes.
        width, height = 1, 1

    payload = {
        "base64Images": [
            "data:image/jpeg;base64," + base64.b64encode(resized_bytes).decode("ascii")
        ],
        "targetLangCode": target_code,
        "model": translation_model,
        "fingerprint": _FINGERPRINT,
        "clientUuid": _CLIENT_UUID,
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
        "X-Client-Version": CLIENT_VERSION,
        "Accept": "application/json",
    }
    url = f"{ICHIGO_API_URL}/translate"

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, json=payload, headers=headers)
    except httpx.HTTPError as exc:
        raise ProviderError(
            ErrorCode.NETWORK, "ichigo", f"Falha de rede na tradução Ichigo: {exc}"
        ) from exc

    if response.status_code == 429:
        raise ProviderError(
            ErrorCode.RATE_LIMIT,
            "ichigo",
            "Limite do plano Ichigo excedido.",
            recoverable=True,
        )
    if response.status_code in (401, 403):
        raise ProviderError(
            ErrorCode.AUTH,
            "ichigo",
            "Sessão Ichigo expirada ou acesso negado.",
        )
    if response.status_code != 200:
        raise ProviderError(
            ErrorCode.UNKNOWN,
            "ichigo",
            f"Erro na tradução Ichigo ({response.status_code}).",
        )

    data = response.json()
    images = data.get("images") or []
    if not images or not images[0]:
        return []

    result_items = images[0]
    bubbles: list[TextBubble] = []
    for idx, item in enumerate(result_items):
        min_x = item.get("minX", 0)
        min_y = item.get("minY", 0)
        max_x = item.get("maxX", width)
        max_y = item.get("maxY", height)

        bubbles.append(
            TextBubble(
                id=f"ichigo-{idx}-{uuid.uuid4().hex[:8]}",
                original_text=item.get("originalText") or item.get("translatedText") or "...",
                translated_text=item.get("translatedText") or "...",
                box=BoundingBox(
                    ymin=round((min_y / max(height, 1)) * 1000),
                    xmin=round((min_x / max(width, 1)) * 1000),
                    ymax=round((max_y / max(height, 1)) * 1000),
                    xmax=round((max_x / max(width, 1)) * 1000),
                ),
            )
        )
    return bubbles
