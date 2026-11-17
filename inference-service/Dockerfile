FROM nvidia/cuda:11.8.0-cudnn8-devel-ubuntu22.04

ARG DETECTRON2_REF=e9f7e2ba15abd7badcb05ef6f5076f06b36a9c5b
ARG TORCH_CUDA_ARCH_LIST="7.5;8.0;8.6;8.9;9.0"
ARG TORCH_VERSION=2.0.1
ARG TORCHVISION_VERSION=0.15.2
ARG MAX_JOBS=2

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    FORCE_CUDA=1 \
    MPLBACKEND=Agg \
    CUDA_HOME=/usr/local/cuda \
    PATH=/usr/local/cuda/bin:${PATH} \
    TORCH_CUDA_ARCH_LIST=${TORCH_CUDA_ARCH_LIST} \
    MAX_JOBS=${MAX_JOBS} \
    HF_HOME=/data/huggingface \
    IDM_VTON_REPO_DIR=/app/IDM-VTON \
    IDM_VTON_MODEL_PATH=/models/idm-vton \
    IDM_VTON_RESULT_DIR=/data/results

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        git \
        libgl1 \
        libglib2.0-0 \
        ninja-build \
        python3.10 \
        python3.10-dev \
        python3-pip \
        python3-setuptools \
        python3-wheel \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN python3.10 -m pip install --upgrade pip==23.3.1 \
    && python3.10 -m pip install \
        "torch==${TORCH_VERSION}+cu118" \
        "torchvision==${TORCHVISION_VERSION}+cu118" \
        --index-url https://download.pytorch.org/whl/cu118 \
    && python3.10 -m pip install -r /app/requirements.txt \
    && python3.10 -m pip install --no-build-isolation \
        "git+https://github.com/facebookresearch/detectron2.git@${DETECTRON2_REF}"

COPY app /app/app
COPY scripts /app/scripts

RUN mkdir -p /app/IDM-VTON /models/idm-vton /data/results /data/huggingface

EXPOSE 8000

CMD ["python3.10", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
