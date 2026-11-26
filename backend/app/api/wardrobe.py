import asyncio
import base64
import logging
import sqlite3
from uuid import UUID, uuid4

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.core.auth import AuthUser, get_current_user
from app.core.config import Settings, get_settings
from app.core.http import get_http
from app.database.deps import get_db, get_storage
from app.database.supabase_rest import UserDB  # type hints only
from app.database.supabase_storage import (  # type hints + shared constants
    ORIGINAL_BUCKET,
    SEGMENTED_BUCKET,
    UserStorage,
    is_owned_path,
)
from app.schemas.ai import (
    AnalyzeSuggestion,
    DetectionInfo,
    WardrobeAnalyzeOut,
)
from app.schemas.wardrobe import (
    WardrobeItemCreate,
    WardrobeItemOut,
    WardrobeItemUpdate,
)
from app.services.ai import (
    AIWorkerClient,
    AIWorkerError,
    build_suggestions,
    get_ai_worker,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/wardrobe", tags=["wardrobe"])

MAX_IMAGE_BYTES = 10 * 1024 * 1024
PRIVACY_NOTICE = (
    "Your photo is segmented locally by RF-DETR and the garment cutout is sent "
    "to Google Gemini for classification. Nothing is sent to Gemini when the AI "
    "worker is not configured with a Gemini API key."
)


def _db(db=Depends(get_db)):
    """SQLite in local mode, PostgREST in Supabase mode."""
    return db


def _storage(storage=Depends(get_storage)):
    """Local disk in local mode, Supabase Storage in Supabase mode."""
    return storage


def _detect_image(data: bytes) -> tuple[str, str] | None:
    """Identify JPEG/PNG/WebP from the file signature, not the client header."""
    if data.startswith(b"\xff\xd8\xff"):
        return ".jpg", "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png", "image/png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp", "image/webp"
    return None


def _display_target(row: dict, user_id: str) -> tuple[str, str] | None:
    """Pick the image to show: the cutout when present, else the original."""
    segmented = row.get("segmented_image_path")
    if is_owned_path(segmented, user_id):
        return SEGMENTED_BUCKET, segmented

    original = row.get("original_image_path")
    if is_owned_path(original, user_id):
        return ORIGINAL_BUCKET, original

    return None


async def _with_image(
    storage: UserStorage,
    row: dict,
    user_id: str,
) -> dict:
    target = _display_target(row, user_id)
    image_url = await storage.signed_url(target[0], target[1]) if target else None
    return {**row, "image_url": image_url}


async def _with_images(
    storage: UserStorage,
    rows: list[dict],
    user_id: str,
) -> list[dict]:
    targets = [_display_target(row, row.get("user_id") or user_id) for row in rows]

    async def sign(target: tuple[str, str] | None) -> str | None:
        if target is None:
            return None
        return await storage.signed_url(target[0], target[1])

    urls = await asyncio.gather(*(sign(target) for target in targets))
    return [{**row, "image_url": url} for row, url in zip(rows, urls)]


def _decode_cutout(encoded: str) -> bytes | None:
    """Accept only a real PNG produced by the worker, never arbitrary data."""
    try:
        data = base64.b64decode(encoded, validate=True)
    except (ValueError, TypeError):
        return None
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        return None
    if len(data) > MAX_IMAGE_BYTES:
        return None
    return data


async def _mark_segmentation_failed(db: UserDB, item_id: UUID, user_id: str) -> None:
    """Best-effort status update; never hides the original failure."""
    try:
        await db.update(
            "wardrobe_items",
            {"id": f"eq.{item_id}", "user_id": f"eq.{user_id}"},
            {"segmentation_status": "failed"},
        )
    except HTTPException:
        logger.warning("Could not mark wardrobe item %s as failed", item_id)


async def _rollback_upload(storage: UserStorage, path: str) -> None:
    """Best-effort removal of a freshly uploaded file when the insert fails."""
    try:
        await storage.remove(ORIGINAL_BUCKET, [path])
    except HTTPException:
        # The original create error is the one the user needs to see.
        logger.warning("Could not clean up uploaded image after a failed insert")


@router.get("", response_model=list[WardrobeItemOut])
async def get_wardrobe(
    user: AuthUser = Depends(get_current_user),
    db: UserDB = Depends(_db),
    storage: UserStorage = Depends(_storage),
):
    rows = await db.select(
        "wardrobe_items",
        {
            "select": "*",
            "user_id": f"eq.{user.id}",
            "order": "created_at.desc",
        },
    )
    return await _with_images(storage, rows, user.id)


@router.post(
    "/upload",
    status_code=status.HTTP_201_CREATED,
)
async def upload_wardrobe_image(
    file: UploadFile = File(...),
    user: AuthUser = Depends(get_current_user),
    storage: UserStorage = Depends(_storage),
):
    """Store a validated original in the user's own Storage folder."""
    data = await file.read(MAX_IMAGE_BYTES + 1)

    if not data:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "The image file is empty",
        )

    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE,
            "Image must be 10 MB or smaller",
        )

    detected = _detect_image(data)
    if detected is None:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "Only JPEG, PNG or WebP images are allowed",
        )

    extension, content_type = detected
    # The folder comes from the verified token, never from the request, and RLS
    # additionally rejects writes outside <user_id>/.
    path = f"{user.id}/{uuid4().hex}{extension}"

    await storage.upload(ORIGINAL_BUCKET, path, data, content_type)
    image_url = await storage.signed_url(ORIGINAL_BUCKET, path)

    return {
        "bucket": ORIGINAL_BUCKET,
        "path": path,
        "image_url": image_url,
    }


@router.post(
    "",
    response_model=WardrobeItemOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_wardrobe_item(
    body: WardrobeItemCreate,
    user: AuthUser = Depends(get_current_user),
    db: UserDB = Depends(_db),
    storage: UserStorage = Depends(_storage),
):
    values = body.model_dump()
    original_path = values.get("original_image_path")
    image_url = None

    if original_path:
        if not is_owned_path(original_path, user.id):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Invalid image path",
            )

        image_url = await storage.signed_url(ORIGINAL_BUCKET, original_path)
        if image_url is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "The uploaded image could not be found",
            )

    values["user_id"] = user.id
    values["segmentation_status"] = "pending"

    try:
        rows = await db.insert("wardrobe_items", values)
    except sqlite3.IntegrityError as exc:
        # A rejected value (bad colour, unknown category, ...) is the caller's
        # input problem. Surface it instead of letting it become a blank 500.
        if original_path:
            await _rollback_upload(storage, original_path)
        logger.warning("Wardrobe insert rejected: %s", exc)
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "One of the item details is not valid. Check the name, category and colour.",
        ) from exc
    except HTTPException:
        if original_path:
            await _rollback_upload(storage, original_path)
        raise
    except sqlite3.OperationalError as exc:
        if original_path:
            await _rollback_upload(storage, original_path)
        # A locked/busy database is a server condition, not a bad request.
        logger.exception("Could not save wardrobe item")
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "The wardrobe database is busy. Please try again in a moment.",
        ) from exc

    if not rows:
        if original_path:
            await _rollback_upload(storage, original_path)
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "Could not create wardrobe item",
        )

    return {**rows[0], "image_url": image_url}


@router.delete("/upload")
async def discard_wardrobe_upload(
    path: str,
    user: AuthUser = Depends(get_current_user),
    storage: UserStorage = Depends(_storage),
):
    """Roll back an uploaded file when saving its metadata failed."""
    if not is_owned_path(path, user.id):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Invalid image path",
        )

    await storage.remove(ORIGINAL_BUCKET, [path])
    return {"ok": True}


@router.post("/{item_id}/analyze", response_model=WardrobeAnalyzeOut)
async def analyze_wardrobe_item(
    item_id: UUID,
    user: AuthUser = Depends(get_current_user),
    db: UserDB = Depends(_db),
    storage: UserStorage = Depends(_storage),
    worker: AIWorkerClient = Depends(get_ai_worker),
    settings: Settings = Depends(get_settings),
):
    """Segment + classify an existing item, then store only the cutout path.

    User-entered metadata is never overwritten: AI values are returned as
    suggestions, and the database update touches only the two segmentation
    columns. The original image is left untouched on every failure path.
    """
    rows = await db.select(
        "wardrobe_items",
        {"select": "*", "id": f"eq.{item_id}", "user_id": f"eq.{user.id}", "limit": "1"},
    )
    if not rows or rows[0].get("user_id") != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Wardrobe item not found")

    item = rows[0]
    original_path = item.get("original_image_path")
    if not original_path or not is_owned_path(original_path, user.id):
        await _mark_segmentation_failed(db, item_id, user.id)
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This item has no original image to analyze",
        )

    try:
        image = await storage.download(ORIGINAL_BUCKET, original_path)
    except HTTPException:
        await _mark_segmentation_failed(db, item_id, user.id)
        raise

    if image is None:
        await _mark_segmentation_failed(db, item_id, user.id)
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "The original image is missing from storage",
        )

    detected = _detect_image(image)
    if detected is None:
        await _mark_segmentation_failed(db, item_id, user.id)
        raise HTTPException(
            422,
            "The original image is not a supported JPEG, PNG or WebP file",
        )
    content_type = detected[1]

    try:
        result = await worker.analyze(
            image,
            content_type,
            threshold=settings.segmentation_threshold,
        )
    except AIWorkerError as exc:
        await _mark_segmentation_failed(db, item_id, user.id)
        # Worker auth failures must not look like the caller's session expired.
        code = exc.status_code
        if code in (401, 403, 404):
            code = status.HTTP_503_SERVICE_UNAVAILABLE
        elif exc.code in ("no_garment", "invalid_image", "invalid_request"):
            code = 422
        raise HTTPException(code, exc.detail) from exc

    cutout = _decode_cutout(result.get("cutout_base64") or "")
    if cutout is None:
        await _mark_segmentation_failed(db, item_id, user.id)
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "The AI service returned an invalid garment image",
        )

    # Unique path per analysis so a failed retry can never overwrite a cutout
    # that is still referenced by the row.
    segmented_path = f"{user.id}/{uuid4().hex}.png"
    try:
        await storage.upload(SEGMENTED_BUCKET, segmented_path, cutout, "image/png")
    except HTTPException:
        await _mark_segmentation_failed(db, item_id, user.id)
        raise

    try:
        updated = await db.update(
            "wardrobe_items",
            {"id": f"eq.{item_id}", "user_id": f"eq.{user.id}"},
            {
                "segmented_image_path": segmented_path,
                "segmentation_status": "completed",
            },
        )
        if not updated:
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY,
                "Could not save the analyzed garment",
            )
    except HTTPException:
        # The database is the source of truth. Remove the new object so storage
        # never contains a cutout no row points at.
        try:
            await storage.remove(SEGMENTED_BUCKET, [segmented_path])
        except HTTPException:
            logger.warning("Could not remove orphaned cutout %s", segmented_path)
        await _mark_segmentation_failed(db, item_id, user.id)
        raise

    previous = item.get("segmented_image_path")
    if previous and previous != segmented_path and is_owned_path(previous, user.id):
        try:
            await storage.remove(SEGMENTED_BUCKET, [previous])
        except HTTPException:
            logger.warning("Could not remove replaced cutout %s", previous)

    suggestions = build_suggestions(result.get("analysis") or {}, result.get("label"))
    signed = await storage.signed_url(SEGMENTED_BUCKET, segmented_path)

    return {
        "item": {**updated[0], "image_url": signed},
        "suggestions": AnalyzeSuggestion(**suggestions),
        "detection": DetectionInfo(
            label=result.get("label"),
            confidence=result.get("confidence"),
        ),
        "classification_source": result.get("classification_source"),
        "privacy_notice": PRIVACY_NOTICE,
    }


@router.patch("/{item_id}", response_model=WardrobeItemOut)
async def update_wardrobe_item(
    item_id: UUID,
    body: WardrobeItemUpdate,
    user: AuthUser = Depends(get_current_user),
    db: UserDB = Depends(_db),
    storage: UserStorage = Depends(_storage),
):
    values = body.model_dump(exclude_unset=True)

    if not values:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "No changes provided",
        )

    try:
        rows = await db.update(
            "wardrobe_items",
            {"id": f"eq.{item_id}", "user_id": f"eq.{user.id}"},
            values,
        )
    except sqlite3.IntegrityError as exc:
        logger.warning("Wardrobe update rejected: %s", exc)
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "One of the item details is not valid. Check the name, category and colour.",
        ) from exc

    if not rows:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Wardrobe item not found",
        )

    return await _with_image(storage, rows[0], user.id)


@router.delete("/{item_id}")
async def delete_wardrobe_item(
    item_id: UUID,
    user: AuthUser = Depends(get_current_user),
    db: UserDB = Depends(_db),
    storage: UserStorage = Depends(_storage),
):
    rows = await db.select(
        "wardrobe_items",
        {"select": "*", "id": f"eq.{item_id}", "user_id": f"eq.{user.id}"},
    )

    if not rows or rows[0].get("user_id") != user.id:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Wardrobe item not found",
        )

    item = rows[0]
    targets: dict[str, list[str]] = {}

    for bucket, key in (
        (ORIGINAL_BUCKET, "original_image_path"),
        (SEGMENTED_BUCKET, "segmented_image_path"),
    ):
        path = item.get(key)
        if not path:
            continue
        if not is_owned_path(path, user.id):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Stored image path is invalid; refusing to delete",
            )
        targets.setdefault(bucket, []).append(path)

    # Storage is cleaned first. If that fails the database row is kept, so the
    # user can retry instead of being left with orphaned files and no reference.
    for bucket, paths in targets.items():
        await storage.remove(bucket, paths)

    deleted = await db.delete(
        "wardrobe_items",
        {"id": f"eq.{item_id}", "user_id": f"eq.{user.id}"},
    )

    if not deleted:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "Images were removed but the wardrobe item could not be deleted",
        )

    return {
        "ok": True,
        "removed_images": sum(len(paths) for paths in targets.values()),
    }
