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

    # ── Local-first mode (Phase 2A) ───────────────────────────────
    # Defaults to supabase for backward compatibility.
    # Set both to `sqlite`/`local` to run fully offline with no Supabase.
    # Set both to `supabase` to use the hosted stack; the Supabase adapters
    # are kept intact for that purpose.
    database_backend: str = "sqlite"  # sqlite | supabase
    auth_backend: str = "local"  # local | supabase
    sqlite_path: str = "data/kapdeeyy.db"
    uploads_path: str = "data/uploads"
    # Empty means "generate once and keep it in backend/.local/jwt_secret".
    jwt_secret: str = Field(default="", repr=False)
    jwt_expires_minutes: int = 60 * 24 * 7

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

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
        """Configured origins, plus their localhost/127.0.0.1 equivalent.

        A browser treats http://localhost:5173 and http://127.0.0.1:5173 as
        different origins. Whichever one was configured, the other is allowed
        too so opening the dev server by IP address does not look like a
        network failure.
        """
        origins: list[str] = []
        for raw in self.cors_origins.split(","):
            origin = raw.strip().rstrip("/")
            if not origin or origin in origins:
                continue
            origins.append(origin)
            if "://localhost" in origin:
                twin = origin.replace("://localhost", "://127.0.0.1", 1)
            elif "://127.0.0.1" in origin:
                twin = origin.replace("://127.0.0.1", "://localhost", 1)
            else:
                twin = ""
            if twin and twin not in origins:
                origins.append(twin)
        return origins

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_anon_key)

    @property
    def segmentation_weights_file(self) -> Path:
        """Absolute checkpoint path, resolved from the project root."""
        path = Path(self.segmentation_weights_path)
        return path if path.is_absolute() else _PROJECT_ROOT / path

    @property
    def sqlite_file(self) -> Path:
        """Absolute SQLite path, resolved from backend/ so cwd does not matter."""
        path = Path(self.sqlite_path)
        return path if path.is_absolute() else _BACKEND_DIR / path

    @property
    def jwt_secret_file(self) -> Path:
        return _BACKEND_DIR / ".local" / "jwt_secret"

    @property
    def uploads_dir(self) -> Path:
        """Root for user-uploaded originals and segmentation cutouts."""
        path = Path(self.uploads_path)
        return path if path.is_absolute() else _BACKEND_DIR / path


@lru_cache
def get_settings() -> Settings:
    return Settings()
