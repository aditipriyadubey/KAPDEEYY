from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Anchor the env file to backend/.env so configuration does not depend on the
# process working directory (uvicorn is normally launched from backend/).
_BACKEND_DIR = Path(__file__).resolve().parents[2]
_PROJECT_ROOT = _BACKEND_DIR.parent


class Settings(BaseSettings):
    """Environment-driven configuration (reads backend/.env)."""

    model_config = SettingsConfigDict(
        env_file=_BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    supabase_url: str = ""
    supabase_anon_key: str = ""
    # Server-side only; unused until Phase 3. Never returned by any endpoint.
    supabase_service_role_key: str = Field(default="", repr=False)

    cors_origins: str = "http://localhost:5173"

    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen3-vl:4b"

    # Phase 3B: local AI worker (Python 3.13 env). The Gemini key belongs to the
    # worker only; it is deliberately not a setting here.
    ai_worker_url: str = "http://127.0.0.1:8001"
    ai_worker_token: str = Field(default="", repr=False)
    ai_worker_timeout_seconds: float = 120
    segmentation_weights_path: str = "models/checkpoint_best_total.pth"
    segmentation_threshold: float = 0.25

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_anon_key)

    @property
    def segmentation_weights_file(self) -> Path:
        """Absolute checkpoint path, resolved from the project root."""
        path = Path(self.segmentation_weights_path)
        return path if path.is_absolute() else _PROJECT_ROOT / path


@lru_cache
def get_settings() -> Settings:
    return Settings()
