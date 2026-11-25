"""Modular recommendation engine for outfit combinations.

Uses wardrobe metadata (category, colour, style, season, suggested_occasions)
to generate meaningful combinations without requiring a paid AI API.
"""

from typing import Any, Dict, List, Optional

from app.core.config import Settings, get_settings
from app.core.http import get_http
from app.database.supabase_rest import UserDB
from app.schemas.wardrobe import Category, Occasion, Season
from app.core.auth import get_current_user

# Style values matching the backend schema and frontend constants
STYLES = ["Minimal", "Classic", "Casual", "Smart", "Street", "Romantic"]


Category = str  # Literal["Tops","Bottoms","Dresses","Outerwear","Shoes","Bags","Other"]
Occasion = str  # Literal["College","Casual","Dinner","Party"]
Season = str  # Literal["Spring","Summer","Autumn","Winter","All-season"]
Style = str  # Literal["Minimal","Classic","Casual","Smart","Street","Romantic"]


def _valid_occasion(value: str) -> bool:
    """Check if a string is a valid occasion literal."""
    return value in {"College", "Casual", "Dinner", "Party"}


def _valid_style(value: str) -> bool:
    """Check if a string is a valid style literal."""
    return value in {"Minimal", "Classic", "Casual", "Smart", "Street", "Romantic"}


def _valid_season(value: str) -> bool:
    """Check if a string is a valid season literal."""
    return value in {"Spring", "Summer", "Autumn", "Winter", "All-season"}


def _normalize_style(value: Optional[str]) -> Optional[str]:
    """Normalize a style value, returning None if invalid."""
    if value is None or value == "":
        return None
    normalized = value.strip()
    if normalized not in {"Minimal", "Classic", "Casual", "Smart", "Street", "Romantic"}:
        return None
    return normalized


def _normalize_occasion(value: Optional[str]) -> Optional[str]:
    """Normalize an occasion value, returning None if invalid."""
    if value is None or value == "":
        return None
    normalized = value.strip()
    if normalized not in {"College", "Casual", "Dinner", "Party"}:
        return None
    return normalized


def _normalize_season(value: Optional[str]) -> Optional[str]:
    """Normalize a season value, returning None if invalid."""
    if value is None or value == "":
        return None
    normalized = value.strip()
    if normalized not in {"Spring", "Summer", "Autumn", "Winter", "All-season"}:
        return None
    return normalized


async def _get_user_wardrobe(user_id: str, occasion_filter: Optional[List[str]] = None) -> List[Dict]:
    """Fetch the authenticated user's wardrobe items from Supabase.

    Args:
        user_id: The authenticated user's ID
        occasion_filter: Optional list of occasions to filter by

    Returns:
        List of wardrobe item dictionaries
    """
    from app.main import app  # avoid circular import at module level

    http_client = app.state.http if hasattr(app, "state") else None
    if http_client is None:
        # Fallback: create a simple client
        import httpx
        http_client = httpx.AsyncClient()

    db = UserDB(http_client, get_settings(), AuthUser(id=user_id, email=None, token=""))

    select_filter = {"user_id": f"eq.{user_id}", "select": "*", "order": "created_at.desc"}

    if occasion_filter:
        # Filter by suggested_occasions using GIS operator
        occasion_strs = ",".join(f"'{o}'" for o in occasion_filter)
        select_filter["suggested_occasions"] = f"overlap.({occasion_strs})"

    rows = await db.select("wardrobe_items", select_filter)
    return rows or []


async def get_recommendations(
    user_id: str,
    occasion: Optional[str] = None,
    style: Optional[str] = None,
    include_accessories: bool = True,
) -> Dict[str, Any]:
    """Generate outfit recommendations for a user based on their wardrobe.

    Algorithm:
    1. Fetch user's wardrobe items
    2. Filter by occasion and style preferences
    3. Generate combinations:
       - Tops + Bottoms
       - Dresses as standalone outfits
       - Optional accessories (Shoes, Outerwear, Bags)
    4. Deduplicate and score combinations
    5. Return with explanations

    Args:
        user_id: The authenticated user's ID
        occasion: Optional occasion filter ("College", "Casual", "Dinner", "Party")
        style: Optional style preference ("Minimal", "Classic", "Casual", "Smart", "Street", "Romantic")
        include_accessories: Whether to include shoes, outerwear, bags in combinations

    Returns:
        Dictionary with 'outfits' list and 'algorithm_info'
    """
    # Validate and normalize inputs
    valid_occasion = _normalize_occasion(occasion) if occasion else None
    valid_style = _normalize_style(style) if style else None

    # Fetch user's wardrobe
    wardrobe = await _get_user_wardrobe(user_id)

    if not wardrobe:
        return {
            "outfits": [],
            "algorithm_info": {
                "source": "wardrobe",
                "message": "Your wardrobe is empty. Add some clothing items to get recommendations.",
                "item_count": 0,
            },
        }

    # Build category buckets
    tops = [item for item in wardrobe if item.get("category") == "Tops"]
    bottoms = [item for item in wardrobe if item.get("category") == "Bottoms"]
    dresses = [item for item in wardrobe if item.get("category") == "Dresses"]
    outerwear = [item for item in wardrobe if item.get("category") == "Outerwear"]
    shoes = [item for item in wardrobe if item.get("category") == "Shoes"]
    bags = [item for item in wardrobe if item.get("category") == "Bags"]

    # Filter by occasion (using suggested_occasions overlap)
    if valid_occasion:
        tops = [item for item in tops if valid_occasion in (item.get("suggested_occasions") or [])]
        bottoms = [item for item in bottoms if valid_occasion in (item.get("suggested_occasions") or [])]
        dresses = [item for item in dresses if valid_occasion in (item.get("suggested_occasions") or [])]
        if include_accessories:
            outerwear = [item for item in outerwear if valid_occasion in (item.get("suggested_occasions") or [])]
            shoes = [item for item in shoes if valid_occasion in (item.get("suggested_occasions") or [])]
            bags = [item for item in bags if valid_occasion in (item.get("suggested_occasions") or [])]

    # Filter by style preference
    if valid_style:
        tops = [item for item in tops if _valid_style(item.get("style")) and _valid_style(item.get("style")) == valid_style]
        bottoms = [item for item in bottoms if _valid_style(item.get("style")) and _valid_style(item.get("style")) == valid_style]
        dresses = [item for item in dresses if _valid_style(item.get("style")) and _valid_style(item.get("style")) == valid_style]
        if include_accessories:
            outerwear = [item for item in outerwear if _valid_style(item.get("style")) and _valid_style(item.get("style")) == valid_style]
            shoes = [item for item in shoes if _valid_style(item.get("style")) and _valid_style(item.get("style")) == valid_style]
            bags = [item for item in bags if _valid_style(item.get("style")) and _valid_style(item.get("style")) == valid_style]

    recommendations: List[Dict[str, Any]] = []

    # Strategy 1: Tops + Bottoms
    if tops and bottoms:
        for top in tops:
            for bottom in bottoms:
                combo = [top, bottom]
                explanation = _build_top_bottom_explanation(top, bottom, valid_occasion, valid_style)
                score = _score_combination(combo, valid_occasion, valid_style)
                recommendations.append({
                    "items": combo,
                    "occasion": valid_occasion or _best_occasion(combo),
                    "style": valid_style or _best_style(combo),
                    "explanation": explanation,
                    "score": score,
                    "type": "top_and_bottom",
                })

    # Strategy 2: Dresses as standalone outfits
    if dresses:
        for dress in dresses:
            occasion = _best_occasion_single(dress, valid_occasion)
            style = _best_style_single(dress, valid_style)
            explanation = _build_dress_explanation(dress, valid_occasion, valid_style)
            score = _score_single(dress, valid_occasion, valid_style)
            recommendations.append({
                "items": [dress],
                "occasion": occasion,
                "style": style,
                "explanation": explanation,
                "score": score,
                "type": "dress",
            })

    # Strategy 3: Tops + Bottoms + Accessories (optional)
    if include_accessories and tops and bottoms and (shoes or outerwear or bags):
        for top in tops:
            for bottom in bottoms:
                accessories = []
                accessory_items = []

                if shoes:
                    accessory_items.extend(shoes[:1])  # Take first shoe
                if outerwear:
                    accessory_items.extend(outerwear[:1])  # Take first outerwear
                if bags:
                    accessory_items.extend(bags[:1])  # Take first bag

                if accessory_items:
                    combo = [top, bottom] + accessory_items
                    explanation = _build_accessory_explanation(top, bottom, accessory_items, valid_occasion, valid_style)
                    score = _score_combination_with_accessories(combo, valid_occasion, valid_style)
                    recommendations.append({
                        "items": combo,
                        "occasion": valid_occasion or _best_occasion(combo),
                        "style": valid_style or _best_style(combo),
                        "explanation": explanation,
                        "score": score,
                        "type": "top_bottom_accessories",
                    })

    # Remove duplicates (same item IDs in different order)
    seen_keys = set()
    unique_recommendations = []
    for rec in recommendations:
        item_keys = tuple(sorted(str(item.get("id")) for item in rec["items"]))
        if item_keys not in seen_keys:
            seen_keys.add(item_keys)
            unique_recommendations.append(rec)

    # Sort by score descending
    unique_recommendations.sort(key=lambda x: x.get("score", 0), reverse=True)

    # Limit to top 6 recommendations
    limited = unique_recommendations[:6]

    info = {
        "source": "wardrobe",
        "message": f"Generated {len(limited)} outfit(s) from {len(wardrobe)} wardrobe item(s)",
        "item_count": len( wardrobe),
        "filters": {
            "occasion": valid_occasion,
            "style": valid_style,
        },
    }

    return {
        "outfits": limited,
        "algorithm_info": info,
    }


def _build_top_bottom_explanation(
    top: Dict,
    bottom: Dict,
    occasion: Optional[str],
    style: Optional[str],
) -> str:
    """Build a simple explanation for a top-bottom combination."""
    top_name = top.get("item_name", "item")
    bottom_name = bottom.get("item_name", "item")
    top_colour = top.get("colour", "")
    bottom_colour = bottom.get("colour", "")

    parts = [f"{top_name} with {bottom_name}"]

    # Colour coordination note
    if top_colour and bottom_colour:
        # Simple complementary check
        if top_colour != bottom_colour:
            parts.append(f"({top_colour} and {bottom_colour})")
        else:
            parts.append(f"({top_colour} monochrome)")

    # Style note
    if style:
        parts.append(f"– {style} style")
    elif top.get("style") and bottom.get("style"):
        styles = [s for s in [top.get("style"), bottom.get("style")] if s]
        if styles:
            parts.append(f"– {', '.join(styles)} pairing")

    # Occasion note
    if occasion:
        parts.append(f"for {occasion.lower()}")
    elif top.get("suggested_occasions") or bottom.get("suggested_occasions"):
        occs = set()
        if top.get("suggested_occasions"):
            occs.update(top["suggested_occasions"])
        if bottom.get("suggested_occasions"):
            occs.update(bottom["suggested_occasions"])
        if occs:
            parts.append(f"suited for {', '.join(list(occs)[:2])}")

    return ". ".join(parts) + "."


def _build_dress_explanation(
    dress: Dict,
    occasion: Optional[str],
    style: Optional[str],
) -> str:
    """Build a simple explanation for a dress standalone outfit."""
    dress_name = dress.get("item_name", "item")
    dress_colour = dress.get("colour", "")
    parts = [f"{dress_name}"]

    if dress_colour:
        parts.append(f"({dress_colour})")

    if style:
        parts.append(f"– {style} style")
    elif dress.get("style"):
        parts.append(f"– {dress['style']} style")

    if occasion:
        parts.append(f"for {occasion.lower()}")
    elif dress.get("suggested_occasions"):
        occs = dress["suggested_occasions"]
        if occs:
            parts.append(f"suited for {', '.join(list(occs)[:2])}")

    return ". ".join(parts) + "."


def _build_accessory_explanation(
    top: Dict,
    bottom: Dict,
    accessories: List[Dict],
    occasion: Optional[str],
    style: Optional[str],
) -> str:
    """Build explanation for top-bottom-accessory combination."""
    top_name = top.get("item_name", "item")
    bottom_name = bottom.get("item_name", "item")
    acc_names = ", ".join(a.get("item_name", "item") for a in accessories)

    parts = [f"{top_name} with {bottom_name}"]
    parts.append(f"accessorized with {acc_names}")

    if style:
        parts.append(f"– {style} style")
    elif top.get("style") or bottom.get("style"):
        styles = [s for s in [top.get("style"), bottom.get("style")] if s]
        if styles:
            parts.append(f"– {', '.join(styles)} aesthetic")

    if occasion:
        parts.append(f"for {occasion.lower()}")
    elif top.get("suggested_occasions") or bottom.get("suggested_occasions"):
        occs = set()
        if top.get("suggested_occasions"):
            occs.update(top["suggested_occasions"])
        if bottom.get("suggested_occasions"):
            occs.update(bottom["suggested_occasions"])
        if occs:
            parts.append(f"suited for {', '.join(list(occs)[:2])}")

    return ". ".join(parts) + "."


def _score_combination(
    items: List[Dict],
    occasion: Optional[str],
    style: Optional[str],
) -> float:
    """Score a combination based on metadata compatibility.

    Higher score = better match.
    """
    score = 50.0  # Base score

    # Category compatibility: tops + bottoms always compatible
    categories = [item.get("category") for item in items]
    has_top = "Tops" in categories
    has_bottom = "Bottoms" in categories
    has_dress = "Dresses" in categories

    if has_top and has_bottom:
        score += 20  # Classic top-bottom pairing
    if has_dress:
        score += 15  # Dress is a complete outfit

    # Occasion match
    if occasion:
        for item in items:
            item_occasions = item.get("suggested_occasions") or []
            if occasion in item_occasions:
                score += 10
                break

    # Style match
    if style:
        for item in items:
            item_style = item.get("style")
            if item_style == style:
                score += 10
                break

    # Colour coordination (simple: items with colours complement each other)
    colours = [item.get("colour_hex") for item in items if item.get("colour_hex")]
    if len(colours) >= 2:
        score += 5  # Has colour information

    # Season compatibility (all-season gets a small boost)
    for item in items:
        season = item.get("season")
        if season == "All-season":
            score += 3
            break

    # Penalty for too few items
    if len(items) < 2:
        score -= 10

    return round(min(max(score, 0), 100), 2)


def _score_combination_with_accessories(
    items: List[Dict],
    occasion: Optional[str],
    style: Optional[str],
) -> float:
    """Score a combination with accessories."""
    base_score = _score_combination(items, occasion, style)
    # Accessories add a small boost
    return round(min(base_score + 5, 100), 2)


def _best_occasion(items: List[Dict], preferred: Optional[str] = None) -> Optional[str]:
    """Determine the best occasion from a list of items."""
    all_occasions: set[str] = set()
    for item in items:
        occs = item.get("suggested_occasions") or []
        all_occasions.update(occs)

    if not all_occasions:
        return preferred

    # Return preferred if valid, otherwise first available (sorted for determinism)
    if preferred and preferred in all_occasions:
        return preferred
    return sorted(all_occasions)[0] if all_occasions else None


def _best_style(items: List[Dict], preferred: Optional[str] = None) -> Optional[str]:
    """Determine the best style from a list of items."""
    all_styles: set[str] = set()
    for item in items:
        item_style = item.get("style")
        if item_style and _valid_style(item_style):
            all_styles.add(item_style)

    if not all_styles:
        return preferred

    # Return preferred only if it's actually in the collected styles
    if preferred and _valid_style(preferred) and preferred in all_styles:
        return preferred
    # Otherwise return the first collected style (sorted for determinism)
    return sorted(all_styles)[0] if all_styles else None


def _best_occasion_single(
    item: Dict,
    preferred: Optional[str] = None,
) -> Optional[str]:
    """Determine the best occasion for a single item (e.g., dress)."""
    occs = item.get("suggested_occasions") or []
    if not occs:
        return preferred
    if preferred and preferred in occs:
        return preferred
    return occs[0] if occs else None


def _best_style_single(
    item: Dict,
    preferred: Optional[str] = None,
) -> Optional[str]:
    """Determine the best style for a single item (e.g., dress)."""
    item_style = item.get("style")
    if item_style and _valid_style(item_style):
        if preferred and _valid_style(preferred):
            return preferred
        return item_style
    return preferred


async def register_recommendation_outfits(
    user_id: str,
    recommendations: List[Dict],
    db: Any,
) -> List[Dict]:
    """Register generated recommendations as actual outfits in the database.

    This builds on the existing outfit registration pattern from the API.

    Args:
        user_id: The authenticated user's ID
        recommendations: List of recommendation dicts from get_recommendations
        db: Database client

    Returns:
        List of created outfit records
    """
    created = []

    for rec in recommendations:
        items = rec.get("items", [])
        if not items:
            continue

        # Build combo_key from sorted item IDs
        item_ids = [str(item.get("id")) for item in items if item.get("id")]
        if not item_ids:
            continue

        combo_key = ",".join(sorted(item_ids))

        # Check if this combination already exists for the user
        existing = await db.select(
            "outfits",
            {"select": "id", "combo_key": f"eq.{combo_key}"},
        )

        if existing:
            # Outfit already exists, reuse the ID
            outfit_id = existing[0]["id"]
        else:
            # Create new outfit
            # Determine the main occasion from the recommendation
            rec_occasion = rec.get("occasion")
            if not rec_occasion:
                # Derive from items
                all_occasions: set[str] = set()
                for item in items:
                    all_occasions.update(item.get("suggested_occasions") or [])
                rec_occasion = list(all_occasions)[0] if all_occasions else None

            # Determine styling explanation
            explanation = rec.get("explanation", f"{rec.get('type', 'outfit')} combination")

            values = {
                "user_id": user_id,
                "outfit_name": f"{rec.get('type', 'outfit').title()} combination",
                "occasion": rec_occasion,
                "recommendation_score": rec.get("score", 50.0),
                "styling_explanation": explanation,
                "combo_key": combo_key,
            }

            created_outfit = await db.insert("outfits", values)
            if not created_outfit:
                continue
            outfit_id = created_outfit[0]["id"]

        # Link wardrobe items to the outfit via outfit_items
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
                        "outfit_id": outfit_id,
                        "wardrobe_item_id": item_id,
                    },
                )

        # Retrieve the full outfit result
        outfit_result = await _get_outfit_from_db(db, str(outfit_id))
        if outfit_result:
            created.append(outfit_result)

    return created


async def _get_outfit_from_db(db: Any, outfit_id: str) -> Optional[Dict]:
    """Retrieve a full outfit with its items from the database."""
    outfit = await db.select(
        "outfits",
        {"select": "*", "id": f"eq.{outfit_id}"},
    )

    if not outfit:
        return None

    outfit = outfit[0]

    # Get linked items
    item_ids = [row["wardrobe_item_id"] for row in await db.select(
        "outfit_items",
        {"select": "wardrobe_item_id", "outfit_id": f"eq.{outfit_id}"},
    )]

    if item_ids:
        items = await db.select(
            "wardrobe_items",
            {"select": "*", "id": f"in.({','.join(item_ids)})"},
        )
    else:
        items = []

    outfit["items"] = items
    return outfit