"""Shared test fixtures.

These tests are intentionally hermetic: they never hit the network, and they
work without any provider credentials. Provider modules are exercised with
monkeypatched httpx and google-genai calls in the smoke tests.
"""
from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

# Make sure tests run with a clean, predictable config regardless of the
# developer's local .env file.
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")
os.environ.setdefault("GEMINI_API_KEY", "")
os.environ.setdefault("DEEPL_API_KEY", "")
os.environ.setdefault("TORII_API_KEY", "")


@pytest.fixture
def client() -> TestClient:
    from app.main import app
    return TestClient(app)
