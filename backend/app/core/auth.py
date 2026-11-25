"""Backend authentication.

The frontend sends the Supabase access token as `Authorization: Bearer <jwt>`.
We verify it by asking Supabase Auth (`GET /auth/v1/user`), which works for both
legacy HS256 and newer asymmetric signing keys and also rejects revoked sessions.
The verified user id is the ONLY identity the backend trusts — any user_id sent in
a request body or query string is ignored.
"""
import hashlib
import time
from dataclasses import dataclass

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings, get_settings
from app.core.http import get_http

_bearer = HTTPBearer(auto_error=False)
_CACHE_TTL_SECONDS = 30
_cache: dict[str, tuple[float, "AuthUser"]] = {}


@dataclass(frozen=True)
class AuthUser:
    id: str
    email: str | None
    token: str  # forwarded to PostgREST so Row Level Security applies


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, detail, headers={"WWW-Authenticate": "Bearer"})


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    client: httpx.AsyncClient = Depends(get_http),
    settings: Settings = Depends(get_settings),
) -> AuthUser:
    if not settings.supabase_configured:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Server is missing Supabase configuration")
    if creds is None or not creds.credentials:
        raise _unauthorized()

    token = creds.credentials
    key = hashlib.sha256(token.encode()).hexdigest()
    hit = _cache.get(key)
    if hit and hit[0] > time.monotonic():
        return hit[1]

    try:
        resp = await client.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {token}"},
        )
    except httpx.HTTPError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Authentication service unreachable")

    if resp.status_code != 200:
        raise _unauthorized("Invalid or expired token")

    body = resp.json()
    user_id = body.get("id")
    if not user_id:
        raise _unauthorized("Invalid token payload")

    user = AuthUser(id=user_id, email=body.get("email"), token=token)
    if len(_cache) > 1000:
        _cache.clear()
    _cache[key] = (time.monotonic() + _CACHE_TTL_SECONDS, user)
    return user


def clear_auth_cache() -> None:
    _cache.clear()
