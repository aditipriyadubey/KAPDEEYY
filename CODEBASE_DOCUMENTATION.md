# Closet Remix — Codebase Documentation

## 1. Overview

Closet Remix is a local-first outfit recommendation application built with Python and Streamlit. It lets a user upload garment photos, identify and isolate the clothing item, classify it with an online or offline vision-language model (VLM), store it in a digital closet, and generate occasion-, weather-, style-, and feedback-aware outfit suggestions.

The application has four main areas:

1. **Add Garment** — uploads clothing photos, segments garments, analyzes them, and saves them.
2. **My Closet** — shows all saved garments and supports removal.
3. **Outfit Studio** — generates outfit combinations and records likes, dislikes, saved outfits, and wear history.
4. **Insights & History** — summarizes wardrobe composition and garment usage.

The code has two Python modules:

- `app.py` — Streamlit presentation layer and user workflow.
- `backend.py` — segmentation, VLM analysis, JSON storage, outfit generation, and insights.

## 2. Project Structure

```text
closet-remix-demo/
├── app.py                         # Streamlit entrypoint and UI
├── backend.py                     # Business logic and data storage
├── requirements.txt               # Python dependencies
├── checkpoint_best_total.pth      # RF-DETR segmentation weights
├── feedback.json                  # Empty top-level feedback placeholder
└── closet_data/
    ├── closet.json                # Digital closet records
    ├── feedback.json              # Likes, dislikes, history, and item usage
    └── cutouts/                   # Segmented garment PNG images
```

The application is run from `app.py`. RF-DETR and the JSON databases use the project structure as follows:

- `MODEL_PATH` is resolved relative to `backend.py`, so the weight file must remain at the project root.
- `DATA_DIR`, `CUTOUT_DIR`, `CLOSET_DB`, and `FEEDBACK_DB` are relative to the process working directory. Run the app from the project root.

## 3. Requirements

### Python dependencies

The dependencies in `requirements.txt` are:

| Module | Purpose |
|---|---|
| `streamlit` | Web UI, tabs, widgets, caching, and session state |
| `rfdetr` | RF-DETR model loading and garment segmentation |
| `supervision` | Installed segmentation ecosystem dependency |
| `pillow` | Image loading and RGBA cutout creation |
| `numpy` | Masks, array operations, and confidence selection |
| `google-genai` | Google Gemini API client |
| `ollama` | Ollama Python client for local VLM inference |
| `pydantic` | Typed JSON schemas and response validation |

Install them with:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

### Required local files

- `checkpoint_best_total.pth` must exist at the project root.
- `closet_data/` is created automatically by `backend.py`.
- `closet_data/cutouts/` is created automatically.
- `closet_data/closet.json` and `closet_data/feedback.json` are created or loaded at runtime.

### Offline requirements

For offline garment analysis and outfit generation, Ollama must be installed and running, and the configured model must be available locally.

```bash
ollama pull qwen3-vl:4b
```

The default model in both `app.py` and `backend.py` is `qwen3-vl:4b`. It can be changed in the Streamlit sidebar or passed as a function argument.

### Optional online requirements

Gemini is optional. Supply a Google Gemini API key in the sidebar to use `gemini-2.5-flash`. If Gemini fails or the key is blank, the application attempts Ollama. If Ollama also fails, outfit suggestion falls back to the built-in rule engine.

## 4. Running the Application

From the project root:

```bash
streamlit run app.py
```

Open the local URL printed by Streamlit, usually `http://localhost:8501`.

Upload JPG, JPEG, or PNG images in the first tab. The segmentation confidence threshold defaults to `0.25` and can be adjusted from `0.15` to `0.70` in the sidebar.

## 5. UI Entry Module: `app.py`

### Streamlit configuration

`st.set_page_config()` is used to set the page title to `Closet Remix` and use a wide layout.

### Cached model loader

```python
@st.cache_resource
def get_cached_model():
    return backend.load_segmentation_model()
```

- **Input:** None.
- **Output:** One shared `RFDETRSegSmall` model instance.
- **Purpose:** Avoids reloading the segmentation model on every Streamlit rerun.

### Sidebar inputs

- **Gemini API Key:** Optional password-style text input. Blank means offline-only use.
- **Offline Ollama Model:** Text input; defaults to `qwen3-vl:4b`.
- **RF-DETR Confidence Threshold:** Slider range `0.15`–`0.70`; default `0.25`.
- **Model status:** Reports whether `checkpoint_best_total.pth` exists.

### Add Garment tab

**Input:**

- One or more JPG, JPEG, or PNG files.
- Segmentation threshold.
- Optional Gemini key.
- Ollama model name.

**Processing:**

1. Opens each uploaded image with Pillow.
2. Calls `backend.segment_garment()`.
3. Creates a unique ID such as `item_a1b2c3`.
4. Saves the segmented RGBA cutout under `closet_data/cutouts/`.
5. Calls `backend.analyze_garment()` to obtain garment metadata.
6. Appends the record to `closet_data/closet.json`.

**Output:** Original image, segmented cutout, success/error messages, and a saved closet record.

### My Closet tab

Loads `closet_data/closet.json` and displays four garment cards per row.

Each card shows:

- Garment cutout
- Item name
- Category
- Primary color
- Style
- Garment condition

The **Remove** button deletes the selected record from JSON storage and reruns the Streamlit app.

### Outfit Studio tab

**Inputs:**

- Occasion: casual, formal, evening, or sporty.
- Weather: spring, summer, winter, or rainy.
- Style preference: balanced, soft & smart, minimalist, streetwear, or classic/tailored.
- Generated outfit session state.

**Generate Outfit Pairing** calls `backend.suggest_outfit()` and stores the returned suggestion in `st.session_state["current_outfit"]`.

The displayed suggestion includes:

- Outfit title
- Tagline
- Source and mode
- Selected garment cutouts
- Why-it-works explanation
- Three feedback actions:
  - **Wear / Like** — records wear and preference.
  - **Save Outfit** — saves the combination.
  - **Dislike Pair** — records the exact combination for future avoidance.

### Insights tab

Calls `backend.get_wardrobe_insights()` and displays:

- Wardrobe category percentages across five categories.
- Item counts by category.
- Most-worn pieces.
- Up to six overlooked pieces that have never been logged as worn.

## 6. Backend Module: `backend.py`

## 6.1 Pydantic response schemas

### `GarmentInfo`

Validated fields returned from garment analysis:

| Field | Type | Allowed values or format |
|---|---|---|
| `category` | Literal string | `Top`, `Bottom`, `Outerwear`, `Dress`, `Accessory` |
| `item_name` | String | Clean boutique-style garment name |
| `primary_color` | String | Main garment color |
| `style` | Literal string | `casual`, `formal`, `sporty`, `streetwear` |
| `condition` | Literal string | `good`, `wrinkled`, `stained`, `damaged` |
| `condition_note` | String | Visible-condition explanation |

The VLM response is converted into a dictionary and enriched by the analysis source.

### `OutfitSuggestion`

| Field | Type | Purpose |
|---|---|---|
| `outfit_title` | String | Short two- or three-word vibe name |
| `tagline` | String | One-line subtitle |
| `selected_ids` | List of strings | Valid IDs from the digital closet |
| `why_it_works` | String | One- or two-sentence styling explanation |

Outfit responses are additionally enriched with:

- `source`: `Online (Gemini)`, `Offline (<model>)`, or `Offline (Rule Engine)`.
- `mode`: `Discovery` or `Comfort`.
- `warning`: present only when fallback behavior occurs.

## 6.2 Closet normalization and storage

### `normalize_category(data: dict) -> dict`

- **Input:** Garment dictionary.
- **Output:** Dictionary with category repaired from `item_name`.
- **Purpose:** Corrects category mistakes from VLM output using garment-name keywords.
- **Keyword rules:** jackets/coats/blazers/hoodies/cardigans become Outerwear; jeans/pants/skirts/shorts become Bottom; dresses/gowns/jumpsuits become Dress; shirts/blouses/tees/sweaters/kurta/polo become Top.

### `load_closet() -> list[dict]`

- **Input:** None.
- **Output:** A list of closet records, or an empty list.
- **Behavior:** Reads `closet_data/closet.json` and normalizes every item's category.

### `save_closet(items: list[dict]) -> None`

- **Input:** Complete closet item list.
- **Output:** None.
- **Behavior:** Writes indented JSON to `closet_data/closet.json`.

## 6.3 Feedback and history storage

The feedback JSON contains:

```text
times_selected  # item ID -> number of wear/like selections
wear_history    # date, title, occasion, and selected item IDs
saved_outfits   # favorited outfit records
liked_pairs     # unique liked combinations
disliked_pairs  # unique disliked combinations
```

### `load_feedback() -> dict`

- **Input:** None.
- **Output:** Feedback dictionary with default keys.
- **Behavior:** Reads `closet_data/feedback.json`; missing keys are added with empty defaults.

### `save_feedback(fb: dict) -> None`

- **Input:** Complete feedback dictionary.
- **Output:** None.
- **Behavior:** Writes JSON to `closet_data/feedback.json`.

### `record_wear_and_like(suggestion: dict, occasion: str) -> dict`

- **Input:** Outfit suggestion and occasion label.
- **Output:** Updated feedback dictionary.
- **Behavior:**
  - Sorts selected IDs.
  - Increments `times_selected` for each garment.
  - Adds the combination to liked pairs.
  - Adds a dated entry to wear history.

### `save_outfit_to_favorites(suggestion: dict, occasion: str) -> dict`

- **Input:** Outfit suggestion and occasion label.
- **Output:** Updated feedback dictionary.
- **Behavior:** Adds one unique saved-outfit record containing its title, tagline, occasion, IDs, and explanation.

### `record_dislike(selected_ids: list[str]) -> dict`

- **Input:** List of selected garment IDs.
- **Output:** Updated feedback dictionary.
- **Behavior:** Adds the exact sorted combination to disliked pairs. Individual garments are not banned.

### `get_wardrobe_insights(closet_items: list[dict] | None = None) -> dict`

- **Input:** Optional closet list; otherwise loads it from disk.
- **Output:**

```python
{
    "most_worn": [...],
    "overlooked": [...],
    "wardrobe_mix": {
        "Top": {"count": 0, "percent": 0},
        # Other categories...
    },
    "wear_history": [...],
    "saved_outfits": [...],
}
```

- **Behavior:** Ranks up to four most-worn items, finds items never selected, and calculates category percentages.

## 6.4 RF-DETR segmentation

### `load_segmentation_model()`

- **Input:** None.
- **Output:** Cached global `RFDETRSegSmall` instance.
- **Behavior:** Loads `checkpoint_best_total.pth` with 18 classes on first use.

### `segment_garment(image: Image.Image, threshold: float = 0.25) -> Image.Image | None`

- **Input:** Pillow RGB-compatible image and confidence threshold.
- **Output:** Segmented RGBA garment cutout, or `None`.
- **Behavior:**
  1. Converts the image to RGB.
  2. Runs RF-DETR segmentation.
  3. Returns `None` when no detection or mask is available.
  4. Selects the detection with the highest confidence.
  5. Applies the selected mask as an alpha channel.
  6. Crops the image tightly around the mask.

## 6.5 Garment VLM analysis

### `ANALYZE_PROMPT`

A fixed prompt instructs the VLM to identify category, boutique-style item name, primary color, style, and visible condition.

### `analyze_garment(image_path: str, gemini_key: str = "", ollama_model: str = "qwen3-vl:4b") -> dict`

- **Input:** Segmented cutout path, optional Gemini key, and Ollama model name.
- **Output:** A dictionary containing garment metadata and `source`; may include `warning`.

**Online path:**

- Creates a Gemini client.
- Sends the image and prompt to `gemini-2.5-flash`.
- Requests JSON matching `GarmentInfo`.
- Validates and normalizes the response.

**Offline fallback:**

- Sends the image and prompt to Ollama using `format=GarmentInfo.model_json_schema()`.
- Validates the JSON and adds `source`.
- If Gemini failed, adds a warning explaining that the app switched to Ollama.

The returned data is normalized by `normalize_category()` before storage.

## 6.6 Outfit pairing

### Outfit constants

- `OCCASION_STYLE_MAP`: Maps occasions to preferred styles.
- `STYLE_PREFERENCE_HINTS`: Provides natural-language style direction.
- `WEATHER_RULES`: Defines item counts and outerwear expectations.
- `FORMAL_BLOCK`: Garments considered unsuitable for formal presentation.
- `FORMAL_PREFER`: Garments preferred for formal presentation.

### `suggest_outfit(...)`

```python
def suggest_outfit(
    closet_items: list[dict],
    occasion: str,
    weather: str = "Spring / Mild",
    style_preference: str = "Balanced",
    gemini_key: str = "",
    ollama_model: str = "qwen3-vl:4b",
    last_ids: list[str] | None = None,
) -> dict
```

- **Input:** Closet records, occasion, weather, style preference, optional Gemini key, Ollama model, and IDs from the previous suggestion.
- **Output:** Outfit title, tagline, selected IDs, explanation, source, mode, and optional warning.

**Behavior:**

1. Removes `stained` and `damaged` items.
2. Requires at least two wearable items.
3. Randomly shuffles the candidate list.
4. Loads likes, dislikes, and wear counts.
5. Uses a **30% discovery / 70% comfort** selection mode:
   - Discovery encourages an under-worn item.
   - Comfort favors combinations similar to recently liked pairs.
6. Avoids the previous outfit and exact disliked combinations.
7. Applies occasion, weather, and style hints to the VLM prompt.
8. Tries Gemini when a key is present.
9. Tries Ollama next.
10. Falls back to the rule engine if both VLM paths fail.

### Rule-engine fallback

The fallback:

- Selects top and bottom categories.
- Adds outerwear for winter or formal occasions.
- May add optional outerwear in spring or rain.
- Rejects casual/graphic items for formal occasions.
- Prefers items matching the occasion style.
- Sorts candidates by wear count and selects from the least-worn choices.
- Returns at least two items when no complete category match exists.

## 7. Data Formats

## 7.1 Garment record

```json
{
  "id": "item_61d382",
  "image_path": "closet_data/cutouts/item_61d382.png",
  "category": "Top",
  "item_name": "Flannel Shirt",
  "primary_color": "Black and white",
  "style": "casual",
  "condition": "wrinkled",
  "condition_note": "Visible wrinkles with no stains or tears.",
  "source": "Offline (qwen3-vl:4b)"
}
```

Field rules:

- `id`: Unique random-looking string.
- `image_path`: Relative path to an RGBA cutout.
- `category`: Category enumeration.
- `style`: Style enumeration.
- `condition`: Condition enumeration.
- `source`: The VLM or analysis provider that produced metadata.

## 7.2 Feedback record

```json
{
  "times_selected": {
    "item_61d382": 2
  },
  "wear_history": [
    {
      "date": "2026-11-21",
      "outfit_title": "Balanced Edit",
      "occasion": "Casual college day",
      "selected_ids": ["item_61d382", "item_e1bbc7"]
    }
  ],
  "saved_outfits": [],
  "liked_pairs": [
    ["item_61d382", "item_e1bbc7"]
  ],
  "disliked_pairs": []
}
```

## 7.3 Current data snapshot

- `closet_data/closet.json` contains 27 records.
- The sample closet includes Top, Bottom, Outerwear, and Dress categories.
- The sample data has `good` and `wrinkled` conditions.
- `closet_data/feedback.json` contains usage counts, liked/disliked pairs, wear history, and saved-outfit state.
- `feedback.json` at the project root is currently empty and is not used by `backend.py`.

## 8. Model and Storage Behavior

### Segmentation model

- Model: RF-DETR Segmentation Small.
- Weight file: `checkpoint_best_total.pth`.
- Configured classes: 18.
- Default confidence threshold: `0.25`.

### Online model

- Provider: Google Gemini.
- Model: `gemini-2.5-flash`.
- Used only when a Gemini API key is supplied.
- JSON output is validated against Pydantic schemas.

### Offline model

- Provider: Ollama.
- Default model: `qwen3-vl:4b`.
- Used for garment analysis and outfit generation.
- Supports JSON schema-constrained output.

### Fallback chain

```text
Gemini, if key supplied
  -> Ollama
  -> Rule engine for outfit pairing
```

Garment analysis has no outfit-style rule engine: if Gemini and Ollama both fail, no garment record is saved.

## 9. Privacy and Persistence

- Images and structured closet data are stored locally in `closet_data/`.
- No database server or authentication system is required.
- Gemini requests send garment cutouts and prompts to Google's API when explicitly enabled.
- Ollama requests remain local when Gemini is absent or unavailable.
- Streamlit session state retains the current outfit while the browser session remains active.
- There is no account system or server-side user separation.

## 10. Known Limitations

- Storage is local JSON and is not concurrency-safe for multiple simultaneous writers.
- Paths for JSON storage are working-directory-relative, although model and weight paths are file-relative.
- Outfit generation has no explicit dress/suit accessory assembly logic and mostly chooses Top, Bottom, and optional Outerwear.
- Removing a closet item does not remove its cutout image file.
- Feedback uses exact sorted garment-ID combinations for dislikes.
- VLM quality depends on model availability and classification accuracy.
- The segmentation model can return no garment or the wrong detected object.
- The root `feedback.json` file is separate and unused; active feedback is `closet_data/feedback.json`.

## 11. Maintenance and Extension Points

Common changes and their locations:

| Change | File or location |
|---|---|
| Add or change UI tabs/widgets | `app.py` |
| Add garment metadata fields | `GarmentInfo` and `ANALYZE_PROMPT` in `backend.py` |
| Change segmentation threshold defaults | Sidebar slider in `app.py` |
| Replace the segmentation model | `load_segmentation_model()` in `backend.py` |
| Change weather or occasion rules | Constants near `suggest_outfit()` |
| Change style preferences | `STYLE_PREFERENCE_HINTS` |
| Add feedback metrics | `record_*()` and `get_wardrobe_insights()` |
| Change stored JSON location | Path constants in `backend.py` |
