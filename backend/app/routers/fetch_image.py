"""Proxy endpoint that downloads an image server-side to avoid CORS."""
from __future__ import annotations

import base64
import ipaddress
import logging
import socket
import time
from urllib.parse import unquote, urlparse

import httpx
from fastapi import APIRouter, HTTPException

from ..schemas.fetch_image import FetchImageRequest, FetchImageResponse

logger = logging.getLogger(__name__)

router = APIRouter()

# Generous but bounded limits
_TIMEOUT = 20.0
_MAX_SIZE = 20 * 1024 * 1024  # 20 MB


def _is_private_url(url: str) -> bool:
    """Check if URL points to a private/internal network address."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return True
    hostname = parsed.hostname
    if not hostname:
        return True
    try:
        infos = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC)
        for info in infos:
            addr = info[4][0]
            ip = ipaddress.ip_address(addr)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                return True
    except (socket.gaierror, ValueError):
        return True
    return False


def _derive_filename(url: str, content_type: str) -> str:
    """Best-effort filename from URL path; falls back to timestamp-based."""
    path = urlparse(url).path
    name = unquote(path.rstrip("/").split("/")[-1]) if path else ""
    # Validate it looks like a file name
    if name and "." in name and len(name) < 200:
        return name
    ext_map = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
    }
    ext = ext_map.get(content_type, "jpg")
    return f"image_{int(time.time())}.{ext}"


@router.post("/fetch-image", response_model=FetchImageResponse)
async def fetch_image(req: FetchImageRequest) -> FetchImageResponse:
    """Download an image from a URL and return it as base64."""
    if _is_private_url(req.url):
        raise HTTPException(
            status_code=400,
            detail="URL bloqueada: enderecos internos nao sao permitidos.",
        )

    try:
        async with httpx.AsyncClient(
            timeout=_TIMEOUT,
            follow_redirects=True,
            headers={"User-Agent": "MangaLens/1.0"},
        ) as client:
            resp = await client.get(req.url)
            resp.raise_for_status()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Timeout ao baixar imagem.")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Servidor remoto retornou {exc.response.status_code}.",
        )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Erro de rede: {exc!s}")

    content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()
    if not content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"URL nao retornou uma imagem (content-type: {content_type}).",
        )

    if len(resp.content) > _MAX_SIZE:
        raise HTTPException(status_code=400, detail="Imagem excede 20 MB.")

    encoded = base64.b64encode(resp.content).decode("ascii")
    filename = _derive_filename(req.url, content_type)

    return FetchImageResponse(base64=encoded, content_type=content_type, filename=filename)
