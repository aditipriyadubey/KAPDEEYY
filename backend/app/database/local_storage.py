"""Local disk storage for wardrobe images (local-first mode).

Files live under backend/data/uploads/<user_id>/{originals,segmented}/.
Only validated `<user_id>/<filename>` paths are accepted, so one user can never
read or write another user's files. The database stores relative paths, never
base64 blobs, and files survive backend restarts.
"""
from __future__ import annotations

from pathlib import Path
from typing import Iterable

from fastapi import HTTPException, status

from app.core.config import Settings
from app.database.supabase_storage import (
    ORIGINAL_BUCKET,
    SEGMENTED_BUCKET,
    is_owned_path,
)

_BUCKET_DIRS = {
    ORIGINAL_BUCKET: "originals",
    SEGMENTED_BUCKET: "segmented",
}


class LocalUserStorage:
    def __init__(self, settings: Settings, user_id: str, token: str) -> None:
        self._settings = settings
        self._user_id = user_id
        self._token = token

    def _file(self, bucket: str, path: str) -> Path:
        if bucket not in _BUCKET_DIRS:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown image bucket")
        if not is_owned_path(path, self._user_id):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You cannot access this image")
        _, filename = path.split("/", 1)
        return self._settings.uploads_dir / self._user_id / _BUCKET_DIRS[bucket] / filename

    async def upload(self, bucket: str, path: str, data: bytes, content_type: str) -> None:
        target = self._file(bucket, path)
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        except OSError as exc:
            raise HTTPException(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                "Could not save the image locally",
            ) from exc

    async def download(self, bucket: str, path: str) -> bytes | None:
        target = self._file(bucket, path)
        try:
            return target.read_bytes()
        except FileNotFoundError:
            return None
        except OSError as exc:
            raise HTTPException(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                "Could not read the image",
            ) from exc

    async def remove(self, bucket: str, paths: Iterable[str]) -> None:
        for path in paths:
            if not path:
                continue
            target = self._file(bucket, path)
            try:
                target.unlink(missing_ok=True)
            except OSError:
                pass

    async def signed_url(self, bucket: str, path: str, expires_in: int = 3600) -> str | None:
        """Return a URL the browser can load; the media route re-verifies ownership."""
        if bucket not in _BUCKET_DIRS or not is_owned_path(path, self._user_id):
            return None
        if not self._file(bucket, path).is_file():
            return None
        from urllib.parse import quote

        return f"/api/media/{quote(bucket)}/{quote(path, safe='/')}?token={quote(self._token)}"
