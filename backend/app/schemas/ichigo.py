"""Schemas for the Ichigo login flow."""
from __future__ import annotations

from .common import CamelModel


class IchigoLoginRequest(CamelModel):
    email: str
    password: str


class IchigoLoginResponse(CamelModel):
    access_token: str
