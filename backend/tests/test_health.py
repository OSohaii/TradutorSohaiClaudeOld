"""Smoke test for the liveness endpoint."""
from __future__ import annotations


def test_health_returns_ok(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert "providers" in body
    # No keys are configured in tests; every provider flag should be False.
    assert body["providers"] == {
        "gemini": False,
        "deepl": False,
        "torii": False,
        "google": False,
        "ichigo": False,
    }
