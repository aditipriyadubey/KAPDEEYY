"""Local authentication endpoints (Phase 2A).

POST /api/auth/register  - create a user with a hashed password
POST /api/auth/login     - verify credentials and issue a JWT
GET  /api/auth/me        - return the authenticated user's profile
"""

import sqlite3
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.auth import AuthUser, get_current_user
from app.core.config import Settings, get_settings
from app.core.security import create_access_token, get_jwt_secret, hash_password
from app.database.sqlite_adapter import SQLiteUserDB
from app.schemas.auth import LoginIn, LoginOut, MeOut, RegisterIn, RegisterOut

router = APIRouter(prefix="/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=False)


def _db(user_id: str, settings: Settings) -> SQLiteUserDB:
    return SQLiteUserDB(Path(settings.sqlite_file), user_id, settings)


@router.post("/register", response_model=RegisterOut, status_code=201)
async def register(
    body: RegisterIn,
    settings: Settings = Depends(get_settings),
) -> RegisterOut:
    """Create a new local user. Passwords are stored as scrypt hashes."""
    email = body.email.strip().lower()
    user_id = str(uuid4())

    db = _db(user_id, settings)
    existing = await db.select_unscoped("users", {"select": "id", "email": f"eq.{email}", "limit": "1"})
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")

    try:
        await db.insert(
            "users",
            {
                "id": user_id,
                "user_id": user_id,
                "email": email,
                "password_hash": hash_password(body.password),
            },
        )
    except sqlite3.IntegrityError as exc:
        # Only a UNIQUE violation means the email is taken. Any other failure
        # must surface as a server error instead of a misleading 409.
        raise HTTPException(
            status.HTTP_409_CONFLICT, "An account with this email already exists."
        ) from exc
    except Exception as exc:  # noqa: BLE001 - surface the real failure
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Could not create the account. Please try again.",
        ) from exc

    try:
        await db.insert(
            "profiles",
            {"id": user_id, "user_id": user_id, "full_name": body.full_name, "email": email},
        )
    except Exception as exc:  # noqa: BLE001 - do not leave a half-created account
        try:
            await db.delete("users", {"id": f"eq.{user_id}"})
        except Exception:  # noqa: BLE001 - best effort cleanup
            pass
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Could not create the account. Please try again.",
        ) from exc

    row = (await db.select("users", {"select": "*", "id": f"eq.{user_id}", "limit": "1"}))[0]
    return RegisterOut(
        id=user_id,
        email=email,
        full_name=body.full_name,
        created_at=row.get("created_at") or "",
    )


@router.post("/login", response_model=LoginOut)
async def login(
    body: LoginIn,
    settings: Settings = Depends(get_settings),
) -> LoginOut:
    """Verify credentials and return a signed JWT access token."""
    from app.core.security import verify_password

    email = body.email.strip().lower()
    db = _db("0" * 32, settings)
    rows = await db.select_unscoped(
        "users",
        {"select": "id, user_id, email, password_hash", "email": f"eq.{email}", "limit": "1"},
    )

    if not rows or not verify_password(body.password, rows[0].get("password_hash")):
        # Same message for unknown email and wrong password.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")

    user = rows[0]
    if not user.get("id"):
        # A corrupt legacy row cannot be represented in a token.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")

    token = create_access_token(
        user_id=user["id"],
        email=user["email"],
        secret=get_jwt_secret(settings),
        expires_minutes=settings.jwt_expires_minutes,
    )
    return LoginOut(access_token=token, expires_in=settings.jwt_expires_minutes)


@router.get("/me", response_model=MeOut)
async def me(
    user: AuthUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> MeOut:
    """Return the authenticated user (token already verified by get_current_user)."""
    rows = await _db(user.id, settings).select(
        "profiles", {"select": "*", "id": f"eq.{user.id}", "limit": "1"}
    )
    full_name = rows[0].get("full_name") if rows else None
    return MeOut(id=user.id, email=user.email, full_name=full_name)
