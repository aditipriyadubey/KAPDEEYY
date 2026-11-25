"""Response schemas for Phase 3B AI endpoints."""

from typing import Any

from pydantic import BaseModel, Field

from app.schemas.wardrobe import WardrobeItemOut


class AnalyzeSuggestion(BaseModel):
    """Values the user may apply manually; the stored row is not overwritten."""

    item_name: str | None = None
    category: str
    subcategory: str | None = None
    colour: str | None = None
    style: str | None = None
    # No `condition` columns exist in the database yet; these are suggestions.
    condition: str | None = None
    condition_note: str | None = None


class DetectionInfo(BaseModel):
    label: str | None = None
    confidence: float | None = None


class WardrobeAnalyzeOut(BaseModel):
    item: WardrobeItemOut
    suggestions: AnalyzeSuggestion
    detection: DetectionInfo = Field(default_factory=DetectionInfo)
    classification_source: str | None = None
    privacy_notice: str


class AIStatusOut(BaseModel):
    status: str
    checkpoint_available: bool
    worker_available: bool
    rfdetr_ready: bool
    model_loaded: bool = False
    cuda_available: bool = False
    gemini_configured: bool = False
    detail: dict[str, Any] | None = None
