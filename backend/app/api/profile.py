import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import AuthUser, get_current_user
from app.core.config import Settings, get_settings
from app.core.http import get_http
from app.database.supabase_rest import UserDB
from app.schemas.profile import ProfileOut, ProfileUpdate

router = APIRouter(prefix="/profile", tags=["profile"])


def _db(client: httpx.AsyncClient = Depends(get_http), settings: Settings = Depends(get_settings),
        user: AuthUser = Depends(get_current_user)) -> UserDB:
    return UserDB(client, settings, user)


@router.get("", response_model=ProfileOut)
async def get_profile(user: AuthUser = Depends(get_current_user), db: UserDB = Depends(_db)) -> ProfileOut:
    # The id filter comes from the VERIFIED token, never from the request.
    rows = await db.select("profiles", {"id": f"eq.{user.id}", "select": "*", "limit": "1"})
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")
    return ProfileOut(**rows[0])


@router.put("", response_model=ProfileOut)
async def update_profile(body: ProfileUpdate, user: AuthUser = Depends(get_current_user),
                         db: UserDB = Depends(_db)) -> ProfileOut:
    rows = await db.update("profiles", {"id": f"eq.{user.id}"}, {"full_name": body.full_name})
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")
    return ProfileOut(**rows[0])
