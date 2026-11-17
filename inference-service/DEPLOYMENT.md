# GPU Deployment

This service is intended to run on a Linux NVIDIA GPU host. The examples use an RTX 4090 24 GB as the initial target. Do not start paid GPU resources without explicit approval.

## Host Prerequisites

- Ubuntu 22.04 or a comparable NVIDIA-ready Linux image.
- NVIDIA driver compatible with CUDA 11.8.
- Docker Engine.
- NVIDIA Container Toolkit.
- At least 50 GB of free disk for the image, build cache, model, checkpoints, and caches.
- At least 16 GB of host RAM for model preparation and image builds.

Verify the GPU is visible to Docker:

```bash
docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi
```

## One-Time Model Preparation

From `inference-service/`:

```bash
git clone https://github.com/yisol/IDM-VTON.git IDM-VTON
git -C IDM-VTON checkout 06ad89ba2f78d77a5ba21d7f7fd392254971fda2
python3.10 -m venv .venv
source .venv/bin/activate
pip install huggingface-hub==0.20.3
python scripts/download_models.py
```

If the Hugging Face Space revision has moved:

```bash
python scripts/download_models.py --skip-model --space-revision <current-space-revision>
```

Expected layout:

```text
inference-service/
  IDM-VTON/
    src/
    preprocess/
    gradio_demo/
    configs/
    ckpt/
  models/
    idm-vton/
      unet/
      unet_encoder/
      vae/
      image_encoder/
      text_encoder/
      text_encoder_2/
      tokenizer/
      tokenizer_2/
      scheduler/
  data/
    results/
```

## Build the Image

```bash
cp .env.example .env
```

Set `IDM_VTON_SERVICE_API_KEY` to a long random value, then:

```bash
docker build -t stylaiize-idm-vton:latest .
```

The image is based on `nvidia/cuda:11.8.0-cudnn8-devel-ubuntu22.04`, installs Python 3.10, PyTorch 2.0.1+cu118 and torchvision 0.15.2+cu118, then builds Detectron2 from source at `e9f7e2ba15abd7badcb05ef6f5076f06b36a9c5b`. PyTorch 2.0.1 does not publish a CUDA 11.8 Docker image, so the CUDA base image is required for Ada/RTX 40-series (`sm_89`) support.

For a GPU other than Ada/RTX 40-series, set the CUDA architecture list:

```bash
docker build \
  --build-arg TORCH_CUDA_ARCH_LIST="8.0;8.6" \
  -t stylaiize-idm-vton:latest .
```

A build with multiple architectures can take a long time. Build on a host with sufficient disk and CPU.

## Run

### Docker Compose

```bash
docker compose up -d
docker compose logs -f idm-vton
```

Compose mounts:

- `./IDM-VTON` read-only at `/app/IDM-VTON`
- `./models` read-only at `/models`
- `./data` writable at `/data`

### Direct Docker

```bash
docker run -d \
  --name stylaiize-idm-vton \
  --gpus all \
  --shm-size=8g \
  --restart unless-stopped \
  --env-file .env \
  -p 8000:8000 \
  -v "$PWD/IDM-VTON:/app/IDM-VTON:ro" \
  -v "$PWD/models:/models:ro" \
  -v "$PWD/data:/data" \
  stylaiize-idm-vton:latest
```

## Verify

```bash
curl -i http://127.0.0.1:8000/health
curl -i http://127.0.0.1:8000/ready
docker logs --tail 200 stylaiize-idm-vton
nvidia-smi
```

`/health` only proves the process is alive. `/ready` proves the model and CUDA stack loaded. Wait for:

```json
{"ready": true, "state": "ready", "device": "cuda"}
```

## Network and Security

- Terminate TLS with a reverse proxy such as Caddy, nginx, or the cloud provider's load balancer.
- Restrict inbound access to the StylAIze API host or a private network.
- Keep `IDM_VTON_SERVICE_API_KEY` secret and identical to the Node API's `VTON_SERVICE_API_KEY`.
- Do not publish port `8000` to the public internet without auth and TLS.
- Do not put the key in client-side code, browser bundles, or public logs.
- Set provider-side spending limits and an idle-shutdown policy.

## Connect StylAIze

In `apps/api/.env`:

```dotenv
VTON_PROVIDER=idm_vton
VTON_SERVICE_URL=https://vton.example.com
VTON_SERVICE_API_KEY=<same-token>
VTON_SERVICE_REQUEST_TIMEOUT_MS=20000
VTON_JOB_POLL_MS=2500
VTON_JOB_MAX_MS=600000
VTON_HEALTH_TIMEOUT_MS=5000
```

Restart the Node API after changing environment values. Confirm:

```bash
curl -sS http://127.0.0.1:4000/api/v1/tryon/health
```

The API health payload should report the `idm_vton` provider as ready. A normal try-on should then create a remote job, poll it, download the PNG, and persist it to MongoDB.

## Persistence and Restarts

- Jobs are in memory. A container restart loses queued/running jobs and client polling will fail.
- Generated PNGs live under `data/results` and expire after `IDM_VTON_JOB_TTL_SECONDS`.
- The Hugging Face cache lives under `data/huggingface` when using Compose.
- The model and repository mounts are read-only; delete and re-download them on the host to update.
- Node-level try-on jobs are also in memory. Only completed results are persisted to MongoDB.

## Capacity Guidance

- Start with one GPU and one service worker.
- Run one inference at a time. Concurrent requests queue in the service.
- Watch GPU memory and job latency before increasing traffic.
- Keep a queue cap and request timeouts so a stalled GPU job does not accumulate work.
- Use a load balancer only after adding a shared job store or sticky routing; this service's job state is process-local.

## Cost Control

- Stop or destroy the GPU instance when not testing.
- Do not enable autoscaling before load testing.
- Use provider spend alerts.
- Keep model downloads on persistent storage to avoid repeated download costs.

## Troubleshooting

### Container exits during startup

Read `docker compose logs idm-vton`. The most common causes are a missing `IDM-VTON` directory, missing `ckpt` files, a failed Detectron2 build, or an invalid env value.

### `/ready` returns 503

Wait for model loading first. If it persists, check the reported error and the full logs. Verify `/app/IDM-VTON`, `/models/idm-vton`, and the checkpoint files exist inside the container.

### Detectron2 binary mismatch

Do not copy the repository's Python 3.9 `.so` files into site-packages. The image must build Detectron2 for the container's Python 3.10 and CUDA version.

### CUDA out of memory

Reduce concurrent load, stop other GPU processes, and restart the container. Do not lower `IDM_VTON_STEPS` as a substitute for freeing memory.

### Node API cannot reach the service

Check the public URL, TLS certificate, firewall, bearer token, and `VTON_HEALTH_TIMEOUT_MS`. A `503` from `/ready` is a model/CUDA problem, not an auth problem.
