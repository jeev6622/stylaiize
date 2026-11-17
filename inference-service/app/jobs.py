from __future__ import annotations

import logging
import queue
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config import Settings
from app.engine import InferenceEngine
from app.models import TryOnInput

logger = logging.getLogger(__name__)

TERMINAL_STATUSES = {"succeeded", "failed"}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def isoformat(value: datetime) -> str:
    return value.isoformat().replace("+00:00", "Z")


class JobNotFound(Exception):
    pass


class JobNotReady(Exception):
    pass


class JobFailed(Exception):
    pass


class JobTimeout(Exception):
    pass


class JobQueueFull(Exception):
    pass


@dataclass
class Job:
    id: str
    request: TryOnInput | None
    status: str = "queued"
    stage: str = "queued"
    progress: float = 0.0
    message: str = "Queued for IDM-VTON inference."
    error: str | None = None
    created_at: datetime = field(default_factory=utcnow)
    updated_at: datetime = field(default_factory=utcnow)
    started_at: datetime | None = None
    finished_at: datetime | None = None
    processing_time_ms: int | None = None
    result_path: Path | None = None


def job_response(job: Job) -> dict[str, Any]:
    return {
        "id": job.id,
        "status": job.status,
        "stage": job.stage,
        "progress": round(job.progress, 2),
        "message": job.message,
        "error": job.error,
        "processingTimeMs": job.processing_time_ms,
        "createdAt": isoformat(job.created_at),
        "updatedAt": isoformat(job.updated_at),
    }


class JobManager:
    def __init__(self, engine: InferenceEngine, settings: Settings):
        self._engine = engine
        self._settings = settings
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()
        self._queue: queue.Queue[str] = queue.Queue()
        self._stop = threading.Event()
        self._worker: threading.Thread | None = None
        self._result_dir = settings.result_dir
        self._result_dir.mkdir(parents=True, exist_ok=True)

    def start(self) -> None:
        if self._worker is not None and self._worker.is_alive():
            return
        self._stop.clear()
        self._worker = threading.Thread(
            target=self._worker_loop,
            name="idm-vton-job-worker",
            daemon=True,
        )
        self._worker.start()

    def stop(self) -> None:
        self._stop.set()
        if self._worker is not None:
            self._worker.join(timeout=5)

    def submit(self, request: TryOnInput) -> dict[str, Any]:
        now = utcnow()
        with self._lock:
            self._prune_locked(now)
            self._make_room_locked()
            if len(self._jobs) >= self._settings.max_jobs:
                raise JobQueueFull("The inference queue is full; try again shortly.")
            job = Job(id=uuid.uuid4().hex, request=request, created_at=now, updated_at=now)
            self._jobs[job.id] = job
            response = job_response(job)
        self._queue.put(job.id)
        return response

    def get(self, job_id: str) -> dict[str, Any]:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                raise JobNotFound("Job not found.")
            return job_response(job)

    def get_result(self, job_id: str) -> bytes:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                raise JobNotFound("Job not found.")
            if job.status != "succeeded":
                raise JobNotReady("The job has not completed successfully.")
            result_path = job.result_path
        if result_path is None:
            raise JobNotFound("The job result has expired.")
        try:
            return result_path.read_bytes()
        except FileNotFoundError as exc:
            raise JobNotFound("The job result has expired.") from exc

    def wait_for_terminal(self, job_id: str, timeout_seconds: float) -> dict[str, Any]:
        deadline = time.monotonic() + timeout_seconds
        while True:
            with self._lock:
                job = self._jobs.get(job_id)
                if job is None:
                    raise JobNotFound("Job not found.")
                if job.status == "succeeded":
                    return job_response(job)
                if job.status == "failed":
                    raise JobFailed(job.error or "IDM-VTON inference failed.")
            if time.monotonic() >= deadline:
                raise JobTimeout("Timed out waiting for IDM-VTON inference.")
            time.sleep(0.25)

    def _make_room_locked(self) -> None:
        if len(self._jobs) < self._settings.max_jobs:
            return
        finished = sorted(
            (job for job in self._jobs.values() if job.status in TERMINAL_STATUSES),
            key=lambda job: job.created_at,
        )
        while len(self._jobs) >= self._settings.max_jobs and finished:
            self._remove_locked(finished.pop(0))

    def _prune_locked(self, now: datetime) -> None:
        cutoff = now.timestamp() - self._settings.job_ttl_seconds
        expired = [
            job
            for job in self._jobs.values()
            if job.status in TERMINAL_STATUSES and job.finished_at is not None
            and job.finished_at.timestamp() < cutoff
        ]
        for job in expired:
            self._remove_locked(job)

    def _remove_locked(self, job: Job) -> None:
        self._jobs.pop(job.id, None)
        if job.result_path is not None:
            try:
                job.result_path.unlink(missing_ok=True)
            except OSError:
                logger.warning("Could not delete expired result %s", job.result_path)

    def _update(
        self,
        job_id: str,
        status: str | None = None,
        stage: str | None = None,
        progress: float | None = None,
        message: str | None = None,
        error: str | None = None,
    ) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None or job.status in TERMINAL_STATUSES:
                return
            if status is not None:
                job.status = status
            if stage is not None:
                job.stage = stage
            if progress is not None:
                job.progress = max(job.progress, min(100.0, max(0.0, progress)))
            if message is not None:
                job.message = message
            if error is not None:
                job.error = error
            job.updated_at = utcnow()

    def _wait_for_engine(self, job_id: str) -> None:
        while not self._engine.is_ready:
            if self._stop.is_set():
                raise JobFailed("The inference service is shutting down.")
            if self._engine.state == "error":
                raise JobFailed(self._engine.error or "The IDM-VTON model failed to load.")
            self._update(
                job_id,
                stage="loading_model",
                progress=0.0,
                message="Loading IDM-VTON on the GPU...",
            )
            time.sleep(0.5)

    def _worker_loop(self) -> None:
        last_prune = 0.0
        while not self._stop.is_set():
            now = time.monotonic()
            if now - last_prune >= 60:
                with self._lock:
                    self._prune_locked(utcnow())
                last_prune = now
            try:
                job_id = self._queue.get(timeout=0.5)
            except queue.Empty:
                continue
            try:
                self._process(job_id)
            finally:
                self._queue.task_done()

    def _process(self, job_id: str) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None or job.request is None or job.status in TERMINAL_STATUSES:
                return
            job.status = "running"
            job.stage = "loading_model"
            job.message = "Preparing IDM-VTON..."
            job.started_at = utcnow()
            job.updated_at = job.started_at
            request = job.request

        try:
            self._wait_for_engine(job_id)
            self._update(
                job_id,
                stage="validating",
                progress=2.0,
                message="Validating uploaded images...",
            )

            def on_progress(stage: str, progress: float, message: str) -> None:
                self._update(
                    job_id,
                    stage=stage,
                    progress=progress,
                    message=message,
                )

            result = self._engine.infer(request, on_progress)
            self._update(job_id, stage="saving", progress=98.0, message="Saving result...")
            result_path = self._result_dir / f"{job_id}.png"
            temp_path = result_path.with_suffix(".png.tmp")
            result.save(temp_path, format="PNG")
            temp_path.replace(result_path)

            finished = utcnow()
            with self._lock:
                job = self._jobs.get(job_id)
                if job is None:
                    result_path.unlink(missing_ok=True)
                    return
                job.status = "succeeded"
                job.stage = "done"
                job.progress = 100.0
                job.message = "Try-on completed."
                job.error = None
                job.result_path = result_path
                job.request = None
                job.finished_at = finished
                job.updated_at = finished
                started = job.started_at or job.created_at
                job.processing_time_ms = int((finished - started).total_seconds() * 1000)
        except Exception as exc:
            logger.exception("IDM-VTON job %s failed", job_id)
            message = (
                str(exc)
                if isinstance(exc, (JobFailed, JobTimeout))
                else self._engine.describe_inference_error(exc)
            )
            finished = utcnow()
            with self._lock:
                job = self._jobs.get(job_id)
                if job is None:
                    return
                job.status = "failed"
                job.error = message
                job.message = message
                job.request = None
                job.finished_at = finished
                job.updated_at = finished
                started = job.started_at or job.created_at
                job.processing_time_ms = int((finished - started).total_seconds() * 1000)
