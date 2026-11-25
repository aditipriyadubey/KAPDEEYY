from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProfileOut(BaseModel):
    id: str
    full_name: str
    email: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ProfileUpdate(BaseModel):
    """Only the name is editable. Any other field (e.g. id / user_id) is rejected."""

    model_config = ConfigDict(extra="forbid")

    full_name: str = Field(min_length=1, max_length=100)

    @field_validator("full_name")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("full_name cannot be blank")
        return v
