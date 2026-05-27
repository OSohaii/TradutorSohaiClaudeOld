"""BYOK header propagation tests.

These don't make real network calls — we patch each provider entry point and
assert that the resolver picked the right credential.
"""
from __future__ import annotations

import pytest

from app.config import Settings
from app.deps import Byok, KeyResolver
from app.errors import ProviderError


def test_byok_overrides_server_key():
    settings = Settings(gemini_api_key="server-key")
    resolver = KeyResolver(settings, Byok(gemini="user-key"))
    assert resolver.for_gemini() == "user-key"


def test_falls_back_to_server_key_when_no_byok():
    settings = Settings(gemini_api_key="server-key")
    resolver = KeyResolver(settings, Byok())
    assert resolver.for_gemini() == "server-key"


def test_raises_provider_error_when_neither_key_set():
    settings = Settings()
    resolver = KeyResolver(settings, Byok())
    with pytest.raises(ProviderError) as exc_info:
        resolver.for_deepl()
    assert exc_info.value.code.value == "INVALID_KEY"
    assert exc_info.value.engine == "deepl"


def test_google_key_optional():
    """The free GTX endpoint works without a key — resolver returns None."""
    settings = Settings()
    resolver = KeyResolver(settings, Byok())
    assert resolver.for_google() is None


def test_ichigo_requires_byok_token():
    settings = Settings()
    resolver = KeyResolver(settings, Byok())
    with pytest.raises(ProviderError) as exc_info:
        resolver.for_ichigo()
    assert exc_info.value.engine == "ichigo"
