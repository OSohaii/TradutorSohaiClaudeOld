"""Backend settings loaded from environment / .env file."""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All configuration values for the BFF.

    Every provider key is optional. If a request reaches an engine and neither
    the server key nor a BYOK header is set, ``deps.resolve_key`` raises a
    ``ProviderError(INVALID_KEY)`` which the exception handler turns into a
    422 response with a clear engine-specific message.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Provider keys (server-managed defaults). Empty string == not configured.
    gemini_api_key: str = ""
    deepl_api_key: str = ""
    torii_api_key: str = ""
    google_api_key: str = ""
    openai_api_key: str = ""

    # Server behavior.
    environment: str = "development"
    cors_origins: str = "http://localhost:5173"
    max_image_bytes: int = 15 * 1024 * 1024  # 15 MB decoded

    # Server-side caching (Fase 4 - performance).
    #
    # Two independent caches reduce paid provider calls when iterating on the
    # same content:
    #   * OCR cache: in-memory LRU keyed by (image_sha256, ocr_engine,
    #     source_language [, target_language if the engine also translates]).
    #     Empty after server restart, which is intentional - it covers a
    #     single editing session, not long-term storage.
    #   * Translation cache: SQLite-backed (single-file DB). Persists across
    #     restarts so repeated source phrases (onomatopoeias, short replies,
    #     etc.) translate exactly once forever.
    #
    # Set cache_enabled=False to bypass both caches (used by the test suite
    # to keep behaviour deterministic without coordinated teardown).
    cache_enabled: bool = True
    cache_ocr_max_entries: int = 100
    cache_db_path: str = "cache.db"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_dev(self) -> bool:
        return self.environment.lower() in {"dev", "development", "local"}


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
