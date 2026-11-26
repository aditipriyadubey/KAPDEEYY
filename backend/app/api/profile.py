import httpx
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import AuthUser, get_current_user
from app.core.config import Settings, get_settings
from app.core.http import get_http
from app.database.sqlite_adapter import SQLiteUserDB, _make_sqlite_db
from app.database.supabase_rest import UserDB
from app.schemas.profile import ProfileOut, ProfileUpdate

router = APIRouter(prefix="/profile", tags=["profile"])


def _db(client: httpx.AsyncClient | None = Depends(get_http),
        settings: Settings = Depends(get_settings),
        user: AuthUser = Depends(get_current_user)) -> SQLiteUserDB | UserDB:
    """Return a SQLiteUserDB when local mode is active, otherwise the
    original Supabase UserDB."""
    # ── Local / SQLite mode ────────────────────────────────────
    if settings.database_backend == "sqlite" or settings.auth_backend == "local":
        db_path = Path(settings.sqlite_file)
        return SQLiteUserDB(db_path, user.id, settings)
    # ── Supabase mode (original) ───────────────────────────────
    if client is None:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR,
                            "HTTP client required for Supabase mode")
    return UserDB(client, settings, user)


@router.get("", response_model=ProfileOut)
async def get_profile(user: AuthUser = Depends(get_current_user), db: SQLiteUserDB | UserDB = Depends(_db)) -> ProfileOut:
    # The id filter comes from the VERIFIED token, never from the request.
    rows = await db.select("profiles", {"id": f"eq.{user.id}", "select": "*", "limit": "1"})
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")
    return ProfileOut(**rows[0])


@router.put("", response_model=ProfileOut)
async def update_profile(body: ProfileUpdate, user: AuthUser = Depends(get_current_user),
                         db: SQLiteUserDB | UserDB = Depends(_db)) -> ProfileOut:
    rows = await db.update("profiles", {"id": f"eq.{user.id}"}, {"full_name": body.full_name})
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")
    return ProfileOut(**rows[0])
