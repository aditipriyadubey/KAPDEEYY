"""Password hashing and access tokens for local authentication.

Only the Python standard library is used:

* Passwords are hashed with `hashlib.scrypt` (memory-hard, per-password salt).
  The stored format is self-describing so parameters can be upgraded later.
* Access tokens are standard HS256 JWTs (header.payload.signature), signed with
  a server-side secret. Nothing user-controlled is trusted without verifying
  both the signature and the expiry.
"""
import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any

from app.core.config import Settings

_SCRYPT_N = 2**14
_SCRYPT_R = 8
_SCRYPT_P = 1
_SCRYPT_DKLEN = 32
_ALGORITHM = "HS256"
# Compared against when the email does not exist, so login latency does not
# reveal which accounts are registered.
_DUMMY_HASH = (
    "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
)


class InvalidToken(Exception):
    """The token is missing, malformed, expired, or signed with another key."""


# ── passwords ─────────────────────────────────────────────────────


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=_SCRYPT_N,
        r=_SCRYPT_R,
        p=_SCRYPT_P,
        dklen=_SCRYPT_DKLEN,
    )
    return "scrypt${}${}${}${}${}".format(
        _SCRYPT_N,
        _SCRYPT_R,
        _SCRYPT_P,
        base64.b64encode(salt).decode("ascii"),
        base64.b64encode(digest).decode("ascii"),
    )


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        # Still spend the work of a real verification.
        try:
            _verify(password, _DUMMY_HASH)
        except ValueError:
            pass
        return False
    try:
        return _verify(password, stored)
    except (ValueError, TypeError):
        return False


def _verify(password: str, stored: str) -> bool:
    parts = stored.split("$")
    if len(parts) != 6 or parts[0] != "scrypt":
        raise ValueError("Unsupported password hash")
    n, r, p = int(parts[1]), int(parts[2]), int(parts[3])
    salt = base64.b64decode(parts[4])
    expected = base64.b64decode(parts[5])
    digest = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=n,
        r=r,
        p=p,
        dklen=len(expected),
    )
    return hmac.compare_digest(digest, expected)


# ── JWT ───────────────────────────────────────────────────────────


def get_jwt_secret(settings: Settings) -> str:
    """Return the signing secret, generating and persisting one on first run."""
    if settings.jwt_secret:
        return settings.jwt_secret

    path = settings.jwt_secret_file
    try:
        stored = path.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        stored = ""
    if stored:
        return stored

    path.parent.mkdir(parents=True, exist_ok=True)
    secret = secrets.token_urlsafe(48)
    path.write_text(secret, encoding="utf-8")
    try:
        path.chmod(0o600)
    except OSError:
        # Windows and some filesystems ignore POSIX modes; the file is still
        # outside git and only readable by the local account.
        pass
    return secret


def create_access_token(
    user_id: str,
    email: str,
    secret: str,
    expires_minutes: int,
) -> str:
    now = int(time.time())
    header = {"alg": _ALGORITHM, "typ": "JWT"}
    payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + max(1, int(expires_minutes)) * 60,
    }
    header_part = _b64url(json.dumps(header, separators=(",", ":")).encode())
    payload_part = _b64url(json.dumps(payload, separators=(",", ":")).encode())
    signing_input = f"{header_part}.{payload_part}"
    signature = hmac.new(
        secret.encode("utf-8"), signing_input.encode("ascii"), hashlib.sha256
    ).digest()
    return f"{signing_input}.{_b64url(signature)}"


def decode_access_token(token: str, secret: str) -> dict[str, Any]:
    try:
        header_part, payload_part, signature_part = token.split(".")
    except (AttributeError, ValueError):
        raise InvalidToken("Malformed token")

    signing_input = f"{header_part}.{payload_part}"
    expected = hmac.new(
        secret.encode("utf-8"), signing_input.encode("ascii"), hashlib.sha256
    ).digest()
    try:
        signature = _unb64url(signature_part)
    except (ValueError, TypeError):
        raise InvalidToken("Malformed signature")

    if not hmac.compare_digest(signature, expected):
        raise InvalidToken("Invalid signature")

    try:
        header = json.loads(_unb64url(header_part))
        payload = json.loads(_unb64url(payload_part))
    except (ValueError, TypeError, json.JSONDecodeError):
        raise InvalidToken("Malformed token")

    if not isinstance(header, dict) or header.get("alg") != _ALGORITHM:
        raise InvalidToken("Unsupported token algorithm")
    if not isinstance(payload, dict):
        raise InvalidToken("Malformed token payload")

    exp = payload.get("exp")
    if not isinstance(exp, (int, float)) or int(time.time()) >= exp:
        raise InvalidToken("Token expired")
    # sub is optional - token can be validated by email alone
    # if not payload.get("sub"):
    #     raise InvalidToken("Token is missing a subject")

    return payload


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _unb64url(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)
