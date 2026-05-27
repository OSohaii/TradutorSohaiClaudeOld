"""Ichigo authentication endpoint.

Login is the only stateful Ichigo flow. Translation goes through the
pipeline endpoint with the bearer token sent as ``X-Byok-Ichigo``.
"""
from __future__ import annotations

from fastapi import APIRouter

from ..providers import ichigo as ichigo_provider
from ..schemas.ichigo import IchigoLoginRequest, IchigoLoginResponse

router = APIRouter()


@router.post("/ichigo/login", response_model=IchigoLoginResponse)
async def login(req: IchigoLoginRequest) -> IchigoLoginResponse:
    token = await ichigo_provider.login(req.email, req.password)
    return IchigoLoginResponse(access_token=token)
