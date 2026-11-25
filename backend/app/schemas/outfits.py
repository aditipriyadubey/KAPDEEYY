from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Occasion = Literal["College", "Casual", "Dinner", "Party"]


class OutfitCreate(BaseModel):
    outfit_name: str = Field(min_length=1, max_length=120)
    occasion: Occasion | None = None
    recommendation_score: float | None = Field(default=None, ge=0, le=100)
    styling_explanation: str | None = None
    wardrobe_item_ids: list[str] = Field(min_length=1)


class OutfitItemOut(BaseModel):
    id: str
    item_name: str
    category: str
    subcategory: str | None = None
    colour: str | None = None
    colour_hex: str | None = None
    pattern: str | None = None
    style: str | None = None
    original_image_path: str | None = None
    segmented_image_path: str | None = None
    segmentation_status: str


class OutfitOut(BaseModel):
    id: str
    outfit_name: str
    occasion: Occasion | None = None
    recommendation_score: float | None = None
    styling_explanation: str | None = None
    items: list[OutfitItemOut] = Field(default_factory=list)


class SavedOutfitOut(OutfitOut):
    saved_at: datetime
    worn: bool = False
    last_worn_at: datetime | None = None


class WearHistoryOut(BaseModel):
    id: str
    worn_at: datetime
    occasion: Occasion | None = None
    outfit: OutfitOut
    recently_worn: bool = False
    repeated: bool = False
    repeat_count: int = 1
