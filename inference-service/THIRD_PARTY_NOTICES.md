# Third-Party Notices

This service runs and integrates third-party models and code. The upstream licenses govern those components. This notice is not legal advice and does not replace the upstream license texts.

## IDM-VTON

- Repository: https://github.com/yisol/IDM-VTON
- Model: https://huggingface.co/yisol/IDM-VTON
- Pinned repository commit: `06ad89ba2f78d77a5ba21d7f7fd392254971fda2`
- Pinned model revision: `585a32e74aee241cbc0d0cc3ab21392ca58c916a`
- License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)

The IDM-VTON source, model weights, and associated checkpoint assets are used under CC BY-NC-SA 4.0. Noncommercial use, attribution, and share-alike obligations apply. Obtain separate permission from the rights holders before commercial use.

## DensePose

- Project: https://github.com/facebookresearch/detectron2/tree/main/projects/DensePose
- License: Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)

The DensePose code and model checkpoint are used for pose conditioning. The noncommercial restriction applies to the upstream DensePose materials.

## Detectron2

- Project: https://github.com/facebookresearch/detectron2
- License: Apache License 2.0

Detectron2 is installed from source in the Docker image. The bundled `gradio_demo/detectron2` binary from the IDM-VTON repository is Python 3.9-only and is not used.

## OpenPose

- Project: https://github.com/CMU-Perceptual-Computing-Lab/openpose
- PyTorch implementation: https://github.com/Hzzone/pytorch-openpose
- License: See the upstream CMU OpenPose and PyTorch OpenPose licenses

The OpenPose body model and Python inference code are used for keypoint extraction. OpenPose licensing is restrictive; review the upstream terms before commercial use.

## Human Parsing Models

The `parsing_atr.onnx` and `parsing_lip.onnx` checkpoints are distributed through the IDM-VTON Hugging Face Space. Treat them as part of the IDM-VTON checkpoint assets and review their upstream terms.

## Python Dependencies

The service uses PyTorch, torchvision, diffusers, transformers, ONNX Runtime, FastAPI, Pillow, OpenCV, SciPy, and other packages. Each package retains its own license. Review the installed distributions and their license files before distribution or commercial deployment.

## Attribution

When displaying or distributing outputs produced with this service, preserve attribution to IDM-VTON and comply with the upstream noncommercial and share-alike terms. Do not imply endorsement by the upstream authors.
