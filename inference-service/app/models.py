from __future__ import annotations

from dataclasses import dataclass

from PIL import Image


@dataclass(frozen=True)
class TryOnInput:
    human_image: Image.Image
    garment_image: Image.Image
    garment_description: str
    category: str
