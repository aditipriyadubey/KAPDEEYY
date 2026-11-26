"""Modular recommendation engine for outfit combinations.

Uses wardrobe metadata (category, colour, style, season, suggested_occasions)
to generate meaningful combinations without requiring a paid AI API.

Design notes
------------
* Only the authenticated user's rows are read (the database client is already
  scoped to the caller, and an explicit ``user_id`` filter is added too).
* Metadata is optional. An item with no ``suggested_occasions`` is kept for
  every occasion instead of being silently dropped, which is what made the
  studio look empty for wardrobes created through the upload flow.
* Combinations are deduplicated by item-id set, scored on category
  compatibility, colour harmony, occasion, style and season, then rotated
  within score bands so "Remix" returns a genuinely different selection.
"""

from __future__ import annotations

import colorsys
from datetime import date
from typing import Any, Dict, List, Optional, Tuple

from app.database.supabase_rest import UserDB

# Style values matching the backend schema and frontend constants
STYLES = ["Minimal", "Classic", "Casual", "Smart", "Street", "Romantic"]

VALID_OCCASIONS = {"College", "Casual", "Dinner", "Party"}
VALID_STYLES = set(STYLES)
VALID_SEASONS = {"Spring", "Summer", "Autumn", "Winter", "All-season"}

# Categories that finish a look built on a top/bottom or a dress.
ACCESSORY_CATEGORIES = ("Outerwear", "Shoes", "Bags")

# Neighbouring seasons count as a match: an Autumn coat is still sensible in
# early Winter, and users rarely tag every piece.
SEASON_NEIGHBOURS = {
    "Spring": {"Spring", "Summer"},
    "Summer": {"Summer", "Spring"},
    "Autumn": {"Autumn", "Winter"},
    "Winter": {"Winter", "Autumn"},
    "All-season": set(VALID_SEASONS),
}

NEUTRAL_NAME_HINTS = {
    "black", "white", "ivory", "cream", "beige", "grey", "gray", "charcoal",
    "navy", "tan", "camel", "khaki", "brown", "silver", "gold", "nude",
}


def _valid_occasion(value: str) -> bool:
    return value in VALID_OCCASIONS


def _valid_style(value: str) -> bool:
    return value in VALID_STYLES


def _valid_season(value: str) -> bool:
    return value in VALID_SEASONS


def _normalize_style(value: Optional[str]) -> Optional[str]:
    if value is None or value == "":
        return None
    normalized = value.strip()
    return normalized if normalized in VALID_STYLES else None


def _normalize_occasion(value: Optional[str]) -> Optional[str]:
    if value is None or value == "":
        return None
    normalized = value.strip()
    return normalized if normalized in VALID_OCCASIONS else None


def _normalize_season(value: Optional[str]) -> Optional[str]:
    if value is None or value == "":
        return None
    normalized = value.strip()
    return normalized if normalized in VALID_SEASONS else None


def current_season(today: Optional[date] = None) -> str:
    """Northern-hemisphere season used only as a soft ranking signal."""
    month = (today or date.today()).month
    if month in (12, 1, 2):
        return "Winter"
    if month in (3, 4, 5):
        return "Spring"
    if month in (6, 7, 8):
        return "Summer"
    return "Autumn"


async def _get_user_wardrobe(db: UserDB, user_id: str) -> List[Dict]:
    rows = await db.select(
        "wardrobe_items",
        {"user_id": f"eq.{user_id}", "select": "*", "order": "created_at.desc"},
    )
    return rows or []


# ── colour helpers ────────────────────────────────────────────────


def _hex_to_rgb(value: str) -> Optional[Tuple[float, float, float]]:
    if not value or not value.startswith("#") or len(value) != 7:
        return None
    try:
        return tuple(int(value[i : i + 2], 16) / 255 for i in (1, 3, 5))  # type: ignore[return-value]
    except ValueError:
        return None


def _colour_profile(item: Dict) -> Optional[Dict[str, Any]]:
    """Describe an item's colour as (potentially) neutral + hue/lightness."""
    hex_value = item.get("colour_hex")
    rgb = _hex_to_rgb(hex_value) if isinstance(hex_value, str) else None

    if rgb:
        hue, lightness, saturation = colorsys.rgb_to_hls(*rgb)
        name = (item.get("colour") or "").strip().lower()
        neutral = saturation < 0.12 or lightness > 0.86 or lightness < 0.14
        if name in NEUTRAL_NAME_HINTS:
            neutral = True
        return {
            "hue": hue * 360,
            "lightness": lightness,
            "saturation": saturation,
            "neutral": neutral,
            "hex": hex_value,
        }

    name = (item.get("colour") or "").strip().lower()
    if name:
        # A colour name without a swatch still tells us something.
        return {
            "hue": None,
            "lightness": 0.5,
            "saturation": 0.0,
            "neutral": name in NEUTRAL_NAME_HINTS,
            "hex": None,
        }
    return None


def _pair_harmony(a: Dict[str, Any], b: Dict[str, Any]) -> float:
    """0–10 for one pair of colours."""
    if a["neutral"] and b["neutral"]:
        return 9.0
    if a["neutral"] or b["neutral"]:
        return 10.0
    if a["hue"] is None or b["hue"] is None:
        return 6.0

    difference = abs(a["hue"] - b["hue"])
    difference = min(difference, 360 - difference)
    if difference <= 30:
        return 9.0  # tonal / monochrome
    if difference >= 150:
        return 8.0  # complementary
    if abs(a["lightness"] - b["lightness"]) >= 0.4:
        return 7.0  # strong light/dark contrast
    return 4.5  # mid-tone clash


def colour_harmony_score(items: List[Dict]) -> float:
    """Average pairwise colour harmony, scaled to 0–12."""
    profiles = [p for p in (_colour_profile(item) for item in items) if p]
    if len(profiles) < 2:
        return 0.0

    pairs = [
        _pair_harmony(profiles[i], profiles[j])
        for i in range(len(profiles))
        for j in range(i + 1, len(profiles))
    ]
    return round((sum(pairs) / len(pairs)) * 1.2, 2)


def _colour_note(items: List[Dict]) -> Optional[str]:
    profiles = [p for p in (_colour_profile(item) for item in items) if p]
    if len(profiles) < 2:
        return None
    if any(p["neutral"] for p in profiles):
        if all(p["neutral"] for p in profiles):
            return "a neutral palette that stays easy to style"
        return "neutral tones keep it balanced"
    if all(p["hue"] is not None for p in profiles):
        hues = [p["hue"] for p in profiles if p["hue"] is not None]
        spread = max(hues) - min(hues)
        if spread <= 30 or 360 - spread <= 30:
            return "tonal shades that read as one family"
    return "contrasting colours for a little interest"


# ── metadata matching ─────────────────────────────────────────────


def _occasions(item: Dict) -> List[str]:
    return [o for o in (item.get("suggested_occasions") or []) if o in VALID_OCCASIONS]


def _matches_occasion(item: Dict, occasion: Optional[str]) -> bool:
    """Missing occasion metadata never excludes an item."""
    if not occasion:
        return True
    tagged = _occasions(item)
    if not tagged:
        return True
    return occasion in tagged


def _matches_season(item: Dict, season: str) -> bool:
    """Missing or All-season items always fit; neighbours are acceptable."""
    tagged = _normalize_season(item.get("season"))
    if not tagged or tagged == "All-season":
        return True
    return tagged in SEASON_NEIGHBOURS.get(season, {season})


def _style_key(item: Dict) -> Optional[str]:
    return _normalize_style(item.get("style"))


# ── scoring ───────────────────────────────────────────────────────


def _score_combination(
    items: List[Dict],
    occasion: Optional[str],
    style: Optional[str],
    season: Optional[str] = None,
) -> float:
    """Score a combination from its metadata; higher is better (0–100)."""
    if not items:
        return 0.0

    score = 58.0
    categories = [item.get("category") for item in items]
    has_top = "Tops" in categories
    has_bottom = "Bottoms" in categories
    has_dress = "Dresses" in categories

    if has_top and has_bottom:
        score += 16
    if has_dress:
        score += 12

    accessory_bonus = 0.0
    for category, bonus in (("Outerwear", 4.0), ("Shoes", 3.0), ("Bags", 3.0)):
        if category in categories:
            accessory_bonus += bonus
    score += min(accessory_bonus, 8.0)

    if occasion:
        matching = sum(1 for item in items if occasion in _occasions(item))
        score += min(matching * 7.0, 14.0)

    if style:
        matching = sum(1 for item in items if _style_key(item) == style)
        score += min(matching * 7.0, 14.0)
    else:
        styles = {_style_key(item) for item in items if _style_key(item)}
        if len(styles) == 1:
            score += 2.0  # a coherent style even without a requested one

    score += colour_harmony_score(items)

    if season:
        tagged = [_normalize_season(item.get("season")) for item in items]
        if any(
            t and t != "All-season" and t in SEASON_NEIGHBOURS.get(season, {season})
            for t in tagged
        ):
            score += 5.0
        elif any(t == "All-season" for t in tagged):
            score += 3.0

    if len(items) < 2:
        score -= 8.0

    return round(min(max(score, 0.0), 100.0), 2)


def _score_combination_with_accessories(
    items: List[Dict],
    occasion: Optional[str],
    style: Optional[str],
    season: Optional[str] = None,
) -> float:
    """Accessories are already scored by category; keep a small extra reward."""
    return round(min(_score_combination(items, occasion, style, season) + 2, 100.0), 2)


def _score_accessory(
    base: List[Dict],
    accessory: Dict,
    occasion: Optional[str],
    style: Optional[str],
) -> float:
    score = colour_harmony_score([*base, accessory])
    if occasion and occasion in _occasions(accessory):
        score += 4
    if style and _style_key(accessory) == style:
        score += 4
    return score


# ── labels / explanations ─────────────────────────────────────────


def _best_occasion(items: List[Dict], preferred: Optional[str] = None) -> Optional[str]:
    all_occasions: set[str] = set()
    for item in items:
        all_occasions.update(_occasions(item))

    if not all_occasions:
        return preferred
    if preferred and preferred in all_occasions:
        return preferred
    return sorted(all_occasions)[0] if all_occasions else None


def _best_style(items: List[Dict], preferred: Optional[str] = None) -> Optional[str]:
    all_styles: set[str] = set()
    for item in items:
        item_style = _style_key(item)
        if item_style:
            all_styles.add(item_style)

    if not all_styles:
        return preferred
    if preferred and _valid_style(preferred) and preferred in all_styles:
        return preferred
    return sorted(all_styles)[0] if all_styles else None


def _best_occasion_single(item: Dict, preferred: Optional[str] = None) -> Optional[str]:
    occs = _occasions(item)
    if not occs:
        return preferred
    if preferred and preferred in occs:
        return preferred
    return occs[0]


def _best_style_single(item: Dict, preferred: Optional[str] = None) -> Optional[str]:
    item_style = _style_key(item)
    if item_style:
        return preferred if preferred and _valid_style(preferred) else item_style
    return preferred


def _names(items: List[Dict]) -> List[str]:
    return [str(item.get("item_name") or "item") for item in items]


def _join_names(names: List[str]) -> str:
    if not names:
        return ""
    if len(names) == 1:
        return names[0]
    if len(names) == 2:
        return f"{names[0]} with {names[1]}"
    return f"{names[0]} with {names[1]}, finished with {', '.join(names[2:])}"


def _build_top_bottom_explanation(
    top: Dict,
    bottom: Dict,
    occasion: Optional[str],
    style: Optional[str],
) -> str:
    top_name = top.get("item_name", "item")
    bottom_name = bottom.get("item_name", "item")
    lede = f"{top_name} with {bottom_name}"

    note = _colour_note([top, bottom])
    sentences = [f"{lede} — {note}." if note else f"{lede}."]

    if style:
        sentences.append(f"Styled for a {style.lower()} look.")
    elif top.get("style") and bottom.get("style"):
        sentences.append(f"{top['style']} and {bottom['style']} pieces work together.")

    if occasion:
        sentences.append(f"Good for {occasion.lower()}.")
    else:
        occs = set(_occasions(top)) | set(_occasions(bottom))
        if occs:
            sentences.append(f"Suited to {', '.join(sorted(occs)[:2]).lower()}.")

    return " ".join(sentences)


def _build_dress_explanation(
    dress: Dict,
    occasion: Optional[str],
    style: Optional[str],
) -> str:
    name = dress.get("item_name", "item")
    sentences = [f"{name}."]
    if dress.get("colour"):
        sentences.append(f"A {str(dress['colour']).lower()} piece that stands on its own.")
    if style:
        sentences.append(f"Styled for a {style.lower()} look.")
    elif dress.get("style"):
        sentences.append(f"Leans {str(dress['style']).lower()}.")
    if occasion:
        sentences.append(f"Good for {occasion.lower()}.")
    elif _occasions(dress):
        sentences.append(f"Suited to {', '.join(_occasions(dress)[:2]).lower()}.")
    return " ".join(sentences)


def _build_accessory_explanation(
    top: Dict,
    bottom: Dict,
    accessories: List[Dict],
    occasion: Optional[str],
    style: Optional[str],
) -> str:
    names = _names([top, bottom, *accessories])
    note = _colour_note([top, bottom, *accessories])
    sentences = [f"{_join_names(names)}."]
    if note:
        sentences.append(f"The {note}.")
    if style:
        sentences.append(f"Styled for a {style.lower()} look.")
    if occasion:
        sentences.append(f"Good for {occasion.lower()}.")
    return " ".join(sentences)


def _build_dress_accessory_explanation(
    dress: Dict,
    accessories: List[Dict],
    occasion: Optional[str],
    style: Optional[str],
) -> str:
    names = _names([dress, *accessories])
    note = _colour_note([dress, *accessories])
    sentences = [f"{_join_names(names)}."]
    if note:
        sentences.append(f"The {note}.")
    if style:
        sentences.append(f"Styled for a {style.lower()} look.")
    if occasion:
        sentences.append(f"Good for {occasion.lower()}.")
    return " ".join(sentences)


def _outfit_name(items: List[Dict]) -> str:
    """A readable name built from the real garment names (max 120 chars)."""
    names = _names(items)
    if not names:
        return "Untitled look"
    if len(names) == 1:
        return names[0][:120]
    if len(names) == 2:
        return f"{names[0]} + {names[1]}"[:120]
    return f"{names[0]} + {names[1]} + {len(names) - 2} more"[:120]


# ── generation ────────────────────────────────────────────────────


def _rotate(items: List[Dict], seed: int) -> List[Dict]:
    if not items:
        return items
    offset = seed % len(items)
    return items[offset:] + items[:offset]


def _select_with_variety(ranked: List[Dict], seed: int, limit: int) -> List[Dict]:
    """Rotate inside score bands so "Remix" changes the set, not the quality."""
    bands: Dict[int, List[Dict]] = {}
    for rec in ranked:
        bands.setdefault(int(rec.get("score", 0) // 5), []).append(rec)

    selected: List[Dict] = []
    for band in sorted(bands, reverse=True):
        selected.extend(_rotate(bands[band], seed))
        if len(selected) >= limit:
            break
    return selected[:limit]


def _build_candidates(
    wardrobe: List[Dict],
    occasion: Optional[str],
    style: Optional[str],
    season: str,
    seed: int,
) -> List[Dict]:
    pool = wardrobe
    if occasion:
        pool = [item for item in pool if _matches_occasion(item, occasion)]
    if style:
        pool = [item for item in pool if _style_key(item) == style]
    if occasion or style:
        # Season is a soft filter: only drop tagged items when some still
        # remain, so a thinly-tagged wardrobe never collapses to nothing.
        seasonal = [item for item in pool if _matches_season(item, season)]
        if seasonal:
            pool = seasonal

    tops = [i for i in pool if i.get("category") == "Tops"]
    bottoms = [i for i in pool if i.get("category") == "Bottoms"]
    dresses = [i for i in pool if i.get("category") == "Dresses"]
    outerwear = [i for i in pool if i.get("category") == "Outerwear"]
    shoes = [i for i in pool if i.get("category") == "Shoes"]
    bags = [i for i in pool if i.get("category") == "Bags"]

    def best_accessory(base: List[Dict], options: List[Dict]) -> Optional[Dict]:
        if not options:
            return None
        ranked = sorted(
            options,
            key=lambda accessory: _score_accessory(base, accessory, occasion, style),
            reverse=True,
        )
        return _rotate(ranked, seed)[0]

    recommendations: List[Dict] = []

    def add(items: List[Dict], rec_type: str, explanation: str, score: float) -> None:
        recommendations.append(
            {
                "items": items,
                "occasion": occasion or _best_occasion(items),
                "style": style or _best_style(items),
                "explanation": explanation,
                "score": score,
                "type": rec_type,
                "name": _outfit_name(items),
            }
        )

    for top in tops:
        for bottom in bottoms:
            base = [top, bottom]
            add(
                base,
                "top_and_bottom",
                _build_top_bottom_explanation(top, bottom, occasion, style),
                _score_combination(base, occasion, style, season),
            )

            accessories = [
                accessory
                for accessory in (
                    best_accessory(base, outerwear),
                    best_accessory(base, shoes),
                    best_accessory(base, bags),
                )
                if accessory is not None
            ]
            # One look per accessory (a blazer look and a sneakers look are
            # different outfits), plus the fully styled version. This keeps the
            # candidate pool large enough for Remix to return something new.
            for accessory in accessories:
                combo = [*base, accessory]
                add(
                    combo,
                    "top_bottom_accessory",
                    _build_accessory_explanation(top, bottom, [accessory], occasion, style),
                    _score_combination_with_accessories(combo, occasion, style, season),
                )
            if len(accessories) > 1:
                combo = [*base, *accessories]
                add(
                    combo,
                    "top_bottom_accessories",
                    _build_accessory_explanation(top, bottom, accessories, occasion, style),
                    _score_combination_with_accessories(combo, occasion, style, season),
                )

    for dress in dresses:
        base = [dress]
        add(
            base,
            "dress",
            _build_dress_explanation(dress, occasion, style),
            _score_combination(base, occasion, style, season),
        )

        accessories = [
            accessory
            for accessory in (
                best_accessory(base, outerwear),
                best_accessory(base, shoes),
                best_accessory(base, bags),
            )
            if accessory is not None
        ]
        for accessory in accessories:
            combo = [*base, accessory]
            add(
                combo,
                "dress_with_accessory",
                _build_dress_accessory_explanation(dress, [accessory], occasion, style),
                _score_combination_with_accessories(combo, occasion, style, season),
            )
        if len(accessories) > 1:
            combo = [*base, *accessories]
            add(
                combo,
                "dress_with_accessories",
                _build_dress_accessory_explanation(dress, accessories, occasion, style),
                _score_combination_with_accessories(combo, occasion, style, season),
            )

    return recommendations


async def get_recommendations(
    db: UserDB,
    user_id: str,
    occasion: Optional[str] = None,
    style: Optional[str] = None,
    include_accessories: bool = True,
    seed: int = 0,
    limit: int = 6,
) -> Dict[str, Any]:
    """Generate outfit recommendations from the user's own wardrobe.

    1. Read the user's wardrobe (never another user's rows).
    2. Apply occasion/style filters when the item has that metadata.
    3. Build category-compatible combinations and add matching accessories.
    4. Deduplicate by item-id set, score, then rotate within score bands by
       ``seed`` so Remix returns a different selection.
    """
    valid_occasion = _normalize_occasion(occasion) if occasion else None
    valid_style = _normalize_style(style) if style else None
    season = current_season()

    wardrobe = await _get_user_wardrobe(db, user_id)

    if not wardrobe:
        return {
            "outfits": [],
            "algorithm_info": {
                "source": "wardrobe",
                "message": "Your wardrobe is empty. Add some clothing items to get recommendations.",
                "item_count": 0,
                "sufficient": False,
                "filters": {
                    "occasion": valid_occasion,
                    "style": valid_style,
                    "season": season,
                },
            },
        }

    candidates = _build_candidates(
        wardrobe, valid_occasion, valid_style, season, max(seed, 0)
    )

    if not include_accessories:
        candidates = [
            rec
            for rec in candidates
            if not any(
                item.get("category") in ACCESSORY_CATEGORIES for item in rec["items"]
            )
        ]

    seen_keys: set[Tuple[str, ...]] = set()
    unique: List[Dict] = []
    for rec in candidates:
        key = tuple(sorted(str(item.get("id")) for item in rec["items"]))
        if not key or key in seen_keys:
            continue
        seen_keys.add(key)
        unique.append(rec)

    unique.sort(key=lambda rec: rec.get("score", 0), reverse=True)
    limited = _select_with_variety(unique, max(seed, 0), max(1, min(limit, 24)))

    if limited:
        message = (
            f"{len(limited)} look{'s' if len(limited) != 1 else ''} from "
            f"{len(wardrobe)} piece{'s' if len(wardrobe) != 1 else ''} in your wardrobe"
        )
    else:
        message = (
            "Not enough matching pieces yet. Add at least one top and one bottom, "
            "or a dress, to build a look."
        )

    return {
        "outfits": limited,
        "algorithm_info": {
            "source": "wardrobe",
            "message": message,
            "item_count": len(wardrobe),
            "candidate_count": len(unique),
            "sufficient": bool(limited),
            "filters": {
                "occasion": valid_occasion,
                "style": valid_style,
                "season": season,
            },
        },
    }


async def register_recommendation_outfits(
    user_id: str,
    recommendations: List[Dict],
    db: Any,
) -> List[Dict]:
    """Persist generated recommendations as outfits + outfit_items rows."""
    created = []

    for rec in recommendations:
        items = rec.get("items", [])
        item_ids = [str(item.get("id")) for item in items if item.get("id")]
        if not item_ids:
            continue

        combo_key = ",".join(sorted(item_ids))
        existing = await db.select(
            "outfits",
            {"select": "id", "combo_key": f"eq.{combo_key}", "user_id": f"eq.{user_id}"},
        )
        if existing:
            outfit_id = existing[0]["id"]
        else:
            created_outfit = await db.insert(
                "outfits",
                {
                    "user_id": user_id,
                    "outfit_name": rec.get("name") or _outfit_name(items),
                    "occasion": rec.get("occasion"),
                    "recommendation_score": rec.get("score", 50.0),
                    "styling_explanation": rec.get("explanation"),
                    "combo_key": combo_key,
                },
            )
            if not created_outfit:
                continue
            outfit_id = created_outfit[0]["id"]

        linked = {
            row["wardrobe_item_id"]
            for row in await db.select(
                "outfit_items",
                {"select": "wardrobe_item_id", "outfit_id": f"eq.{outfit_id}"},
            )
        }
        for item_id in item_ids:
            if item_id not in linked:
                await db.insert(
                    "outfit_items",
                    {
                        "user_id": user_id,
                        "outfit_id": outfit_id,
                        "wardrobe_item_id": item_id,
                    },
                )

        outfit_result = await _get_outfit_from_db(db, str(outfit_id))
        if outfit_result:
            created.append(outfit_result)

    return created


async def _get_outfit_from_db(db: Any, outfit_id: str) -> Optional[Dict]:
    outfit = await db.select("outfits", {"select": "*", "id": f"eq.{outfit_id}"})
    if not outfit:
        return None

    outfit = outfit[0]
    item_ids = [
        row["wardrobe_item_id"]
        for row in await db.select(
            "outfit_items",
            {"select": "wardrobe_item_id", "outfit_id": f"eq.{outfit_id}"},
        )
    ]

    if item_ids:
        items = await db.select(
            "wardrobe_items",
            {"select": "*", "id": f"in.({','.join(item_ids)})"},
        )
    else:
        items = []

    outfit["items"] = items
    return outfit
