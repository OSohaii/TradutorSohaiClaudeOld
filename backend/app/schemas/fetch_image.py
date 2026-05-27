"""Schemas for the /fetch-image endpoint."""
from __future__ import annotations

from pydantic import BaseModel


class FetchImageRequest(BaseModel):
    url: str


class FetchImageResponse(BaseModel):
    base64: str
    content_type: str
    filename: str
