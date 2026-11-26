from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Optional
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import AuthUser, get_current_user
from app.core.config import Settings, get_settings
from app.core.http import get_http
from app.database.deps import get_db
from app.database.supabase_rest import UserDB  # type hint only
from app.schemas.outfits import OutfitCreate
from app.services.recommendation.service import get_recommendations
from app.schemas.wardrobe import Category, Occasion as OccasionSchema, Season

router = APIRouter(prefix="/outfits", tags=["outfits"])


def _db(db=Depends(get_db)):
    return db


async def _get_outfit(db: UserDB, outfit_id: str):
    outfits = await db.select(
        "outfits",
        {"select": "*", "id": f"eq.{outfit_id}"},
    )

    if not outfits:
        return None

    outfit = outfits[0]

    links = await db.select(
        "outfit_items",
        {"select": "wardrobe_item_id", "outfit_id": f"eq.{outfit_id}"},
    )

    item_ids = [row["wardrobe_item_id"] for row in links]

    items = []
    if item_ids:
        items = await db.select(
            "wardrobe_items",
            {"select": "*", "id": f"in.({','.join(item_ids)})"},
        )

    outfit["items"] = items
    return outfit


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_outfit(
    body: OutfitCreate,
    user: AuthUser = Depends(get_current_user),
    db: UserDB = Depends(_db),
):
    try:
        item_ids = list(
            dict.fromkeys(str(UUID(item_id)) for item_id in body.wardrobe_item_ids)
        )
    except ValueError:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Invalid wardrobe item ID",
        )

    if not item_ids:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "At least one wardrobe item is required",
        )

    owned_items = await db.select(
        "wardrobe_items",
        {
            "select": "id",
            "id": f"in.({','.join(item_ids)})",
            "user_id": f"eq.{user.id}",
        },
    )

    if len(owned_items) != len(item_ids):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "One or more wardrobe items were not found",
        )

    combo_key = ",".join(sorted(item_ids))

    existing = await db.select(
        "outfits",
        {"select": "id", "combo_key": f"eq.{combo_key}", "user_id": f"eq.{user.id}"},
    )

    if existing:
        outfit_id = existing[0]["id"]
    else:
        values = body.model_dump(exclude={"wardrobe_item_ids"})
        values["user_id"] = user.id
        values["combo_key"] = combo_key

        created = await db.insert("outfits", values)

        if not created:
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY,
                "Could not create outfit",
            )

        outfit_id = created[0]["id"]

    existing_links = await db.select(
        "outfit_items",
        {"select": "wardrobe_item_id", "outfit_id": f"eq.{outfit_id}"},
    )
    linked_ids = {row["wardrobe_item_id"] for row in existing_links}

    for item_id in item_ids:
        if item_id not in linked_ids:
            await db.insert(
                "outfit_items",
                {
                    "user_id": user.id,
                    "outfit_id": outfit_id,
                    "wardrobe_item_id": item_id,
                },
            )

    result = await _get_outfit(db, outfit_id)

    if not result:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Outfit could not be retrieved",
        )

    return result


@router.get("/saved")
async def get_saved_outfits(
    user: AuthUser = Depends(get_current_user),
    db: UserDB = Depends(_db),
):
    saved_rows = await db.select(
        "saved_outfits",
        {"select": "*", "order": "saved_at.desc", "user_id": f"eq.{user.id}"},
    )

    results = []

    for saved in saved_rows:
        outfit = await _get_outfit(db, saved["outfit_id"])

        if not outfit:
            continue

        history = await db.select(
            "outfit_wear_history",
            {
                "select": "worn_at",
                "outfit_id": f"eq.{saved['outfit_id']}",
                "user_id": f"eq.{user.id}",
                "order": "worn_at.desc",
                "limit": "1",
            },
        )

        outfit["saved_at"] = saved["saved_at"]
        outfit["worn"] = bool(history)
        outfit["last_worn_at"] = history[0]["worn_at"] if history else None

        results.append(outfit)

    return results


@router.get("/saved-ids")
async def get_saved_ids(
    user: AuthUser = Depends(get_current_user),
    db: UserDB = Depends(_db),
):
    rows = await db.select(
        "saved_outfits",
        {"select": "outfit_id", "user_id": f"eq.{user.id}"},
    )
    return [row["outfit_id"] for row in rows]


@router.get("/worn-today-ids")
async def get_worn_today_ids(
    user: AuthUser = Depends(get_current_user),
    db: UserDB = Depends(_db),
):
    rows = await db.select(
        "outfit_wear_history",
        {
            "select": "outfit_id",
            "user_id": f"eq.{user.id}",
            "worn_on": f"eq.{date.today().isoformat()}",
        },
    )
    return list({row["outfit_id"] for row in rows})


@router.post("/{outfit_id}/save")
async def save_outfit(
    outfit_id: UUID,
    user: AuthUser = Depends(get_current_user),
    db: UserDB = Depends(_db),
):
    outfit = await _get_outfit(db, str(outfit_id))

    if not outfit:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Outfit not found")

    existing = await db.select(
        "saved_outfits",
        {"select": "id", "outfit_id": f"eq.{outfit_id}", "user_id": f"eq.{user.id}"},
    )

    if not existing:
        await db.insert(
            "saved_outfits",
            {
                "user_id": user.id,
                "outfit_id": str(outfit_id),
            },
        )

    return {"ok": True}


@router.delete("/{outfit_id}/save")
async def remove_saved_outfit(
    outfit_id: UUID,
    user: AuthUser = Depends(get_current_user),
    db: UserDB = Depends(_db),
):
    await db.delete(
        "saved_outfits",
        {"outfit_id": f"eq.{outfit_id}", "user_id": f"eq.{user.id}"},
    )
    return {"ok": True}


@router.post("/{outfit_id}/feedback")
async def mark_not_for_me(
    outfit_id: UUID,
    user: AuthUser = Depends(get_current_user),
    db: UserDB = Depends(_db),
):
    outfit = await _get_outfit(db, str(outfit_id))

    if not outfit:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Outfit not found")

    existing = await db.select(
        "outfit_feedback",
        {
            "select": "id",
            "outfit_id": f"eq.{outfit_id}",
            "user_id": f"eq.{user.id}",
            "feedback_type": "eq.NOT_FOR_ME",
        },
    )

    if not existing:
        await db.insert(
            "outfit_feedback",
            {
                "user_id": user.id,
                "outfit_id": str(outfit_id),
                "feedback_type": "NOT_FOR_ME",
            },
        )

    return {"ok": True}


@router.post("/{outfit_id}/worn")
async def mark_outfit_worn(
    outfit_id: UUID,
    user: AuthUser = Depends(get_current_user),
    db: UserDB = Depends(_db),
):
    outfit = await _get_outfit(db, str(outfit_id))

    if not outfit:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Outfit not found")

    today = date.today().isoformat()

    # Track wear history and increment times_worn atomically
    # Check if already worn today to prevent double-counting
    existing_history = await db.select(
        "outfit_wear_history",
        {
            "select": "id",
            "outfit_id": f"eq.{outfit_id}",
            "user_id": f"eq.{user.id}",
            "worn_on": f"eq.{today}",
        },
    )

    if not existing_history:
        # Insert new wear-history record
        await db.insert(
            "outfit_wear_history",
            {
                "user_id": user.id,
                "outfit_id": str(outfit_id),
                "occasion": outfit.get("occasion"),
                "worn_on": today,
            },
        )

        # Increment times_worn on wardrobe items ONLY when new wear record created
        # This prevents double-counting on same-day repeated requests.
        # PostgREST stores the literal value sent, so the new count is computed
        # here instead of sending the SQL expression "times_worn + 1".
        for item in outfit.get("items", []):
            item_id = item.get("id")
            if not item_id:
                continue
            await db.update(
                "wardrobe_items",
                {
                    "id": f"eq.{item_id}",
                    "user_id": f"eq.{user.id}",
                },
                {
                    "times_worn": int(item.get("times_worn") or 0) + 1,
                },
            )

    return {"ok": True}


@router.get("/history")
async def get_outfit_history(
    user: AuthUser = Depends(get_current_user),
    db: UserDB = Depends(_db),
):
    rows = await db.select(
        "outfit_wear_history",
        {
            "select": "*",
            "user_id": f"eq.{user.id}",
            "order": "worn_at.desc",
        },
    )

    counts = {}
    for row in rows:
        outfit_id = row["outfit_id"]
        counts[outfit_id] = counts.get(outfit_id, 0) + 1

    results = []
    recent_limit = datetime.now(timezone.utc) - timedelta(days=7)

    for row in rows:
        outfit = await _get_outfit(db, row["outfit_id"])

        if not outfit:
            continue

        worn_at = datetime.fromisoformat(row["worn_at"].replace("Z", "+00:00"))

        repeat_count = counts[row["outfit_id"]]

        results.append(
            {
                "id": row["id"],
                "worn_at": row["worn_at"],
                "occasion": row.get("occasion"),
                "outfit": outfit,
                "recently_worn": worn_at >= recent_limit,
                "repeated": repeat_count > 1,
                "repeat_count": repeat_count,
            }
        )

    return results


@router.get("/insights")
async def get_insights(
    user: AuthUser = Depends(get_current_user),
    db: UserDB = Depends(_db),
) -> dict:
    """Get wardrobe insights based on real user data."""
    # Get all wear history for this user
    rows = await db.select(
        "outfit_wear_history",
        {
            "select": "*",
            "user_id": f"eq.{user.id}",
            "order": "worn_at.desc",
        },
    )

    if not rows:
        return {
            "sufficient_data": False,
            "total_worn": 0,
            "total_items": 0,
            "categories_most": [],
            "categories_least": [],
            "colours": [],
            "favourite_items": [],
            "underused_items": [],
            "top_combinations": [],
            "repeat_stats": {
                "unique_outfits": 0,
                "repeated_outfits": 0,
                "repeat_rate": 0,
            },
            "untried": [],
        }

    # Count outfit wear counts
    counts = {}
    for row in rows:
        outfit_id = row["outfit_id"]
        counts[outfit_id] = counts.get(outfit_id, 0) + 1

    # Get all wardrobe items for the user
    wardrobe_items = await db.select(
        "wardrobe_items",
        {
            "select": "*",
            "user_id": f"eq.{user.id}",
            "order": "created_at.desc",
        },
    )

    # Calculate categories distribution
    cat_counts: dict = {}
    for item in wardrobe_items:
        cat = item.get("category")
        if cat:
            cat_counts[cat] = cat_counts.get(cat, 0) + 1

    # Sort categories by count
    categories_sorted = sorted(cat_counts.items(), key=lambda x: x[1], reverse=True)
    categories_most = [{"category": c, "count": n} for c, n in categories_sorted[:7]]
    categories_least = (
        [{"category": c, "count": n} for c, n in categories_sorted[-3:]]
        if len(categories_sorted) >= 3
        else []
    )

    # Calculate colour distribution. Prefer the user's colour name over the
    # raw hex so the insights panel reads like a wardrobe, not a colour picker.
    colour_counts: dict = {}
    colour_names: dict = {}
    for item in wardrobe_items:
        c = item.get("colour_hex")
        if c:
            colour_counts[c] = colour_counts.get(c, 0) + 1
            name = (item.get("colour") or "").strip()
            if name:
                colour_names.setdefault(c, name)

    # Sort colours by count
    colours_sorted = sorted(colour_counts.items(), key=lambda x: x[1], reverse=True)
    colours = [
        {"colour": colour_names.get(k, k), "hex": k, "count": n}
        for k, n in colours_sorted[:8]
    ]

    # Calculate favourite and underused items. `times_worn` is the counter the
    # wear endpoint maintains on `wardrobe_items`; outfit rows do not embed
    # their items, so reading them from the outfit payload always counted zero.
    item_wear_total: dict = {
        item["id"]: int(item.get("times_worn") or 0) for item in wardrobe_items
    }

    # Sort by wear count
    favourite_items = sorted(item_wear_total.items(), key=lambda x: x[1], reverse=True)[:5]
    underused_items = sorted(item_wear_total.items(), key=lambda x: x[1])[:5]

    # Calculate repeat stats
    tried_outfits = set()
    for row in rows:
        tried_outfits.add(row["outfit_id"])

    unique_outfits = len(tried_outfits)
    repeated_outfits = sum(1 for oid in tried_outfits if counts.get(oid, 0) > 1)
    repeat_rate = round((1 - unique_outfits / len(rows)) * 100, 1) if rows else 0

    sufficient_data = len(rows) >= 3

    # Top combinations - empty for now (would need full outfit combination tracking)
    top_combinations = []

    # Untried outfits - outfits not yet worn
    untried = []

    return {
        "sufficient_data": sufficient_data,
        "total_worn": len(rows),
        "categories_most": categories_most,
        "categories_least": categories_least,
        "colours": colours,
        "favourite_items": [{"id": k, "times_worn": v} for k, v in favourite_items],
        "underused_items": [{"id": k, "times_worn": v} for k, v in underused_items],
        "top_combinations": top_combinations,
        "repeat_stats": {
            "unique_outfits": unique_outfits,
            "repeated_outfits": repeated_outfits,
            "repeat_rate": repeat_rate,
        },
        "untried": untried,
    }


@router.get("/recommendations")
async def get_recommendations_endpoint(
    occasion: Optional[str] = Query(
        None,
        description="Filter by occasion: College, Casual, Dinner, Party",
    ),
    style: Optional[str] = Query(
        None,
        description="Filter by style: Minimal, Classic, Casual, Smart, Street, Romantic",
    ),
    seed: int = Query(
        0,
        ge=0,
        description="Rotate the ranked combinations. Remix increments this value.",
    ),
    limit: int = Query(6, ge=1, le=24),
    user: AuthUser = Depends(get_current_user),
    db: UserDB = Depends(_db),
) -> Dict[str, Any]:
    """Generate outfit recommendations based on the user's real wardrobe.

    Uses wardrobe metadata (category, colour, style, season, suggested_occasions)
    to generate meaningful combinations without requiring a paid AI API.

    - **occasion**: Filter recommendations by occasion (College, Casual, Dinner, Party)
    - **style**: Filter by style preference (Minimal, Classic, Casual, Smart, Street, Romantic)
    - **seed**: Rotates the selection between equally scored combinations
    """
    # The authenticated user's own JWT is forwarded on every PostgREST call, so
    # both this explicit `user_id` filter and Row Level Security scope the data.
    return await get_recommendations(
        db=db,
        user_id=user.id,
        occasion=occasion,
        style=style,
        seed=seed,
        limit=limit,
    )