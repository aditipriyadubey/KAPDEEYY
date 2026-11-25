import json
import random
import uuid
from datetime import date
from pathlib import Path
from typing import Literal

import numpy as np
import ollama
from google import genai
from PIL import Image
from pydantic import BaseModel
from rfdetr import RFDETRSegSmall

# --- Paths & Storage ---
MODEL_PATH = str(Path(__file__).resolve().parent / "checkpoint_best_total.pth")
DATA_DIR = Path("closet_data")
CUTOUT_DIR = DATA_DIR / "cutouts"
CLOSET_DB = DATA_DIR / "closet.json"
FEEDBACK_DB = DATA_DIR / "feedback.json"

CUTOUT_DIR.mkdir(parents=True, exist_ok=True)

_SEG_MODEL = None


# --- Pydantic Schemas ---
class GarmentInfo(BaseModel):
    category: Literal["Top", "Bottom", "Outerwear", "Dress", "Accessory"]
    item_name: str
    primary_color: str
    style: Literal["casual", "formal", "sporty", "streetwear"]
    condition: Literal["good", "wrinkled", "stained", "damaged"]
    condition_note: str


class OutfitSuggestion(BaseModel):
    outfit_title: str   # e.g., "Soft & Smart"
    tagline: str        # e.g., "Relaxed, polished layers for a full day on campus"
    selected_ids: list[str]
    why_it_works: str   # 1-2 sentences explaining color, silhouette, and occasion fit


# --- Category Auto-Repair & Closet Storage ---
def normalize_category(data: dict) -> dict:
    name_lower = data.get("item_name", "").lower()
    if any(w in name_lower for w in ["jacket", "coat", "blazer", "hoodie", "cardigan"]):
        data["category"] = "Outerwear"
    elif any(w in name_lower for w in ["jean", "pant", "trouser", "shorts", "skirt", "legging", "chino"]):
        data["category"] = "Bottom"
    elif any(w in name_lower for w in ["dress", "gown", "jumpsuit"]):
        data["category"] = "Dress"
    elif any(w in name_lower for w in ["shirt", "blouse", "tee", "top", "sweater", "kurta", "polo"]):
        data["category"] = "Top"
    return data


def load_closet() -> list[dict]:
    if CLOSET_DB.exists():
        items = json.loads(CLOSET_DB.read_text(encoding="utf-8"))
        return [normalize_category(item) for item in items]
    return []


def save_closet(items: list[dict]) -> None:
    CLOSET_DB.write_text(json.dumps(items, indent=2), encoding="utf-8")


# --- Expanded Feedback & History Storage ---
def load_feedback() -> dict:
    default = {
        "times_selected": {},
        "wear_history": [],
        "saved_outfits": [],
        "liked_pairs": [],
        "disliked_pairs": [],
    }
    if FEEDBACK_DB.exists():
        data = json.loads(FEEDBACK_DB.read_text(encoding="utf-8"))
        for k, v in default.items():
            data.setdefault(k, v)
        return data
    return default


def save_feedback(fb: dict) -> None:
    FEEDBACK_DB.write_text(json.dumps(fb, indent=2), encoding="utf-8")


def record_wear_and_like(suggestion: dict, occasion: str) -> dict:
    """Logs a worn/liked outfit for wear counts, Style Calendar, and preference learning."""
    fb = load_feedback()
    pair_ids = sorted(suggestion["selected_ids"])

    for item_id in pair_ids:
        fb["times_selected"][item_id] = fb["times_selected"].get(item_id, 0) + 1

    if pair_ids not in fb["liked_pairs"]:
        fb["liked_pairs"].append(pair_ids)

    fb["wear_history"].append({
        "date": date.today().isoformat(),
        "outfit_title": suggestion.get("outfit_title", "Custom Look"),
        "occasion": occasion,
        "selected_ids": pair_ids,
    })
    save_feedback(fb)
    return fb


def save_outfit_to_favorites(suggestion: dict, occasion: str) -> dict:
    """Saves an outfit to Saved Outfits without necessarily marking it worn today."""
    fb = load_feedback()
    pair_ids = sorted(suggestion["selected_ids"])
    already_saved = any(sorted(o["selected_ids"]) == pair_ids for o in fb["saved_outfits"])
    if not already_saved:
        fb["saved_outfits"].append({
            "id": f"outfit_{uuid.uuid4().hex[:6]}",
            "outfit_title": suggestion.get("outfit_title", "Saved Look"),
            "tagline": suggestion.get("tagline", ""),
            "occasion": occasion,
            "selected_ids": pair_ids,
            "why_it_works": suggestion.get("why_it_works", ""),
        })
        save_feedback(fb)
    return fb


def record_dislike(selected_ids: list[str]) -> dict:
    """Penalizes only the specific combination, never hard-banning individual items."""
    fb = load_feedback()
    pair_ids = sorted(selected_ids)
    if pair_ids not in fb["disliked_pairs"]:
        fb["disliked_pairs"].append(pair_ids)
    save_feedback(fb)
    return fb


def get_wardrobe_insights(closet_items: list[dict] | None = None) -> dict:
    """Powers Home & Fashion Insights: Most worn, Overlooked items, and Wardrobe mix."""
    closet = closet_items if closet_items is not None else load_closet()
    fb = load_feedback()
    counts = fb["times_selected"]

    most_worn = sorted(
        [i for i in closet if counts.get(i["id"], 0) > 0],
        key=lambda x: counts.get(x["id"], 0),
        reverse=True,
    )[:4]

    overlooked = [i for i in closet if counts.get(i["id"], 0) == 0]

    total = len(closet) or 1
    mix = {}
    for cat in ("Top", "Bottom", "Outerwear", "Dress", "Accessory"):
        c = sum(1 for i in closet if i["category"] == cat)
        mix[cat] = {"count": c, "percent": round((c / total) * 100)}

    return {
        "most_worn": most_worn,
        "overlooked": overlooked,
        "wardrobe_mix": mix,
        "wear_history": fb["wear_history"],
        "saved_outfits": fb["saved_outfits"],
    }


# --- Module 1: Local RF-DETR Segmentation ---
def load_segmentation_model():
    global _SEG_MODEL
    if _SEG_MODEL is None:
        _SEG_MODEL = RFDETRSegSmall(pretrain_weights=MODEL_PATH, num_classes=18)
    return _SEG_MODEL


def segment_garment(image: Image.Image, threshold: float = 0.25) -> Image.Image | None:
    model = load_segmentation_model()
    rgb_image = image.convert("RGB")
    detections = model.predict(rgb_image, threshold=threshold)

    if len(detections) == 0 or detections.mask is None:
        return None

    best_idx = int(np.argmax(detections.confidence))
    mask = detections.mask[best_idx]

    img_np = np.array(rgb_image)
    rgba = np.dstack((img_np, (mask * 255).astype(np.uint8)))

    ys, xs = np.where(mask)
    if len(ys) == 0 or len(xs) == 0:
        return None

    return Image.fromarray(rgba[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1])


# --- Module 2: Hybrid VLM Analysis ---
ANALYZE_PROMPT = (
    "Analyze this segmented clothing item. Identify its category "
    "(Top = shirts, t-shirts, blouses, sweaters; Bottom = jeans, pants, trousers, shorts, skirts; "
    "Outerwear = jackets, coats, blazers, hoodies; Dress = dresses; Accessory = hats, bags, scarves). "
    "For item_name, use a clean 2-3 word boutique-style title combining color, cut/fabric, and garment "
    "(e.g., 'Ivory Knit Sweater', 'Black Tailored Top', 'Straight Blue Jeans'). "
    "Also identify primary_color, style, and visible condition (wrinkles, stains, or tears)."
)


def analyze_garment(image_path: str, gemini_key: str = "", ollama_model: str = "qwen3-vl:4b") -> dict:
    warning = None
    if gemini_key:
        try:
            client = genai.Client(api_key=gemini_key)
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[Image.open(image_path), ANALYZE_PROMPT],
                config={
                    "response_mime_type": "application/json",
                    "response_json_schema": GarmentInfo.model_json_schema(),
                },
            )
            data = GarmentInfo.model_validate_json(response.text).model_dump()
            data["source"] = "Online (Gemini)"
            return normalize_category(data)
        except Exception as e:
            warning = f"Online VLM unavailable ({e}). Switched to offline Ollama."

    response = ollama.chat(
        model=ollama_model,
        messages=[{"role": "user", "content": ANALYZE_PROMPT, "images": [image_path]}],
        format=GarmentInfo.model_json_schema(),
        think=False,
    )
    data = GarmentInfo.model_validate_json(response["message"]["content"]).model_dump()
    data["source"] = f"Offline ({ollama_model})"
    if warning:
        data["warning"] = warning
    return normalize_category(data)


# --- Module 3: Occasion, Weather & Style-Aware Outfit Pairing ---
OCCASION_STYLE_MAP = {
    "Casual college day": ["casual", "streetwear"],
    "Formal / presentation": ["formal"],
    "Evening hangout": ["streetwear", "casual"],
    "Sporty / active": ["sporty", "casual"],
}

STYLE_PREFERENCE_HINTS = {
    "Balanced": "Keep the look versatile, clean, and well-proportioned.",
    "Soft & Smart": "Prioritize relaxed yet polished pieces, soft neutrals, and clean layering.",
    "Minimalist": "Favor monochrome or muted tones, simple silhouettes, and zero clutter.",
    "Streetwear": "Lean into relaxed fits, denim, bold layering, and effortless urban energy.",
    "Classic / Tailored": "Prioritize structured pieces, crisp shirts, blazers, and timeless pairings.",
}

WEATHER_RULES = {
    "Summer / Hot": "Pick ONLY 2 items (Top + Bottom). Do NOT add jackets, coats, or hoodies (allow a blazer only if Formal).",
    "Winter / Cold": "Pick 3 items (Top + Bottom + Outerwear like a jacket, hoodie, or blazer) for warmth.",
    "Spring / Mild": "Pick Top + Bottom. Adding a light Outerwear layer is OPTIONAL—only include it if it elevates the look.",
    "Rainy / Monsoon": "Pick Top + Bottom. Avoid heavy/delicate outerwear; a light jacket is optional.",
}

FORMAL_BLOCK = (
    "t-shirt", "tee", "princess", "hoodie", "shorts", "jogger",
    "sweatpant", "graphic", "flannel", "plaid", "denim", "jean", "beaded",
)
FORMAL_PREFER = (
    "shirt", "blouse", "trouser", "pant", "chino", "blazer", "coat", "polo", "formal",
)


def suggest_outfit(
    closet_items: list[dict],
    occasion: str,
    weather: str = "Spring / Mild",
    style_preference: str = "Balanced",
    gemini_key: str = "",
    ollama_model: str = "qwen3-vl:4b",
    last_ids: list[str] | None = None,
) -> dict:
    wearable = [
        {k: v for k, v in item.items() if k != "image_path"}
        for item in closet_items
        if item.get("condition") not in ("stained", "damaged")
    ]
    if len(wearable) < 2:
        return {
            "outfit_title": "Not Enough Items",
            "tagline": "",
            "selected_ids": [],
            "why_it_works": "Add at least 2 wearable items to your closet to generate a remix.",
        }

    random.shuffle(wearable)

    fb = load_feedback()
    counts = fb["times_selected"]
    disliked = fb["disliked_pairs"]
    liked = fb["liked_pairs"]

    # 70/30 Exploration vs. Exploitation
    least_worn = sorted(wearable, key=lambda x: counts.get(x["id"], 0))[:4]
    least_worn_ids = [i["id"] for i in least_worn]
    is_discovery = random.random() < 0.30

    mode_instruction = (
        f"DISCOVERY MODE: Include at least one under-worn item from {least_worn_ids} so the user rediscovers their closet."
        if is_discovery
        else f"COMFORT MODE: Lean toward vibes similar to the user's liked combinations ({liked[-3:]}), while keeping it fresh."
    )

    avoid_note = f"Do NOT repeat the previous outfit {last_ids}." if last_ids else ""
    dislike_note = f"NEVER pair these exact disliked combinations: {disliked}." if disliked else ""
    weather_rule = WEATHER_RULES.get(weather, "")
    style_hint = STYLE_PREFERENCE_HINTS.get(style_preference, "")

    prompt = (
        f"You are a personal fashion stylist. Create 1 complete outfit for '{occasion}' "
        f"in '{weather}' weather matching the user's '{style_preference}' aesthetic ({style_hint}) "
        f"using ONLY these wearable items:\n"
        f"{json.dumps(wearable, indent=2)}\n\n"
        f"Rules:\n"
        f"- Weather/Layering: {weather_rule}\n"
        f"- {mode_instruction}\n"
        f"- {avoid_note}\n"
        f"- {dislike_note}\n"
        f"- Return JSON with: 'outfit_title' (2-3 word vibe name like 'Soft & Smart'), "
        f"'tagline' (short 1-line subtitle), 'selected_ids' (valid IDs from above), "
        f"and 'why_it_works' (1-2 sentences explaining why the colors, style, and layers work)."
    )

    warning = None
    if gemini_key:
        try:
            client = genai.Client(api_key=gemini_key)
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config={
                    "response_mime_type": "application/json",
                    "response_json_schema": OutfitSuggestion.model_json_schema(),
                    "temperature": 0.8,
                },
            )
            res = OutfitSuggestion.model_validate_json(response.text).model_dump()
            res["source"] = "Online (Gemini)"
            res["mode"] = "Discovery" if is_discovery else "Comfort"
            return res
        except Exception as e:
            warning = f"Online VLM unavailable ({e}). Switched to offline."

    try:
        response = ollama.chat(
            model=ollama_model,
            messages=[{"role": "user", "content": prompt}],
            format=OutfitSuggestion.model_json_schema(),
            think=False,
            options={"temperature": 0.8},
        )
        content = response["message"]["content"].strip()
        if content:
            res = OutfitSuggestion.model_validate_json(content).model_dump()
            res["source"] = f"Offline ({ollama_model})"
            res["mode"] = "Discovery" if is_discovery else "Comfort"
            if warning:
                res["warning"] = warning
            return res
    except Exception as e:
        warning = f"Ollama skipped ({e}). Used Rule Engine."

    # Guaranteed Occasion + Weather-aware Rule Engine Fallback
    target_styles = OCCASION_STYLE_MAP.get(occasion, ["casual"])
    categories = ["Top", "Bottom"]
    if weather == "Winter / Cold" or occasion == "Formal / presentation":
        categories.append("Outerwear")
    elif weather in ("Spring / Mild", "Rainy / Monsoon") and random.random() < 0.5:
        categories.append("Outerwear")

    picked = []
    for cat in categories:
        candidates = [i for i in wearable if i["category"] == cat and i["id"] not in (last_ids or [])]
        if not candidates:
            candidates = [i for i in wearable if i["category"] == cat]

        if occasion == "Formal / presentation":
            clean = [i for i in candidates if not any(w in i["item_name"].lower() for w in FORMAL_BLOCK)]
            candidates = clean or candidates
            styled = [
                i for i in candidates
                if i["style"] == "formal" or any(w in i["item_name"].lower() for w in FORMAL_PREFER)
            ] or candidates
        else:
            styled = [i for i in candidates if i["style"] in target_styles] or candidates

        if styled:
            styled.sort(key=lambda x: counts.get(x["id"], 0))
            picked.append(random.choice(styled[:3]))

    if len(picked) < 2:
        picked = wearable[:2]

    names = ", ".join(i["item_name"] for i in picked)
    res = {
        "outfit_title": f"{style_preference} Edit",
        "tagline": f"Ready for a {occasion.lower()} in {weather.lower()} weather.",
        "selected_ids": [i["id"] for i in picked],
        "why_it_works": f"Paired {names} to balance your {style_preference.lower()} preference with the weather and occasion.",
        "source": "Offline (Rule Engine)",
        "mode": "Discovery" if is_discovery else "Comfort",
    }
    if warning:
        res["warning"] = warning
    return res