from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from huggingface_hub import snapshot_download

MODEL_REVISION = "585a32e74aee241cbc0d0cc3ab21392ca58c916a"
SPACE_REVISION = "906d38c8a74e7c1cd0bf714a363fe2e939fa28b8"
REQUIRED_MODEL_FILES = (
    "model_index.json",
    "unet/config.json",
    "unet_encoder/config.json",
    "vae/config.json",
    "image_encoder/config.json",
    "text_encoder/config.json",
    "text_encoder_2/config.json",
    "tokenizer/tokenizer_config.json",
    "tokenizer_2/tokenizer_config.json",
    "scheduler/scheduler_config.json",
)
REQUIRED_CHECKPOINT_FILES = (
    "ckpt/densepose/model_final_162be9.pkl",
    "ckpt/humanparsing/parsing_atr.onnx",
    "ckpt/humanparsing/parsing_lip.onnx",
    "ckpt/openpose/ckpts/body_pose_model.pth",
    "configs/densepose_rcnn_R_50_FPN_s1x.yaml",
)


def env_or(name: str, default: str) -> str:
    value = os.getenv(name)
    return value.strip() if value and value.strip() else default


def env_path(name: str, default: Path) -> Path:
    value = os.getenv(name)
    return Path(value).expanduser() if value and value.strip() else default


def missing_files(root: Path, relative_paths: tuple[str, ...]) -> list[str]:
    return [path for path in relative_paths if not (root / path).is_file()]


def parse_args() -> argparse.Namespace:
    service_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(
        description="Download the IDM-VTON base model and checkpoint assets."
    )
    parser.add_argument("--model-id", default="yisol/IDM-VTON")
    parser.add_argument(
        "--model-revision",
        default=env_or("IDM_VTON_MODEL_REVISION", MODEL_REVISION),
    )
    parser.add_argument("--space-id", default="yisol/IDM-VTON")
    parser.add_argument(
        "--space-revision",
        default=env_or("IDM_VTON_SPACE_REVISION", SPACE_REVISION),
    )
    parser.add_argument(
        "--model-dir",
        type=Path,
        default=env_path("IDM_VTON_MODEL_PATH", service_root / "models" / "idm-vton"),
    )
    parser.add_argument(
        "--repo-dir",
        type=Path,
        default=env_path("IDM_VTON_REPO_DIR", service_root / "IDM-VTON"),
    )
    parser.add_argument("--token", default=os.getenv("HF_TOKEN"))
    parser.add_argument("--skip-model", action="store_true")
    parser.add_argument("--skip-checkpoints", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    token = args.token or None

    if not args.skip_model:
        print(f"Downloading model {args.model_id}@{args.model_revision}")
        path = snapshot_download(
            repo_id=args.model_id,
            revision=args.model_revision,
            repo_type="model",
            local_dir=args.model_dir,
            token=token,
        )
        print(f"Model ready at {path}")

    if not args.skip_checkpoints:
        args.repo_dir.mkdir(parents=True, exist_ok=True)
        print(f"Downloading checkpoints from space {args.space_id}@{args.space_revision}")
        path = snapshot_download(
            repo_id=args.space_id,
            revision=args.space_revision,
            repo_type="space",
            local_dir=args.repo_dir,
            allow_patterns=["ckpt/**", "configs/**"],
            token=token,
        )
        print(f"Checkpoints ready at {path}")

    missing: list[str] = []
    if not args.skip_model:
        missing.extend(missing_files(args.model_dir, REQUIRED_MODEL_FILES))
    if not args.skip_checkpoints:
        missing.extend(missing_files(args.repo_dir, REQUIRED_CHECKPOINT_FILES))
    if missing:
        print("Download finished, but these required files are missing:", file=sys.stderr)
        for path in missing:
            print(f"  - {path}", file=sys.stderr)
        return 1

    print(f"Set IDM_VTON_MODEL_PATH={args.model_dir.resolve()}")
    print(f"Set IDM_VTON_REPO_DIR={args.repo_dir.resolve()}")
    print("The repo also needs the official GitHub source tree at IDM_VTON_REPO_DIR.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
