"""Translate AI output into KAPDEEYY's existing schema.

Only fields the models actually produce are mapped. `pattern`, `season` and
`suggested_occasions` are deliberately absent: the models do not predict them,
so they are never invented. `condition` / `condition_note` have no database
columns (Phase 3B must not add migrations), so they stay suggestions.
"""

from __future__ import annotations

from typing import Any, Literal

# Database CHECK constraint values (database/migrations/001_init.sql).
VALID_CATEGORIES = (
    "Tops", "Bottoms", "Dresses", "Outerwear", "Shoes", "Bags", "Other",
)

# Frontend STYLES (frontend/src/utils/constants.js).
VALID_STYLES = ("Minimal", "Classic", "Casual", "Smart", "Street", "Romantic")

# RF-DETR checkpoint class names, in class-id order:
# ['Blazer', 'Dress', 'Halfsleeve', 'Hat', 'Hoodie', 'Jacket', 'Jeans',
#  'Longsleeve', 'Others', 'Pants', 'Shirt', 'Shorts', 'Skirt', 'Sleeveless',
#  'Sweater', 'T-shirt', 'Top', 'Trousers']
# label -> (database category, subcategory)
RF_DETR_LABELS: dict[str, tuple[str, str | None]] = {
    "Blazer": ("Outerwear", "Blazer"),
    "Dress": ("Dresses", "Dress"),
    "Halfsleeve": ("Tops", "Half-sleeve"),
    "Hat": ("Other", "Hat"),
    "Hoodie": ("Outerwear", "Hoodie"),
    "Jacket": ("Outerwear", "Jacket"),
    "Jeans": ("Bottoms", "Jeans"),
    "Longsleeve": ("Tops", "Long-sleeve"),
    "Others": ("Other", None),
    "Pants": ("Bottoms", "Pants"),
    "Shirt": ("Tops", "Shirt"),
    "Shorts": ("Bottoms", "Shorts"),
    "Skirt": ("Bottoms", "Skirt"),
    "Sleeveless": ("Tops", "Sleeveless"),
    "Sweater": ("Tops", "Sweater"),
    "T-shirt": ("Tops", "T-shirt"),
    "Top": ("Tops", "Top"),
    "Trousers": ("Bottoms", "Trousers"),
}

# Fallback when RF-DETR returns a label we do not know (or none at all).
GEMINI_CATEGORIES: dict[str, tuple[str, str | None]] = {
    "Top": ("Tops", None),
    "Bottom": ("Bottoms", None),
    "Outerwear": ("Outerwear", None),
    "Dress": ("Dresses", None),
    "Accessory": ("Other", None),
}

# Legacy Gemini style enum -> existing frontend style values.
# Extended to cover all valid frontend styles; unknown values gracefully map to None.
STYLE_MAP: dict[str, str] = {
    "casual": "Casual",
    "formal": "Smart",
    "sporty": "Casual",
    "streetwear": "Street",
    "minimal": "Minimal",
    "classic": "Classic",
    "romantic": "Romantic",
}


def map_label(label: str | None) -> tuple[str, str | None]:
    """Map a detection label to a valid category, else `Other`."""
    if not label:
        return "Other", None
    mapped = RF_DETR_LABELS.get(label.strip())
    if mapped is not None:
        return mapped
    # Case-insensitive tolerance for a label casing change in a future checkpoint.
    for known, values in RF_DETR_LABELS.items():
        if known.lower() == label.strip().lower():
            return values
    return "Other", None


def map_gemini_category(value: str | None) -> tuple[str, str | None] | None:
    if not value:
        return None
    return GEMINI_CATEGORIES.get(value.strip())


def map_style(value: str | None) -> str | None:
    if not value:
        return None
    return STYLE_MAP.get(value.strip().lower())


def _clean(value: Any, limit: int = 200) -> str | None:
    if not isinstance(value, str):
        return None
    value = " ".join(value.split())
    if not value:
        return None
    return value[:limit]


def build_suggestions(analysis: dict[str, Any], label: str | None) -> dict[str, Any]:
    """Return AI suggestions without touching the stored row.

    Category/subcategory come from the RF-DETR label; Gemini only supplies the
    human-facing name, colour, style and condition. Unknown labels fall back to
    a valid category and never cause the analysis to fail.
    """
    category, subcategory = map_label(label)
    if category == "Other":
        fallback = map_gemini_category(analysis.get("category"))
        if fallback is not None and (label is None or label.strip() == "Others"):
            category, subcategory = fallback

    if category not in VALID_CATEGORIES:  # defensive; maps above are valid
        category, subcategory = "Other", None

    item_name = _clean(analysis.get("item_name"), 80)
    style = map_style(analysis.get("style"))
    condition = _clean(analysis.get("condition"), 20)
    if condition not in {"good", "wrinkled", "stained", "damaged"}:
        condition = None
    condition_note = _clean(analysis.get("condition_note"), 300)

    return {
        "item_name": item_name,
        "category": category,
        "subcategory": subcategory,
        "colour": _clean(analysis.get("primary_color"), 60),
        "style": style if style in VALID_STYLES else None,
        "condition": condition,
        "condition_note": condition_note,
    }
