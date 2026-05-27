"""FastAPI dependencies: BYOK header extraction and key resolution."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Header

from .config import Settings, get_settings
from .errors import ErrorCode, ProviderError
from .schemas.common import EngineId


@dataclass(frozen=True)
class Byok:
    """Per-request BYOK keys extracted from headers.

    Empty/None means "not provided". The resolver below picks the BYOK key
    when present and falls back to the server-configured key otherwise.
    """

    gemini: str | None = None
    deepl: str | None = None
    torii: str | None = None
    google: str | None = None
    ichigo: str | None = None
    openai: str | None = None


async def get_byok(
    x_byok_gemini: Annotated[str | None, Header()] = None,
    x_byok_deepl: Annotated[str | None, Header()] = None,
    x_byok_torii: Annotated[str | None, Header()] = None,
    x_byok_google: Annotated[str | None, Header()] = None,
    x_byok_ichigo: Annotated[str | None, Header()] = None,
    x_byok_openai: Annotated[str | None, Header()] = None,
) -> Byok:
    return Byok(
        gemini=_clean(x_byok_gemini),
        deepl=_clean(x_byok_deepl),
        torii=_clean(x_byok_torii),
        google=_clean(x_byok_google),
        ichigo=_clean(x_byok_ichigo),
        openai=_clean(x_byok_openai),
    )


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


class KeyResolver:
    """Picks the right credential for an engine: BYOK first, server key second."""

    def __init__(self, settings: Settings, byok: Byok) -> None:
        self._settings = settings
        self._byok = byok

    @property
    def byok(self) -> Byok:
        return self._byok

    def for_gemini(self) -> str:
        return self._require(
            self._byok.gemini or self._settings.gemini_api_key,
            engine="gemini",
            hint="X-Byok-Gemini header or GEMINI_API_KEY env var",
        )

    def for_deepl(self) -> str:
        return self._require(
            self._byok.deepl or self._settings.deepl_api_key,
            engine="deepl",
            hint="X-Byok-Deepl header or DEEPL_API_KEY env var",
        )

    def for_torii(self) -> str:
        return self._require(
            self._byok.torii or self._settings.torii_api_key,
            engine="torii",
            hint="X-Byok-Torii header or TORII_API_KEY env var",
        )

    def for_google(self) -> str | None:
        """Optional — the free GTX endpoint works without a key."""
        return self._byok.google or self._settings.google_api_key or None

    def for_ichigo(self) -> str:
        return self._require(
            self._byok.ichigo,
            engine="ichigo",
            hint="X-Byok-Ichigo header (obtained via POST /api/ichigo/login)",
        )

    def for_openai(self) -> str:
        return self._require(
            self._byok.openai or self._settings.openai_api_key,
            engine="openai",
            hint="X-Byok-Openai header or OPENAI_API_KEY env var",
        )

    @staticmethod
    def _require(value: str | None, *, engine: str, hint: str) -> str:
        if not value:
            raise ProviderError(
                ErrorCode.INVALID_KEY,
                engine=engine,
                message=f"No credential available for {engine}. Provide {hint}.",
                recoverable=False,
            )
        return value


async def get_key_resolver(
    byok: Annotated[Byok, Depends(get_byok)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> KeyResolver:
    return KeyResolver(settings, byok)


# Frontend-facing engine -> provider mapping for documentation. Not used at
# runtime; kept here as the single source of truth for which BYOK header an
# engine consumes.
ENGINE_TO_BYOK: dict[EngineId, str] = {
    EngineId.GEMINI_FLASH: "gemini",
    EngineId.GEMINI_FLASH_FULL: "gemini",
    EngineId.GEMINI_3_FLASH: "gemini",
    EngineId.GEMINI_3_FLASH_FULL: "gemini",
    EngineId.GEMINI_PRO: "gemini",
    EngineId.GEMINI_PRO_FULL: "gemini",
    EngineId.GEMINI_35_FLASH: "gemini",
    EngineId.GEMINI_35_FLASH_FULL: "gemini",
    EngineId.ICHIGO: "ichigo",
    EngineId.TORII: "torii",
    EngineId.DEEPL: "deepl",
    EngineId.GOOGLE: "google",
    EngineId.GPT4O: "openai",
    EngineId.GPT4O_MINI: "openai",
}
