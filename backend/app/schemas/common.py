"""Domain primitives shared across requests and responses.

All schemas use camelCase on the wire so the frontend types map 1:1 with
``types.ts`` without translation. Inside Python we keep snake_case via
pydantic's alias generator.
"""
from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base model: snake_case in Python, camelCase on the wire."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="ignore",
    )


class EngineId(str, Enum):
    """Engine identifiers as the frontend already names them.

    These values match the ``EngineType`` union in ``App.tsx`` so existing
    UI selections keep working unchanged. The orchestrator maps each one to
    a (model, mode) pair internally.
    """

    GEMINI_FLASH = "GEMINI_FLASH"
    GEMINI_FLASH_FULL = "GEMINI_FLASH_FULL"
    GEMINI_3_FLASH = "GEMINI_3_FLASH"
    GEMINI_3_FLASH_FULL = "GEMINI_3_FLASH_FULL"
    GEMINI_PRO = "GEMINI_PRO"
    GEMINI_PRO_FULL = "GEMINI_PRO_FULL"
    GEMINI_35_FLASH = "GEMINI_35_FLASH"
    GEMINI_35_FLASH_FULL = "GEMINI_35_FLASH_FULL"
    ICHIGO = "ICHIGO"
    TORII = "TORII"
    DEEPL = "DEEPL"
    GOOGLE = "GOOGLE"
    GPT4O = "GPT4O"
    GPT4O_MINI = "GPT4O_MINI"


BubbleType = Literal["dialogue", "sfx"]


class BoundingBox(CamelModel):
    ymin: int = Field(ge=0, le=1000)
    xmin: int = Field(ge=0, le=1000)
    ymax: int = Field(ge=0, le=1000)
    xmax: int = Field(ge=0, le=1000)


class TextBubble(CamelModel):
    id: str
    original_text: str
    translated_text: str
    box: BoundingBox
    type: BubbleType = "dialogue"


class TokenUsage(CamelModel):
    input: int = 0
    output: int = 0
    total: int = 0
    model: str = ""
