
"""Minimal PostgREST client that acts as the signed-in user."""
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.core.auth import AuthUser
from app.core.config import Settings


class UserDB:
    def __init__(self, client: httpx.AsyncClient, settings: Settings, user: AuthUser) -> None:
        self._client = client
        self._base = f"{settings.supabase_url}/rest/v1"
        self._headers = {
            "apikey": settings.supabase_anon_key,
            "Authorization": f"Bearer {user.token}",
            "Content-Type": "application/json",
        }

    async def _request(
        self,
        method: str,
        table: str,
        *,
        params: dict[str, str] | None = None,
        json: Any = None,
        prefer: str | None = None,
    ) -> list[dict[str, Any]]:
        headers = dict(self._headers)
        if prefer:
            headers["Prefer"] = prefer

        try:
            resp = await self._client.request(
                method,
                f"{self._base}/{table}",
                params=params,
                json=json,
                headers=headers,
            )
        except httpx.HTTPError:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "Database unreachable",
            )

        if resp.status_code >= 400:
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY,
                "Database request failed",
            )

        return resp.json() if resp.content else []

    async def select(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        return await self._request("GET", table, params=params)

    async def insert(self, table: str, values: dict[str, Any]) -> list[dict[str, Any]]:
        return await self._request(
            "POST", table, json=values, prefer="return=representation"
        )

    async def update(
        self,
        table: str,
        params: dict[str, str],
        values: dict[str, Any],
    ) -> list[dict[str, Any]]:
        return await self._request(
            "PATCH", table, params=params, json=values,
            prefer="return=representation",
        )

    async def delete(
        self,
        table: str,
        params: dict[str, str],
    ) -> list[dict[str, Any]]:
        return await self._request(
            "DELETE", table, params=params,
            prefer="return=representation",
        )