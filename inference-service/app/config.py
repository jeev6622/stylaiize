from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


def _env(name: str, default: str) -> str:
    value = os.getenv(name)
    return default if value is None or value.strip() == "" else value.strip()


def _env_int(name: str, default: int) -> int:
    return int(_env(name, str(default)))


def _env_float(name: str, default: float) -> float:
    return float(_env(name, str(default)))


def _env_bool(name: str, default: bool) -> bool:
    value = _env(name, "true" if default else "false").lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"{name} must be a boolean value")


def _optional_path(name: str, default: Path) -> Path:
    return Path(_env(name, str(default))).expanduser().resolve()


@dataclass(frozen=True)
class Settings:
    repo_dir: Path
    model_path: Path | None
    model_id: str
    model_revision: str
    local_files_only: bool
    device: str
    allow_cpu: bool
    width: int
    height: int
    num_inference_steps: int
    guidance_scale: float
    seed: int | None
    max_image_bytes: int
    max_image_pixels: int
    result_dir: Path
    job_ttl_seconds: int
    max_jobs: int
    sync_timeout_seconds: int
    api_key: str
    host: str
    port: int
    log_level: str

    @property
    def auth_enabled(self) -> bool:
        return bool(self.api_key)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    service_root = Path(__file__).resolve().parents[1]
    repo_dir = _optional_path("IDM_VTON_REPO_DIR", service_root / "IDM-VTON")
    model_path_raw = _env("IDM_VTON_MODEL_PATH", "")
    model_path = Path(model_path_raw).expanduser().resolve() if model_path_raw else None
    result_dir = _optional_path("IDM_VTON_RESULT_DIR", service_root / "data" / "results")
    seed_raw = _env("IDM_VTON_SEED", "42")
    seed = None if seed_raw.lower() in {"", "none", "random"} else int(seed_raw)
    device = _env("IDM_VTON_DEVICE", "cuda").lower()
    if not (device == "cpu" or device == "cuda" or device.startswith("cuda:")):
        raise ValueError("IDM_VTON_DEVICE must be 'cpu' or a CUDA device such as 'cuda' or 'cuda:0'")
    return Settings(
        repo_dir=repo_dir,
        model_path=model_path,
        model_id=_env("IDM_VTON_MODEL_ID", "yisol/IDM-VTON"),
        model_revision=_env(
            "IDM_VTON_MODEL_REVISION",
            "585a32e74aee241cbc0d0cc3ab21392ca58c916a",
        ),
        local_files_only=_env_bool("IDM_VTON_LOCAL_FILES_ONLY", False),
        device=device,
        allow_cpu=_env_bool("IDM_VTON_ALLOW_CPU", False),
        width=_env_int("IDM_VTON_WIDTH", 768),
        height=_env_int("IDM_VTON_HEIGHT", 1024),
        num_inference_steps=_env_int("IDM_VTON_STEPS", 30),
        guidance_scale=_env_float("IDM_VTON_GUIDANCE_SCALE", 2.0),
        seed=seed,
        max_image_bytes=_env_int("IDM_VTON_MAX_IMAGE_BYTES", 10 * 1024 * 1024),
        max_image_pixels=_env_int("IDM_VTON_MAX_IMAGE_PIXELS", 40_000_000),
        result_dir=result_dir,
        job_ttl_seconds=_env_int("IDM_VTON_JOB_TTL_SECONDS", 3600),
        max_jobs=_env_int("IDM_VTON_MAX_JOBS", 20),
        sync_timeout_seconds=_env_int("IDM_VTON_SYNC_TIMEOUT_SECONDS", 600),
        api_key=_env("IDM_VTON_SERVICE_API_KEY", ""),
        host=_env("IDM_VTON_HOST", "0.0.0.0"),
        port=_env_int("IDM_VTON_PORT", 8000),
        log_level=_env("IDM_VTON_LOG_LEVEL", "INFO").upper(),
    )
