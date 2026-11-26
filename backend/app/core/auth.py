"""Backend authentication – supports both Supabase and local JWT modes.

The frontend sends the access token as `Authorization: Bearer <jwt>`.

**Supabase mode** (default, unchanged): verifies the token by calling
Supabase Auth (`GET /auth/v1/user`).  The returned `id` is forwarded to
PostgREST so Row Level Security applies.

**Local mode** (Phase 2A): the token is an HS256 JWT issued by the
`/api/auth/login` endpoint.  The JWT `sub` claim is the user id; the
backend forwards it on PostgREST calls just as it would a Supabase token.

The active mode is selected via `settings.database_backend` and
`settings.auth_backend`.  When either is set to `local`, the Supabase
call is skipped and the token is validated locally (HS256) or decoded
from the fastapi `Authorization` header.
"""
import hashlib
import time

from dataclasses import dataclass

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings, get_settings
from app.core.http import get_http
from app.core.security import decode_access_token, get_jwt_secret
from app.database.sqlite_adapter import SQLiteUserDB

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
    """Return the authenticated user, choosing the backend per settings.

    Local mode: validate the Bearer JWT with the local HS256 secret and
    confirm the subject matches a user in the SQLite DB (never trust
    a frontend-supplied id).  Supabase mode preserves existing auth.
    """
    if settings.auth_backend == "local":
        return await _get_current_user_local(creds, settings)

    return await _get_current_user_supabase(creds, client, settings)


# Internal: create a SQLiteUserDB scoped to the authenticated user
def _get_sqlite_db(user_id: str, settings: Settings) -> SQLiteUserDB:
    # sqlite_file is absolute, so uvicorn's working directory never matters.
    return SQLiteUserDB(settings.sqlite_file, user_id, settings)


async def _get_current_user_local(
    creds: HTTPAuthorizationCredentials | None,
    settings: Settings,
) -> AuthUser:
    """Authenticate via local HS256 JWT + SQLite user lookup."""
    if creds is None or not creds.credentials:
        raise _unauthorized()

    token = creds.credentials

    key = hashlib.sha256(token.encode()).hexdigest()
    cached = _cache.get(key)
    if cached and cached[0] > time.monotonic():
        return cached[1]

    secret = get_jwt_secret(settings)
    try:
        payload = decode_access_token(token, secret)
    except Exception:
        raise _unauthorized("Invalid or expired token")

    user_id: str = payload.get("sub") or ""
    email: str | None = payload.get("email")

    if not user_id or not email:
        raise _unauthorized("Invalid token payload")

    sqlite_db = _get_sqlite_db(user_id, settings)
    # Confirm the subject is a real local user so we never trust a
    # frontend-supplied id.
    rows = await sqlite_db.select("users", {"id": f"eq.{user_id}", "select": "id, email", "limit": "1"})
    if not rows:
        raise _unauthorized("User not found")

    user = AuthUser(id=user_id, email=email, token=token)
    if len(_cache) > 1000:
        _cache.clear()
    _cache[key] = (time.monotonic() + _CACHE_TTL_SECONDS, user)
    return user


async def _get_current_user_supabase(
    creds: HTTPAuthorizationCredentials | None,
    client: httpx.AsyncClient,
    settings: Settings,
) -> AuthUser:
    """Authenticate via Supabase Auth (GET /auth/v1/user)."""
    if creds is None or not creds.credentials:
        raise _unauthorized()
    if not settings.supabase_configured:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Server is missing Supabase configuration")

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
