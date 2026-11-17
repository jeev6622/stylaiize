# StylAIze IDM-VTON Inference Service

FastAPI service that runs the real [IDM-VTON](https://github.com/yisol/IDM-VTON) virtual try-on pipeline on an NVIDIA GPU. It exposes asynchronous jobs with real model-stage progress, plus an optional synchronous endpoint.

The service never fabricates images. If the model, checkpoints, CUDA, or dependencies are unavailable, `/ready` and job statuses report the failure and the Node API surfaces it to the client.

## Requirements

- Linux GPU host with an NVIDIA GPU. An RTX 4090 24 GB is the initial target.
- Docker with the NVIDIA Container Toolkit, or a Python 3.10 environment matching the pinned requirements.
- The official IDM-VTON source tree.
- Roughly 50 GB of free disk for the Docker image, build cache, base model, DensePose/OpenPose/parsing checkpoints, and caches.

## Quick Start

```bash
git clone https://github.com/yisol/IDM-VTON.git IDM-VTON
git -C IDM-VTON checkout 06ad89ba2f78d77a5ba21d7f7fd392254971fda2
python scripts/download_models.py
cp .env.example .env
```

Set a long random `IDM_VTON_SERVICE_API_KEY` in `.env`. Then build and start:

```bash
docker compose up -d --build
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/ready
```

`/health` returns `200` while the process is alive. `/ready` returns `200` only after the model is loaded and CUDA is usable; it returns `503` while loading or after a load failure.

The first model load can take several minutes. Do not send production traffic until `/ready` reports `ready: true`.

## Model Setup

`scripts/download_models.py` downloads:

- `yisol/IDM-VTON` base model to `models/idm-vton`, pinned to `585a32e74aee241cbc0d0cc3ab21392ca58c916a`.
- `ckpt/**` and `configs/**` from the `yisol/IDM-VTON` Hugging Face Space into `IDM-VTON/`, pinned to `906d38c8a74e7c1cd0bf714a363fe2e939fa28b8`.

The GitHub source tree must also be present. It provides `preprocess/`, `src/`, and the Gradio helper modules.

```bash
python scripts/download_models.py --skip-model
python scripts/download_models.py --skip-checkpoints
```

If the Space revision is no longer available, pass the current revision with `--space-revision`. To use a Hugging Face token:

```bash
export HF_TOKEN=hf_...
python scripts/download_models.py
```

Required checkpoint files:

```text
IDM-VTON/ckpt/densepose/model_final_162be9.pkl
IDM-VTON/ckpt/humanparsing/parsing_atr.onnx
IDM-VTON/ckpt/humanparsing/parsing_lip.onnx
IDM-VTON/ckpt/openpose/ckpts/body_pose_model.pth
IDM-VTON/configs/densepose_rcnn_R_50_FPN_s1x.yaml
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `IDM_VTON_SERVICE_API_KEY` | empty | Bearer token for protected endpoints. Empty disables auth; use only on a trusted private network. |
| `IDM_VTON_REPO_DIR` | `./IDM-VTON` | Official source tree with `src/`, `preprocess/`, `ckpt/`, and `configs/`. |
| `IDM_VTON_MODEL_PATH` | empty | Local base-model directory. Falls back to `IDM_VTON_MODEL_ID` when absent. |
| `IDM_VTON_MODEL_ID` | `yisol/IDM-VTON` | Hugging Face model repository. |
| `IDM_VTON_MODEL_REVISION` | pinned SHA | Model revision. |
| `IDM_VTON_LOCAL_FILES_ONLY` | `false` | Prevent runtime Hugging Face downloads. |
| `IDM_VTON_RESULT_DIR` | `./data/results` | Generated PNG files. |
| `HF_HOME` | unset | Hugging Face cache directory. |
| `IDM_VTON_DEVICE` | `cuda` | `cuda`, `cuda:0`, or `cpu`. |
| `IDM_VTON_ALLOW_CPU` | `false` | Allow slow CPU fallback. Not recommended and not officially supported by IDM-VTON. |
| `IDM_VTON_WIDTH` / `IDM_VTON_HEIGHT` | `768` / `1024` | Output dimensions. |
| `IDM_VTON_STEPS` | `30` | Diffusion steps. |
| `IDM_VTON_GUIDANCE_SCALE` | `2.0` | Classifier-free guidance. |
| `IDM_VTON_SEED` | `42` | Fixed seed, or `none`/`random` for random seeds. |
| `IDM_VTON_MAX_IMAGE_BYTES` | `10485760` | Decoded limit per input image. |
| `IDM_VTON_MAX_IMAGE_PIXELS` | `40000000` | Pixel limit per input image. |
| `IDM_VTON_JOB_TTL_SECONDS` | `3600` | Finished-job/result retention. |
| `IDM_VTON_MAX_JOBS` | `20` | In-memory job cap; queued jobs retain decoded images. |
| `IDM_VTON_SYNC_TIMEOUT_SECONDS` | `600` | Timeout for `/infer`. |
| `IDM_VTON_HOST` / `IDM_VTON_PORT` | `0.0.0.0` / `8000` | Listen address. |
| `IDM_VTON_LOG_LEVEL` | `INFO` | Python log level. |

Run exactly one worker process. Job state is in memory, so multiple workers would not share jobs.

## API

All `/v1/*` and `/infer` calls require `Authorization: Bearer <IDM_VTON_SERVICE_API_KEY>` when a key is configured.

### Create Job

```bash
curl -sS http://127.0.0.1:8000/v1/jobs \
  -H "Authorization: Bearer $IDM_VTON_SERVICE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "human_image": "<raw base64 or data URL>",
    "garment_image": "<raw base64 or data URL>",
    "garment_description": "short sleeve cotton t-shirt",
    "category": "upper_body"
  }'
```

`category` is optional and defaults to `upper_body`. Supported values are `upper_body`, `lower_body`, and `dresses`.

The response is `202 Accepted`:

```json
{
  "id": "3f6c...",
  "status": "queued",
  "stage": "queued",
  "progress": 0,
  "message": "Queued for IDM-VTON inference.",
  "error": null,
  "processingTimeMs": null,
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-01-01T00:00:00Z"
}
```

### Poll Job

```bash
curl -sS http://127.0.0.1:8000/v1/jobs/<job-id> \
  -H "Authorization: Bearer $IDM_VTON_SERVICE_API_KEY"
```

Stages are `queued`, `loading_model`, `validating`, `masking`, `pose`, `encoding`, `diffusion`, `decoding`, `saving`, `running`, and `done`. Progress is monotonic. Diffusion progress is driven by the real pipeline step callback, not timers.

### Download Result

```bash
curl -sS http://127.0.0.1:8000/v1/jobs/<job-id>/result \
  -H "Authorization: Bearer $IDM_VTON_SERVICE_API_KEY" \
  -o result.png
```

The result is available only when the job status is `succeeded`.

### Synchronous Inference

```bash
curl -sS http://127.0.0.1:8000/infer \
  -H "Authorization: Bearer $IDM_VTON_SERVICE_API_KEY" \
  -H "Content-Type: application/json" \
  -d @request.json \
  -o result.png
```

`/infer` returns `image/png`, `502` on inference failure, `504` on timeout, and `503` when the queue is full.

## Connect the Node API

In `apps/api/.env`:

```dotenv
VTON_PROVIDER=idm_vton
VTON_SERVICE_URL=https://your-gpu-host.example.com
VTON_SERVICE_API_KEY=same-token-as-IDM_VTON_SERVICE_API_KEY
VTON_SERVICE_REQUEST_TIMEOUT_MS=20000
VTON_JOB_POLL_MS=2500
VTON_JOB_MAX_MS=600000
VTON_HEALTH_TIMEOUT_MS=5000
```

The Node API prefers `VTON_SERVICE_URL` over the legacy `VTON_API_URL`. Polling and job persistence remain in the Node API and MongoDB; this service only runs inference.

## Operational Notes

- The job store and result files are ephemeral. Restarting the GPU service loses in-flight jobs. Finished results expire after the TTL.
- The GPU service is single-worker by design. A 24 GB GPU should run one job at a time.
- Do not expose this service directly to the public internet. Put it behind TLS, a firewall/VPN, and a strong bearer token.
- A GPU health check should probe `/ready`, not only `/health`.
- CPU mode is best-effort. Official IDM-VTON and its parsing/OpenPose stack assume CUDA.

## Troubleshooting

### `/ready` stays at 503

Read the service logs. Common causes are a missing `IDM-VTON` source tree, missing checkpoints, an incompatible Detectron2 build, or a missing GPU.

### Detectron2 import or CUDA error

The repository's `gradio_demo/detectron2` contains a Python 3.9-only binary. The service appends `gradio_demo` to `sys.path` after site-packages so the installed Detectron2 wins. Build Detectron2 from source in the image; do not prepend the bundled directory.

### CUDA out of memory

Stop the container, confirm no other process is using the GPU, and retry. Keep one worker and one job at a time.

### First job is slow

The first request can include model loading. Poll `/ready` before sending traffic and avoid treating readiness time as per-image latency.

## Licensing

IDM-VTON and its model/checkpoint assets are published under **CC BY-NC-SA 4.0**. This integration is for noncommercial use unless you obtain separate permission. Review `THIRD_PARTY_NOTICES.md` and the upstream repositories before any commercial deployment.
