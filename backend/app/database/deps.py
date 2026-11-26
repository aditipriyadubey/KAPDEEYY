"""Request-scoped database / storage dependencies.

Local mode uses SQLite + local disk; Supabase mode keeps the original PostgREST
and Storage clients. The choice is driven only by settings, so Supabase remains
an explicit rollback (set DATABASE_BACKEND=supabase, AUTH_BACKEND=supabase).
"""
from __future__ import annotations

import httpx
from fastapi import Depends, HTTPException, status

from app.core.auth import AuthUser, get_current_user
from app.core.config import Settings, get_settings
from app.core.http import get_http
from app.database.local_storage import LocalUserStorage
from app.database.sqlite_adapter import SQLiteUserDB


def local_mode(settings: Settings) -> bool:
    return settings.database_backend == "sqlite" or settings.auth_backend == "local"


def get_db(
    client: httpx.AsyncClient = Depends(get_http),
    settings: Settings = Depends(get_settings),
    user: AuthUser = Depends(get_current_user),
) -> SQLiteUserDB | object:
    if local_mode(settings):
        return SQLiteUserDB(settings.sqlite_file, user.id, settings)
    from app.database.supabase_rest import UserDB

    return UserDB(client, settings, user)


def get_storage(
    client: httpx.AsyncClient = Depends(get_http),
    settings: Settings = Depends(get_settings),
    user: AuthUser = Depends(get_current_user),
) -> LocalUserStorage | object:
    if local_mode(settings):
        return LocalUserStorage(settings, user.id, user.token)
    from app.database.supabase_storage import UserStorage

    if client is None:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "HTTP client required")
    return UserStorage(client, settings, user)
