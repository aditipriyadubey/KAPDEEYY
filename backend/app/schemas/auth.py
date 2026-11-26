"""Authentication request/response schemas for local email+password mode."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class RegisterIn(BaseModel):
    """Input for user sign-up."""

    full_name: str = Field(min_length=1, max_length=100)
    email: str
    password: str

    @field_validator("password")
    @classmethod
    def _password_min_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v

    @field_validator("email")
    @classmethod
    def _email_format(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v:
            raise ValueError("Invalid email address")
        return v


class RegisterOut(BaseModel):
    """Output for successful registration."""

    id: str
    email: str
    full_name: str
    created_at: datetime


class LoginIn(BaseModel):
    """Input for user sign-in."""

    email: str
    password: str


class LoginOut(BaseModel):
    """Output for successful login – contains the JWT access token."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int  # minutes


class MeOut(BaseModel):
    """Output for GET /api/auth/me."""

    id: str
    email: str | None
    full_name: str | None