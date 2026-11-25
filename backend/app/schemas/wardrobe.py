
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


Category = Literal[
    "Tops", "Bottoms", "Dresses", "Outerwear",
    "Shoes", "Bags", "Other",
]

Occasion = Literal["College", "Casual", "Dinner", "Party"]

Season = Literal["Spring", "Summer", "Autumn", "Winter", "All-season"]


class WardrobeItemFields(BaseModel):
    item_name: str = Field(min_length=1, max_length=80)
    category: Category
    subcategory: str | None = None
    colour: str | None = None
    colour_hex: str | None = None
    pattern: str | None = None
    style: str | None = None
    suggested_occasions: list[Occasion] = Field(default_factory=list)
    season: Season | None = None

    @field_validator("item_name")
    @classmethod
    def clean_item_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Item name cannot be blank")
        return value

    @field_validator("colour_hex")
    @classmethod
    def validate_colour_hex(cls, value: str | None) -> str | None:
        if value is not None and not __import__("re").fullmatch(
            r"#[0-9A-Fa-f]{6}", value
        ):
            raise ValueError("Colour must be a valid hex colour")
        return value


class WardrobeItemCreate(WardrobeItemFields):
    model_config = ConfigDict(extra="forbid")

    # Path returned by POST /wardrobe/upload. The route verifies that it sits in
    # the authenticated user's folder before saving it.
    original_image_path: str | None = None


class WardrobeItemUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    item_name: str | None = Field(default=None, min_length=1, max_length=80)
    category: Category | None = None
    subcategory: str | None = None
    colour: str | None = None
    colour_hex: str | None = None
    pattern: str | None = None
    style: str | None = None
    suggested_occasions: list[Occasion] | None = None
    season: Season | None = None

    @field_validator("item_name")
    @classmethod
    def clean_item_name(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("Item name cannot be blank")
        return value

    @field_validator("colour_hex")
    @classmethod
    def validate_colour_hex(cls, value: str | None) -> str | None:
        if value is not None and not __import__("re").fullmatch(
            r"#[0-9A-Fa-f]{6}", value
        ):
            raise ValueError("Colour must be a valid hex colour")
        return value


class WardrobeItemOut(WardrobeItemFields):
    id: str
    user_id: str
    original_image_path: str | None = None
    segmented_image_path: str | None = None
    segmentation_status: str
    created_at: datetime
    updated_at: datetime
    # Temporary signed URL computed per request; never stored in the database.
    image_url: str | None = None
