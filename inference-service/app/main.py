from __future__ import annotations

import logging
import secrets
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse, Response

from app.config import get_settings
from app.engine import InferenceEngine
from app.images import ImageInputError, decode_image
from app.jobs import (
    JobFailed,
    JobManager,
    JobNotFound,
    JobNotReady,
    JobQueueFull,
    JobTimeout,
)
from app.models import TryOnInput
from app.schemas import JobResponse, TryOnRequest

settings = get_settings()
logging.basicConfig(
    level=getattr(logging, settings.log_level, logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

engine = InferenceEngine(settings)
jobs = JobManager(engine, settings)
MAX_REQUEST_BYTES = (settings.max_image_bytes * 2 * 4 // 3) + 2 * 1024 * 1024


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.settings = settings
    app.state.engine = engine
    app.state.jobs = jobs
    jobs.start()
    engine.start_loading()
    try:
        yield
    finally:
        jobs.stop()


app = FastAPI(
    title="StylAIze IDM-VTON Inference Service",
    version="1.0.0",
    lifespan=lifespan,
)


def require_auth(authorization: str | None = Header(default=None)) -> None:
    if not settings.auth_enabled:
        return
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not secrets.compare_digest(
        token.strip(), settings.api_key
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


@app.middleware("http")
async def reject_oversized_requests(request: Request, call_next):
    if request.method == "POST":
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > MAX_REQUEST_BYTES:
                    return JSONResponse(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        content={"detail": "Request body is too large."},
                    )
            except ValueError:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={"detail": "Invalid Content-Length header."},
                )
    return await call_next(request)


def build_input(payload: TryOnRequest) -> TryOnInput:
    try:
        human_image = decode_image(
            payload.human_image,
            "human_image",
            settings.max_image_bytes,
            settings.max_image_pixels,
        )
        garment_image = decode_image(
            payload.garment_image,
            "garment_image",
            settings.max_image_bytes,
            settings.max_image_pixels,
        )
    except ImageInputError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    description = payload.garment_description.strip()
    if not description:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="garment_description is required.",
        )
    return TryOnInput(
        human_image=human_image,
        garment_image=garment_image,
        garment_description=description,
        category=payload.category,
    )


def submit_job(payload: TryOnRequest) -> dict:
    request = build_input(payload)
    try:
        return jobs.submit(request)
    except JobQueueFull as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
            headers={"Retry-After": "10"},
        ) from exc


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "idm-vton-inference",
        "state": engine.state,
        "device": settings.device,
    }


@app.get("/ready")
def ready() -> JSONResponse:
    if engine.is_ready:
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "ready": True,
                "state": engine.state,
                "device": settings.device,
            },
        )
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "ready": False,
            "state": engine.state,
            "device": settings.device,
            "error": engine.error,
        },
    )


@app.post(
    "/v1/jobs",
    response_model=JobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def create_job(
    payload: TryOnRequest,
    _: None = Depends(require_auth),
) -> dict:
    return submit_job(payload)


@app.get("/v1/jobs/{job_id}", response_model=JobResponse)
def get_job(job_id: str, _: None = Depends(require_auth)) -> dict:
    try:
        return jobs.get(job_id)
    except JobNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@app.get("/v1/jobs/{job_id}/result")
def get_job_result(job_id: str, _: None = Depends(require_auth)) -> Response:
    try:
        image = jobs.get_result(job_id)
    except JobNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except JobNotReady as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    return Response(
        content=image,
        media_type="image/png",
        headers={"Cache-Control": "private, max-age=300"},
    )


@app.post("/infer")
def infer(payload: TryOnRequest, _: None = Depends(require_auth)) -> Response:
    created = submit_job(payload)
    try:
        jobs.wait_for_terminal(created["id"], settings.sync_timeout_seconds)
        image = jobs.get_result(created["id"])
    except JobNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except JobFailed as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except JobTimeout as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=str(exc),
        ) from exc
    return Response(content=image, media_type="image/png")
