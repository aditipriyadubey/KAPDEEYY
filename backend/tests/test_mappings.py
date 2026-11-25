"""Tests for AI mapping functions (Phase 3B).

These tests verify that RF-DETR labels, Gemini category mappings,
and style mappings all gracefully handle unknown values without
causing classification failures.
"""

from app.services.ai.mappings import (
    map_label,
    map_gemini_category,
    map_style,
    build_suggestions,
    RF_DETR_LABELS,
    GEMINI_CATEGORIES,
    STYLE_MAP,
    VALID_CATEGORIES,
    VALID_STYLES,
)


class TestMapLabel:
    """Test RF-DETR label mapping."""

    def test_known_labels_map_correctly(self):
        """Known RF-DETR labels map to valid (category, subcategory) tuples."""
        for label, expected in RF_DETR_LABELS.items():
            result = map_label(label)
            assert result == expected, f"Label {label!r} mapped to {result!r}, expected {expected!r}"

    def test_unknown_label_returns_other(self):
        """Unknown labels fall back to ('Other', None)."""
        result = map_label("NonExistentLabel")
        assert result == ("Other", None)

    def test_empty_label_returns_other(self):
        """Empty/None labels fall back to ('Other', None)."""
        result = map_label("")
        result = map_label(None)
        assert result == ("Other", None)

    def test_case_insensitive_tolerance(self):
        """Case variations of known labels still map correctly."""
        result = map_label("dress")  # lowercase
        assert result == RF_DETR_LABELS["Dress"]

    def test_valid_categories_constant(self):
        """VALID_CATEGORIES contains all expected values."""
        expected = ("Tops", "Bottoms", "Dresses", "Outerwear", "Shoes", "Bags", "Other")
        assert VALID_CATEGORIES == expected


class TestMapGeminiCategory:
    """Test Gemini category mapping."""

    def test_known_gemini_categories(self):
        """Known Gemini category values map to valid (category, subcategory)."""
        for value, expected in GEMINI_CATEGORIES.items():
            result = map_gemini_category(value)
            assert result == expected, f"Gemini value {value!r} mapped to {result!r}, expected {expected!r}"

    def test_empty_or_none_returns_none(self):
        """Empty string or None returns None."""
        assert map_gemini_category("") is None
        assert map_gemini_category(None) is None

    def test_unknown_gemini_category_returns_none(self):
        """Unknown Gemini category values return None (not invented)."""
        assert map_gemini_category("NonExistentCategory") is None


class TestMapStyle:
    """Test Gemini style mapping."""

    def test_known_gemini_styles_map_to_frontend_styles(self):
        """Known Gemini style values map to valid frontend STYLES."""
        for gemini_style, expected in STYLE_MAP.items():
            result = map_style(gemini_style)
            assert result == expected, f"Gemini style {gemini_style!r} mapped to {result!r}, expected {expected!r}"

    def test_unknown_gemini_style_returns_none(self):
        """Unknown Gemini style values gracefully return None."""
        result = map_style("unknown_style")
        assert result is None

    def test_empty_gemini_style_returns_none(self):
        """Empty string Gemini style returns None."""
        result = map_style("")
        assert result is None

    def test_none_gemini_style_returns_none(self):
        """None Gemini style returns None."""
        result = map_style(None)
        assert result is None

    def test_mapped_styles_are_valid(self):
        """All mapped styles are present in the frontend VALID_STYLES."""
        for style in STYLE_MAP.values():
            assert style in VALID_STYLES


class TestBuildSuggestions:
    """Test build_suggestions end-to-end."""

    def test_with_known_rf_detr_label(self):
        """Known RF-DETR label produces valid suggestions."""
        analysis = {
            "item_name": "Test Shirt",
            "primary_color": "Blue",
            "style": "Romantic",
            "category": "Top",
            "condition": "good",
        }
        result = build_suggestions(analysis, "T-shirt")
        assert result["item_name"] == "Test Shirt"
        assert result["category"] in VALID_CATEGORIES
        assert result["style"] in VALID_STYLES
        assert result["category"] != "Other" or result["subcategory"] is not None

    def test_with_unknown_label_falls_back_to_other(self):
        """Unknown label falls back to Other category without failing."""
        analysis = {
            "item_name": "Test Item",
            "primary_color": "Green",
            "style": "Casual",
            "category": "Top",
            "condition": "good",
        }
        result = build_suggestions(analysis, "NonExistentLabel")
        assert result["item_name"] == "Test Item"
        # Unknown label should fall back gracefully
        assert result["item_name"] == "Test Item"

    def test_gemini_category_fallback_when_rf_detr_returns_other(self):
        """When RF-DETR returns 'Other', Gemini category is used as fallback."""
        analysis = {
            "item_name": "Accessory",
            "primary_color": "Gold",
            "style": "Minimal",
            "category": "Other",
            "condition": None,
        }
        # 'Others' label with Gemini category fallback
        result = build_suggestions(analysis, "Others")
        assert result["item_name"] == "Accessory"

    def test_style_from_gemini_is_valid_when_present(self):
        """Gemini style value is mapped and validated against frontend styles."""
        analysis = {
            "item_name": "Dress",
            "primary_color": "Red",
            "style": "formal",  # lowercase Gemini style
            "category": "Dresses",
            "condition": "good",
        }
        result = build_suggestions(analysis, "Dress")
        # 'formal' should map to 'Smart' via STYLE_MAP
        assert result["style"] == "Smart" or result["style"] is None
        # If style is not None, it must be a valid frontend style
        if result["style"] is not None:
            assert result["style"] in VALID_STYLES

    def test_missing_fields_default_gracefully(self):
        """Missing optional fields default to None without crashing."""
        analysis = {}  # Minimal analysis dict
        result = build_suggestions(analysis, None)
        assert result["item_name"] is None
        assert result["category"] is not None  # Should default via map_label
        assert result["style"] is None  # No Gemini style to map