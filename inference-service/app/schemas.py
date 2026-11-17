from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

JobStatus = Literal["queued", "running", "succeeded", "failed"]
ClothingCategory = Literal["upper_body", "lower_body", "dresses"]


class TryOnRequest(BaseModel):
    human_image: str = Field(..., min_length=1)
    garment_image: str = Field(..., min_length=1)
    garment_description: str = Field(..., min_length=1, max_length=1000)
    category: ClothingCategory = "upper_body"


class JobResponse(BaseModel):
    id: str
    status: JobStatus
    stage: str
    progress: float
    message: str
    error: str | None = None
    processingTimeMs: int | None = None
    createdAt: str
    updatedAt: str
