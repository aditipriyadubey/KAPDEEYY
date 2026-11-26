"""Authenticated media endpoint for locally stored wardrobe images.

Images cannot be served by a static mount because one user must never see
another user's photos. The browser loads `<img src="/api/media/<bucket>/<path>?token=...">`;
this route re-verifies the JWT and the `<user_id>/` path prefix before serving
the file.
"""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings, get_settings
from app.core.security import decode_access_token, get_jwt_secret
from app.database.local_storage import _BUCKET_DIRS
from app.database.sqlite_adapter import SQLiteUserDB
from app.database.supabase_storage import is_owned_path

router = APIRouter(prefix="/media", tags=["media"])
_bearer = HTTPBearer(auto_error=False)

_MEDIA_TYPES = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}


@router.get("/{bucket}/{path:path}")
async def get_media(
    bucket: str,
    path: str,
    request: Request,
    token: str | None = None,
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    settings: Settings = Depends(get_settings),
):
    if bucket not in _BUCKET_DIRS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image not found")

    raw = token or (creds.credentials if creds else "")
    if not raw:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")

    try:
        payload = decode_access_token(raw, get_jwt_secret(settings))
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")

    user_id = payload.get("sub") or ""
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token payload")

    if not is_owned_path(path, user_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image not found")

    # Confirm the token still maps to a real local user.
    rows = await SQLiteUserDB(settings.sqlite_file, user_id, settings).select(
        "users", {"select": "id", "id": f"eq.{user_id}", "limit": "1"}
    )
    if not rows:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")

    _, filename = path.split("/", 1)
    target = settings.uploads_dir / user_id / _BUCKET_DIRS[bucket] / filename
    if not target.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image not found")

    return FileResponse(
        target,
        media_type=_MEDIA_TYPES.get(Path(filename).suffix.lower(), "application/octet-stream"),
    )
