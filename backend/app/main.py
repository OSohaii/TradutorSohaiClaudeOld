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

    # CORS configuration.
    #
    # Per the CORS spec (Fetch standard, MDN), `Access-Control-Allow-Origin: *`
    # is INCOMPATIBLE with `Access-Control-Allow-Credentials: true`. Browsers
    # reject responses that combine both, so the previous code (origins=["*"]
    # + allow_credentials=True) silently broke any deployment that relied on
    # the fallback to wildcard.
    #
    # Behavior:
    # - If the operator configured an explicit origin list via CORS_ORIGINS
    #   env var, we trust it and keep credentials enabled.
    # - If the list is empty (dev fallback), we use ["*"] and force
    #   allow_credentials=False so the response is at least valid; cookie /
    #   credential-bearing requests will need a properly configured deploy.
    configured_origins = settings.cors_origin_list
    if configured_origins:
        origins = configured_origins
        allow_credentials = True
    else:
        origins = ["*"]
        allow_credentials = False
        logging.getLogger(__name__).warning(
            "CORS: no CORS_ORIGINS configured; falling back to '*' with "
            "allow_credentials=False. Set CORS_ORIGINS to enable credentialed "
            "requests."
        )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=allow_credentials,
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
