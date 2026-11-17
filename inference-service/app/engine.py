from __future__ import annotations

import contextlib
import logging
import os
import sys
import threading
from pathlib import Path
from typing import Any, Callable

from PIL import Image

from app.config import Settings
from app.models import TryOnInput

ProgressCallback = Callable[[str, float, str], None]

logger = logging.getLogger(__name__)


class EngineError(RuntimeError):
    pass


class EngineNotReady(EngineError):
    pass


def _require_file(path: Path, label: str) -> None:
    if not path.is_file():
        raise EngineError(f"{label} is missing at {path}.")


class InferenceEngine:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._state = "idle"
        self._error: str | None = None
        self._state_lock = threading.Lock()
        self._infer_lock = threading.Lock()
        self._load_thread: threading.Thread | None = None
        self._device = settings.device
        self._dtype: Any = None
        self._torch: Any = None
        self._pipe: Any = None
        self._parsing: Any = None
        self._openpose: Any = None
        self._tensor_transform: Any = None
        self._get_mask_location: Any = None
        self._apply_net: Any = None
        self._convert_pil_to_numpy: Any = None
        self._apply_exif_orientation: Any = None

    @property
    def state(self) -> str:
        with self._state_lock:
            return self._state

    @property
    def error(self) -> str | None:
        with self._state_lock:
            return self._error

    @property
    def is_ready(self) -> bool:
        return self.state == "ready"

    def start_loading(self) -> None:
        with self._state_lock:
            if self._state in {"loading", "ready"}:
                return
            self._state = "loading"
            self._error = None
            self._load_thread = threading.Thread(
                target=self._load,
                name="idm-vton-model-loader",
                daemon=True,
            )
            self._load_thread.start()

    def _load(self) -> None:
        try:
            self._load_impl()
        except Exception as exc:
            message = self._describe_load_error(exc)
            logger.exception("IDM-VTON model initialization failed")
            with self._state_lock:
                self._state = "error"
                self._error = message
        else:
            with self._state_lock:
                self._state = "ready"
                self._error = None
            logger.info("IDM-VTON model is ready on %s", self._device)

    def _describe_load_error(self, exc: Exception) -> str:
        if isinstance(exc, EngineError):
            return str(exc)
        if "out of memory" in str(exc).lower():
            return "The GPU ran out of memory while loading IDM-VTON."
        return f"{type(exc).__name__}: {str(exc)[:300]}"

    def _load_impl(self) -> None:
        settings = self.settings
        repo_dir = settings.repo_dir
        if not repo_dir.is_dir():
            raise EngineError(
                f"IDM-VTON repository not found at {repo_dir}. Set IDM_VTON_REPO_DIR."
            )

        required_files = {
            repo_dir / "src" / "tryon_pipeline.py": "Try-on pipeline",
            repo_dir / "src" / "unet_hacked_garmnet.py": "Garment UNet",
            repo_dir / "src" / "unet_hacked_tryon.py": "Try-on UNet",
            repo_dir / "gradio_demo" / "apply_net.py": "DensePose apply_net",
            repo_dir / "gradio_demo" / "utils_mask.py": "Mask utilities",
            repo_dir / "gradio_demo" / "densepose" / "__init__.py": "DensePose package",
            repo_dir / "preprocess" / "humanparsing" / "run_parsing.py": "Human parsing",
            repo_dir / "preprocess" / "humanparsing" / "parsing_api.py": "Human parsing API",
            repo_dir / "preprocess" / "openpose" / "run_openpose.py": "OpenPose",
            repo_dir
            / "preprocess"
            / "openpose"
            / "annotator"
            / "openpose"
            / "__init__.py": "OpenPose package",
            repo_dir / "configs" / "densepose_rcnn_R_50_FPN_s1x.yaml": "DensePose config",
            repo_dir / "ckpt" / "densepose" / "model_final_162be9.pkl": "DensePose checkpoint",
            repo_dir / "ckpt" / "humanparsing" / "parsing_atr.onnx": "Human parsing ATR checkpoint",
            repo_dir / "ckpt" / "humanparsing" / "parsing_lip.onnx": "Human parsing LIP checkpoint",
            repo_dir / "ckpt" / "openpose" / "ckpts" / "body_pose_model.pth": "OpenPose checkpoint",
        }
        for path, label in required_files.items():
            _require_file(path, label)

        if settings.model_path is not None and settings.model_path.exists():
            if not (settings.model_path / "unet" / "config.json").is_file():
                raise EngineError(
                    f"IDM_VTON_MODEL_PATH at {settings.model_path} does not contain a full model."
                )
            base_path = str(settings.model_path)
            source_kwargs: dict[str, Any] = {}
        else:
            if settings.model_path is not None:
                logger.warning(
                    "IDM_VTON_MODEL_PATH does not exist; falling back to %s",
                    settings.model_id,
                )
            base_path = settings.model_id
            source_kwargs = {}
            if settings.model_revision:
                source_kwargs["revision"] = settings.model_revision
            if settings.local_files_only:
                source_kwargs["local_files_only"] = True

        os.chdir(repo_dir)
        repo_root = str(repo_dir)
        gradio_dir = str((repo_dir / "gradio_demo").resolve())
        if repo_root not in sys.path:
            sys.path.insert(0, repo_root)
        if gradio_dir in sys.path:
            sys.path.remove(gradio_dir)
        sys.path.append(gradio_dir)

        import torch
        import gradio_demo.apply_net as apply_net
        from detectron2.data.detection_utils import convert_PIL_to_numpy, _apply_exif_orientation
        from diffusers import AutoencoderKL, DDPMScheduler
        from PIL import Image as PILImage
        from preprocess.humanparsing.run_parsing import Parsing
        from preprocess.openpose.run_openpose import OpenPose
        from src.tryon_pipeline import StableDiffusionXLInpaintPipeline as TryonPipeline
        from src.unet_hacked_garmnet import UNet2DConditionModel as UNet2DConditionModelRef
        from src.unet_hacked_tryon import UNet2DConditionModel
        from torchvision import transforms
        from transformers import (
            AutoTokenizer,
            CLIPImageProcessor,
            CLIPTextModel,
            CLIPTextModelWithProjection,
            CLIPVisionModelWithProjection,
        )
        from utils_mask import get_mask_location

        self._torch = torch
        self._apply_net = apply_net
        self._convert_pil_to_numpy = convert_PIL_to_numpy
        self._apply_exif_orientation = _apply_exif_orientation
        self._get_mask_location = get_mask_location
        self._tensor_transform = transforms.Compose(
            [
                transforms.ToTensor(),
                transforms.Normalize([0.5], [0.5]),
            ]
        )

        if self._device.startswith("cuda"):
            if not torch.cuda.is_available():
                raise EngineError(
                    "CUDA is not available. Set IDM_VTON_ALLOW_CPU=true only for slow CPU testing."
                )
            torch.cuda.set_device(torch.device(self._device))
            dtype = torch.float16
            gpu_id = int(self._device.split(":", 1)[1]) if ":" in self._device else 0
        else:
            if not settings.allow_cpu:
                raise EngineError(
                    "CPU inference is disabled. Set IDM_VTON_ALLOW_CPU=true to allow it."
                )
            torch.cuda.set_device = lambda *args, **kwargs: None
            dtype = torch.float32
            gpu_id = 0
        self._dtype = dtype
        logger.info(
            "Loading IDM-VTON from %s on %s (dtype=%s)",
            base_path,
            self._device,
            dtype,
        )

        model_kwargs = {"torch_dtype": dtype, **source_kwargs}
        tokenizer_kwargs = {"use_fast": False, **source_kwargs}

        unet = UNet2DConditionModel.from_pretrained(
            base_path, subfolder="unet", **model_kwargs
        )
        unet.requires_grad_(False)
        unet_encoder = UNet2DConditionModelRef.from_pretrained(
            base_path, subfolder="unet_encoder", **model_kwargs
        )
        unet_encoder.requires_grad_(False)
        vae = AutoencoderKL.from_pretrained(base_path, subfolder="vae", **model_kwargs)
        vae.requires_grad_(False)
        image_encoder = CLIPVisionModelWithProjection.from_pretrained(
            base_path, subfolder="image_encoder", **model_kwargs
        )
        image_encoder.requires_grad_(False)
        text_encoder_one = CLIPTextModel.from_pretrained(
            base_path, subfolder="text_encoder", **model_kwargs
        )
        text_encoder_one.requires_grad_(False)
        text_encoder_two = CLIPTextModelWithProjection.from_pretrained(
            base_path, subfolder="text_encoder_2", **model_kwargs
        )
        text_encoder_two.requires_grad_(False)
        tokenizer_one = AutoTokenizer.from_pretrained(
            base_path, subfolder="tokenizer", **tokenizer_kwargs
        )
        tokenizer_two = AutoTokenizer.from_pretrained(
            base_path, subfolder="tokenizer_2", **tokenizer_kwargs
        )
        noise_scheduler = DDPMScheduler.from_pretrained(
            base_path, subfolder="scheduler", **source_kwargs
        )

        pipe = TryonPipeline.from_pretrained(
            base_path,
            unet=unet,
            vae=vae,
            feature_extractor=CLIPImageProcessor(),
            text_encoder=text_encoder_one,
            text_encoder_2=text_encoder_two,
            tokenizer=tokenizer_one,
            tokenizer_2=tokenizer_two,
            scheduler=noise_scheduler,
            image_encoder=image_encoder,
            torch_dtype=dtype,
            **source_kwargs,
        )
        pipe.unet_encoder = unet_encoder
        pipe.to(self._device)
        pipe.unet_encoder.to(self._device)
        pipe.set_progress_bar_config(disable=True)

        parsing = Parsing(gpu_id)
        openpose = OpenPose(gpu_id)
        if self._device.startswith("cuda"):
            openpose.preprocessor.body_estimation.model.to(self._device)

        self._pipe = pipe
        self._parsing = parsing
        self._openpose = openpose
        self._image = PILImage

    def infer(self, request: TryOnInput, progress: ProgressCallback) -> Image.Image:
        if not self.is_ready:
            raise EngineNotReady("The IDM-VTON model is not ready.")
        with self._infer_lock:
            return self._infer_impl(request, progress)

    def _infer_impl(self, request: TryOnInput, progress: ProgressCallback) -> Image.Image:
        settings = self.settings
        torch = self._torch
        width = settings.width
        height = settings.height
        device = self._device
        dtype = self._dtype

        progress("validating", 2.0, "Validating uploaded images...")
        garment_image = request.garment_image.convert("RGB").resize((width, height))
        human_image = request.human_image.convert("RGB").resize((width, height))

        progress("masking", 8.0, "Building garment mask...")
        parsing_input = human_image.resize((384, 512))
        keypoints = self._openpose(parsing_input)
        model_parse, _ = self._parsing(parsing_input)
        mask, _ = self._get_mask_location(
            "hd", request.category, model_parse, keypoints
        )
        mask = mask.resize((width, height))
        progress("masking", 20.0, "Garment mask ready.")

        progress("pose", 22.0, "Generating DensePose...")
        human_img_arg = self._apply_exif_orientation(human_image.resize((384, 512)))
        human_img_arg = self._convert_pil_to_numpy(human_img_arg, format="BGR")
        args = self._apply_net.create_argument_parser().parse_args(
            (
                "show",
                str(self.settings.repo_dir / "configs" / "densepose_rcnn_R_50_FPN_s1x.yaml"),
                str(
                    self.settings.repo_dir
                    / "ckpt"
                    / "densepose"
                    / "model_final_162be9.pkl"
                ),
                "dp_segm",
                "-v",
                "--opts",
                "MODEL.DEVICE",
                device,
            )
        )
        pose_img = args.func(args, human_img_arg)
        pose_img = pose_img[:, :, ::-1]
        pose_img = self._image.fromarray(pose_img).resize((width, height))
        progress("pose", 30.0, "Body pose ready.")

        progress("encoding", 35.0, "Encoding garment and text prompts...")
        prompt = "model is wearing " + request.garment_description
        negative_prompt = "monochrome, lowres, bad anatomy, worst quality, low quality"
        autocast = (
            torch.autocast(device_type="cuda", dtype=torch.float16)
            if device.startswith("cuda")
            else contextlib.nullcontext()
        )
        with torch.inference_mode():
            with autocast:
                (
                    prompt_embeds,
                    negative_prompt_embeds,
                    pooled_prompt_embeds,
                    negative_pooled_prompt_embeds,
                ) = self._pipe.encode_prompt(
                    prompt,
                    num_images_per_prompt=1,
                    do_classifier_free_guidance=True,
                    negative_prompt=negative_prompt,
                )
                (
                    prompt_embeds_c,
                    _,
                    _,
                    _,
                ) = self._pipe.encode_prompt(
                    ["a photo of " + request.garment_description],
                    num_images_per_prompt=1,
                    do_classifier_free_guidance=False,
                    negative_prompt=[negative_prompt],
                )

        pose_tensor = self._tensor_transform(pose_img).unsqueeze(0).to(device, dtype)
        garm_tensor = self._tensor_transform(garment_image).unsqueeze(0).to(device, dtype)
        generator = (
            torch.Generator(device).manual_seed(settings.seed)
            if settings.seed is not None
            else None
        )

        total_steps = max(1, int(settings.num_inference_steps))

        def on_step_end(pipe: Any, step: int, timestep: Any, callback_kwargs: dict) -> dict:
            completed = int(step) + 1
            value = 40.0 + (completed / total_steps) * 55.0
            progress(
                "diffusion",
                min(95.0, value),
                f"Running diffusion step {completed}/{total_steps}...",
            )
            return callback_kwargs

        progress("diffusion", 40.0, "Starting diffusion...")
        with torch.inference_mode():
            with autocast:
                generated = self._pipe(
                    prompt_embeds=prompt_embeds.to(device, dtype),
                    negative_prompt_embeds=negative_prompt_embeds.to(device, dtype),
                    pooled_prompt_embeds=pooled_prompt_embeds.to(device, dtype),
                    negative_pooled_prompt_embeds=negative_pooled_prompt_embeds.to(
                        device, dtype
                    ),
                    num_inference_steps=total_steps,
                    generator=generator,
                    strength=1.0,
                    pose_img=pose_tensor,
                    text_embeds_cloth=prompt_embeds_c.to(device, dtype),
                    cloth=garm_tensor,
                    mask_image=mask,
                    image=human_image,
                    height=height,
                    width=width,
                    ip_adapter_image=garment_image,
                    guidance_scale=settings.guidance_scale,
                    callback_on_step_end=on_step_end,
                    callback_on_step_end_tensor_inputs=["latents"],
                )[0]

        progress("decoding", 96.0, "Decoding generated image...")
        if not generated:
            raise EngineError("IDM-VTON returned no image.")
        result = generated[0]
        if not isinstance(result, Image.Image):
            raise EngineError("IDM-VTON returned an invalid image.")
        progress("decoding", 97.0, "Generated image ready.")
        return result.convert("RGB")

    def describe_inference_error(self, exc: Exception) -> str:
        if isinstance(exc, EngineError):
            return str(exc)
        if "out of memory" in str(exc).lower():
            return "The GPU ran out of memory during inference. Try a smaller image or restart the service."
        return "IDM-VTON inference failed. Check the GPU service logs."
