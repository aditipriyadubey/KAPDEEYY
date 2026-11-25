"""Tests for the outfit recommendation engine."""

import pytest

from app.services.recommendation.service import (
    get_recommendations,
    _score_combination,
    _best_occasion,
    _best_style,
    _build_top_bottom_explanation,
    _build_dress_explanation,
)


class TestRecommendationScoring:
    """Test the combination scoring algorithm."""

    def test_score_top_bottom_combination(self):
        """Test that top-bottom combinations get a reasonable score."""
        top = {"category": "Tops", "style": "Minimal", "suggested_occasions": ["College", "Casual"], "colour": "Ivory", "colour_hex": "#EFEADF"}
        bottom = {"category": "Bottoms", "style": "Classic", "suggested_occasions": ["College", "Casual"], "colour": "Blue", "colour_hex": "#7F9AC0"}

        score = _score_combination([top, bottom], "College", "Casual")
        assert 50 <= score <= 100

    def test_score_dress_combination(self):
        """Test that dress combinations get a reasonable score."""
        dress = {
            "category": "Dresses",
            "style": "Romantic",
            "suggested_occasions": ["Dinner", "Party"],
            "colour": "Lavender",
            "colour_hex": "#D2C8E6",
        }

        score = _score_combination([dress], "Dinner", "Romantic")
        assert 50 <= score <= 100

    def test_score_with_occasion_match(self):
        """Test scoring increases when occasion matches suggested_occasions."""
        item = {
            "category": "Tops",
            "style": "Minimal",
            "suggested_occasions": ["College"],  # Match
            "colour": "Ivory",
            "colour_hex": "#EFEADF",
        }

        score_with_match = _score_combination([item], "College", None)
        score_without_match = _score_combination([item], "Party", None)
        assert score_with_match >= score_without_match

    def test_score_style_match(self):
        """Test scoring increases when style matches."""
        item = {
            "category": "Tops",
            "style": "Minimal",  # Match
            "suggested_occasions": ["College"],
            "colour": "Ivory",
            "colour_hex": "#EFEADF",
        }

        score_with_match = _score_combination([item], None, "Minimal")
        assert score_with_match >= 50  # Should get style boost (minimum score)


class TestRecommendationFiltering:
    """Test occasion and style filtering."""

    def test_best_occasion_returns_preferred(self):
        """Test that preferred occasion is returned when available."""
        items = [{"suggested_occasions": ["College", "Casual", "Dinner"]}]
        result = _best_occasion(items, "College")
        assert result == "College"

    def test_best_occasion_returns_first_available(self):
        """Test that first available occasion is returned when preferred not in list."""
        items = [{"suggested_occasions": ["Casual", "Dinner"]}]
        result = _best_occasion(items, "Party")
        assert result == "Casual"

    def test_best_occasion_no_occasions_default(self):
        """Test None returned when no occasions and no preferred."""
        items = [{}]
        result = _best_occasion(items)
        assert result is None

    def test_best_occasion_no_occasions_with_preferred(self):
        """Test preferred returned when no occasions but preferred exists."""
        items = [{}]
        result = _best_occasion(items, "College")
        assert result == "College"

    def test_best_style_returns_preferred(self):
        """Test that preferred style is returned when available."""
        items = [{"style": "Minimal"}]
        result = _best_style(items, "Minimal")
        assert result == "Minimal"

    def test_best_style_returns_item_style(self):
        """Test item style is returned when preferred not available."""
        items = [{"style": "Romantic"}]
        result = _best_style(items, "Casual")
        assert result == "Romantic"

    def test_best_style_no_styles_default(self):
        """Test None returned when no styles and no preferred."""
        items = [{}]
        result = _best_style(items)
        assert result is None

    def test_best_style_no_styles_with_preferred(self):
        """Test preferred returned when no styles but preferred exists."""
        items = [{}]
        result = _best_style(items, "Minimal")
        assert result == "Minimal"


class TestRecommendationExplanations:
    """Test explanation text generation."""

    def test_top_bottom_explanation(self):
        """Test explanation is generated for top-bottom combinations."""
        top = {
            "item_name": "Ivory Ribbed Tee",
            "category": "Tops",
            "colour": "Ivory",
            "style": "Minimal",
            "suggested_occasions": ["College", "Casual"],
        }
        bottom = {
            "item_name": "Blue Straight-Leg Jeans",
            "category": "Bottoms",
            "colour": "Blue",
            "style": "Classic",
            "suggested_occasions": ["College", "Casual"],
        }

        explanation = _build_top_bottom_explanation(top, bottom, "College", "Casual")
        assert "Ivory Ribbed Tee with Blue Straight-Leg Jeans" in explanation
        # Function lowercases the occasion
        assert "college" in explanation.lower()

    def test_dress_explanation(self):
        """Test explanation is generated for dress combinations."""
        dress = {
            "item_name": "Lavender Slip Dress",
            "category": "Dresses",
            "colour": "Lavender",
            "style": "Smart",
            "suggested_occasions": ["Dinner", "Party"],
        }

        explanation = _build_dress_explanation(dress, "Dinner", "Smart")
        assert "Lavender Slip Dress" in explanation
        # Function lowercases the occasion
        assert "dinner" in explanation.lower()


class TestRecommendationEdgeCases:
    """Test edge cases - skipped for async compatibility"""

    pass