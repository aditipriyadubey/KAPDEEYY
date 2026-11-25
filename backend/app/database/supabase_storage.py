"""Minimal Supabase Storage client that acts as the signed-in user.

Every request forwards the user's JWT, so the per-user folder policies in
database/migrations/003_storage.sql enforce ownership even if this module
contains a bug. Object paths are always built by the backend as
`<user id>/<filename>`; paths supplied by the browser are validated with
`is_owned_path()` before they are signed or deleted.
"""
import logging
from typing import Iterable
from urllib.parse import quote

import httpx
from fastapi import HTTPException, status

from app.core.auth import AuthUser
from app.core.config import Settings

logger = logging.getLogger(__name__)

ORIGINAL_BUCKET = "wardrobe-original"
SEGMENTED_BUCKET = "wardrobe-segmented"
SIGNED_URL_TTL_SECONDS = 3600


def is_owned_path(path: str | None, user_id: str) -> bool:
    """True when `path` is exactly `<user_id>/<filename>` with no traversal."""
    if not isinstance(path, str) or not path:
        return False
    if path.startswith("/") or "\\" in path:
        return False
    parts = path.split("/")
    return len(parts) == 2 and parts[0] == user_id and bool(parts[1]) and ".." not in parts


class UserStorage:
    def __init__(
        self,
        client: httpx.AsyncClient,
        settings: Settings,
        user: AuthUser,
    ) -> None:
        self._client = client
        self._base = f"{settings.supabase_url}/storage/v1"
        self._headers = {
            "apikey": settings.supabase_anon_key,
            "Authorization": f"Bearer {user.token}",
        }

    @staticmethod
    def _object_path(path: str) -> str:
        return quote(path, safe="/")

    async def upload(
        self,
        bucket: str,
        path: str,
        data: bytes,
        content_type: str,
    ) -> None:
        try:
            resp = await self._client.post(
                f"{self._base}/object/{bucket}/{self._object_path(path)}",
                content=data,
                headers={
                    **self._headers,
                    "Content-Type": content_type,
                    "x-upsert": "false",
                },
            )
        except httpx.HTTPError:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "Image storage is unreachable",
            )

        if resp.status_code >= 400:
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY,
                "Could not upload the image to storage",
            )

    async def remove(self, bucket: str, paths: Iterable[str]) -> None:
        paths = [path for path in paths if path]
        if not paths:
            return

        try:
            resp = await self._client.request(
                "DELETE",
                f"{self._base}/object/{bucket}",
                json={"prefixes": paths},
                headers={
                    **self._headers,
                    "Content-Type": "application/json",
                },
            )
        except httpx.HTTPError:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "Image storage is unreachable",
            )

        if resp.status_code >= 400:
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY,
                "Could not remove the image from storage",
            )

    async def download(self, bucket: str, path: str) -> bytes | None:
        """Fetch a private object as the signed-in user.

        Returns None when the object does not exist, so callers can distinguish
        a missing upload from an outage without leaking storage internals.
        """
        try:
            resp = await self._client.get(
                f"{self._base}/object/{bucket}/{self._object_path(path)}",
                headers=self._headers,
            )
        except httpx.HTTPError:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "Image storage is unreachable",
            )

        if resp.status_code == 404:
            return None
        if resp.status_code in (401, 403):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "You cannot read this image",
            )
        if resp.status_code >= 400:
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY,
                "Could not read the image from storage",
            )
        return resp.content

    async def signed_url(
        self,
        bucket: str,
        path: str,
        expires_in: int = SIGNED_URL_TTL_SECONDS,
    ) -> str | None:
        """Return a temporary URL, or None when the object cannot be signed."""
        try:
            resp = await self._client.post(
                f"{self._base}/object/sign/{bucket}/{self._object_path(path)}",
                json={"expiresIn": expires_in},
                headers={
                    **self._headers,
                    "Content-Type": "application/json",
                },
            )
        except httpx.HTTPError:
            logger.warning("Storage unreachable while signing %s/%s", bucket, path)
            return None

        if resp.status_code >= 400:
            logger.warning(
                "Could not sign %s/%s (status %s)", bucket, path, resp.status_code
            )
            return None

        try:
            signed = resp.json().get("signedURL")
        except ValueError:
            signed = None

        if not signed:
            return None
        if signed.startswith("http://") or signed.startswith("https://"):
            return signed
        return f"{self._base}{signed}"
