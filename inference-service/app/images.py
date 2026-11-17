from __future__ import annotations

import base64
import binascii
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

ALLOWED_MEDIA_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}


class ImageInputError(ValueError):
    pass


def decode_image(
    value: str,
    label: str,
    max_bytes: int,
    max_pixels: int,
) -> Image.Image:
    if not isinstance(value, str) or not value.strip():
        raise ImageInputError(f"{label} is required.")

    payload = value.strip()
    if payload.startswith("data:"):
        header, separator, data = payload.partition(",")
        if not separator or ";base64" not in header.lower():
            raise ImageInputError(f"{label} must be a valid base64 data URL.")
        media_type = header[5:].split(";", 1)[0].lower()
        if media_type not in ALLOWED_MEDIA_TYPES:
            raise ImageInputError(f"{label} must be JPEG, PNG, or WebP.")
        payload = data

    payload = "".join(payload.split())
    try:
        raw = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ImageInputError(f"{label} is not valid base64.") from exc

    if not raw:
        raise ImageInputError(f"{label} is empty.")
    if len(raw) > max_bytes:
        raise ImageInputError(
            f"{label} is too large ({len(raw) / (1024 * 1024):.1f} MB); "
            f"the limit is {max_bytes / (1024 * 1024):.0f} MB."
        )

    try:
        with Image.open(BytesIO(raw)) as probe:
            if probe.format not in ALLOWED_FORMATS:
                raise ImageInputError(f"{label} must be JPEG, PNG, or WebP.")
            width, height = probe.size
            if width < 1 or height < 1:
                raise ImageInputError(f"{label} has invalid dimensions.")
            if width * height > max_pixels:
                raise ImageInputError(f"{label} has too many pixels.")

        with Image.open(BytesIO(raw)) as opened:
            image = ImageOps.exif_transpose(opened)
            if image.mode in {"RGBA", "LA", "P"}:
                rgba = image.convert("RGBA")
                background = Image.new("RGB", rgba.size, (255, 255, 255))
                background.paste(rgba, mask=rgba.getchannel("A"))
                image = background
            else:
                image = image.convert("RGB")
            image.load()
            return image.copy()
    except ImageInputError:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise ImageInputError(f"{label} could not be decoded as an image.") from exc
