"""FastAPI application entrypoint."""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .errors import ProviderError, provider_error_handler
from .routers import fetch_image, health, ichigo, pipeline, translate


def create_app() -> FastAPI:
    settings = get_settings()

    logging.basicConfig(
        level=logging.INFO if settings.is_dev else logging.WARNING,
        format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
    )

    app = FastAPI(
        title="MangaLens BFF",
        description=(
            "Backend-for-Frontend that proxies Gemini, Ichigo, Torii, DeepL "
            "and Google Translate. Provider keys live in env vars; clients "
            "may also supply their own via X-Byok-* headers."
        ),
        version="1.0.0",
        docs_url="/api/docs" if settings.is_dev else None,
        redoc_url=None,
        openapi_url="/api/openapi.json" if settings.is_dev else None,
    )

    origins = settings.cors_origin_list or ["*"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    app.add_exception_handler(ProviderError, provider_error_handler)

    app.include_router(health.router, prefix="/api", tags=["meta"])
    app.include_router(pipeline.router, prefix="/api", tags=["pipeline"])
    app.include_router(translate.router, prefix="/api", tags=["translate"])
    app.include_router(ichigo.router, prefix="/api", tags=["ichigo"])
    app.include_router(fetch_image.router, prefix="/api", tags=["fetch"])

    return app


app = create_app()
