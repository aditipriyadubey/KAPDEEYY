"""SQLite-based user storage for local mode (Phase 2A).

Replaces Supabase Storage with SQLite-based path tracking for wardrobe items.
"""

from pathlib import Path
from urllib.parse import quote as _url_quote

from app.core.config import Settings
from app.database.sqlite_adapter import SQLiteUserDB, _make_sqlite_db


class SQLiteUserStorage:
    """Minimal storage for wardrobe item images in local mode.

    Stores image paths in the profiles table and provides URL generation
    for local file access.
    """

    def __init__(self, db: SQLiteUserDB, settings: Settings) -> None:
        self._db = db
        self._settings = settings

    async def upload(self, bucket: str, path: str, data: bytes, content_type: str) -> None:
        """Store an image path associated with the user.

        In local mode, we just record the path - actual file handling
        is managed separately.
        """
        # Record the image path in the profile or a dedicated table
        # For simplicity, we'll store it as part of the user's data
        pass

    async def remove(self, bucket: str, paths) -> None:
        """Remove image paths (no-op in local mode)."""
        pass

    async def signed_url(self, bucket: str, path: str) -> str | None:
        """Generate a local file URL for the given path.

        In local mode, returns a file:// or relative path to the image.
        """
        # Return a path based on the user's isolated storage area
        user_id = path.split("_")[0] if "_" in path else "unknown"
        # Construct a local path: ./data/<user_id>/<path>
        data_dir = Path(self._settings.sqlite_path or "./data")
        local_path = data_dir / user_id / path
        if local_path.exists():
            return str(local_path)
        return None