"""Phase 3B: garment analysis endpoint, mapping and AI status.

All external services are fakes:
- Supabase Auth / PostgREST / Storage via httpx.MockTransport
- the local AI worker via a dependency override

No Gemini calls and no real inference happen in this file.
"""

from __future__ import annotations

import base64
import json
from datetime import datetime, timezone
from types import SimpleNamespace

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core import auth as auth_module
from app.core.config import Settings, get_settings
from app.core.http import get_http
from app.main import create_app
from app.services.ai import AIWorkerError, get_ai_worker
from app.services.ai.mappings import (
    RF_DETR_LABELS,
    VALID_CATEGORIES,
    VALID_STYLES,
    build_suggestions,
    map_label,
)

ALICE = "11111111-1111-4111-8111-111111111111"
BOB = "22222222-2222-4222-8222-222222222222"
TOKENS = {"token-alice": ALICE, "token-bob": BOB}

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64
CUTOUT = b"\x89PNG\r\n\x1a\n" + b"c" * 32

ITEMS: list[dict] = []
STORAGE: dict[tuple[str, str], bytes] = {}
PATCHES: list[dict] = []
FAIL_PATCH = False
FAIL_UPLOAD = False


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _eq(value: str | None) -> str | None:
    return value.removeprefix("eq.") if value else None


def _json(request: httpx.Request) -> dict:
    return json.loads(request.content) if request.content else {}


def fake_supabase(request: httpx.Request) -> httpx.Response:
    token = request.headers.get("authorization", "").removeprefix("Bearer ")
    uid = TOKENS.get(token)

    if request.url.path == "/auth/v1/user":
        if not uid:
            return httpx.Response(401, json={"msg": "invalid JWT"})
        return httpx.Response(200, json={"id": uid, "email": f"{uid[:4]}@x.com"})

    if request.headers.get("apikey") != "anon":
        return httpx.Response(401, json={})

    if request.url.path == "/rest/v1/wardrobe_items":
        if not uid:
            return httpx.Response(401, json={})

        if request.method == "GET":
            rows = [row for row in ITEMS if row["user_id"] == uid]
            wanted = _eq(request.url.params.get("id"))
            if wanted:
                rows = [row for row in rows if row["id"] == wanted]
            return httpx.Response(200, json=[dict(row) for row in rows])

        if request.method == "PATCH":
            if FAIL_PATCH:
                return httpx.Response(500, json={"message": "update failed"})
            wanted = _eq(request.url.params.get("id"))
            rows = [
                row
                for row in ITEMS
                if row["user_id"] == uid and row["id"] == wanted
            ]
            if not rows:
                return httpx.Response(200, json=[])
            values = _json(request)
            PATCHES.append(dict(values))
            rows[0].update(values)
            rows[0]["updated_at"] = _now()
            return httpx.Response(200, json=[dict(rows[0])])

    if request.url.path.startswith("/storage/v1/object/"):
        if not uid:
            return httpx.Response(401, json={})

        relative = request.url.path.removeprefix("/storage/v1/object/")

        if relative.startswith("sign/"):
            bucket, object_path = relative.removeprefix("sign/").split("/", 1)
            if object_path.split("/")[0] != uid:
                return httpx.Response(403, json={})
            if (bucket, object_path) not in STORAGE:
                return httpx.Response(400, json={"error": "not found"})
            return httpx.Response(
                200,
                json={"signedURL": f"/object/sign/{bucket}/{object_path}?token=fake"},
            )

        if request.method == "GET":
            bucket, object_path = relative.split("/", 1)
            if object_path.split("/")[0] != uid:
                return httpx.Response(403, json={})
            data = STORAGE.get((bucket, object_path))
            if data is None:
                return httpx.Response(404, json={"error": "not found"})
            return httpx.Response(200, content=data)

        if request.method == "POST":
            if FAIL_UPLOAD:
                return httpx.Response(500, json={"message": "upload failed"})
            bucket, object_path = relative.split("/", 1)
            if object_path.split("/")[0] != uid:
                return httpx.Response(403, json={})
            STORAGE[(bucket, object_path)] = request.content
            return httpx.Response(200, json={"Key": f"{bucket}/{object_path}"})

        if request.method == "DELETE":
            bucket = relative
            removed = 0
            for prefix in _json(request).get("prefixes", []):
                if prefix.split("/")[0] != uid:
                    return httpx.Response(403, json={})
                if STORAGE.pop((bucket, prefix), None) is not None:
                    removed += 1
            return httpx.Response(200, json=[{"name": str(removed)}])

    return httpx.Response(404, json={})


def seed_item(
    user_id: str = ALICE,
    *,
    item_name: str = "My Edited Tee",
    category: str = "Tops",
    subcategory: str | None = "T-shirt",
    colour: str = "Faded Pink",
    style: str = "Minimal",
    original: bool = True,
    segmented: str | None = None,
    status: str = "pending",
) -> dict:
    path = f"{user_id}/original.png"
    row = {
        "id": "00000000-0000-4000-8000-000000000001",
        "user_id": user_id,
        "item_name": item_name,
        "category": category,
        "subcategory": subcategory,
        "colour": colour,
        "colour_hex": "#EFEADF",
        "pattern": "Textured",
        "style": style,
        "suggested_occasions": ["College"],
        "season": "All-season",
        "original_image_path": path,
        "segmented_image_path": segmented,
        "segmentation_status": status,
        "created_at": _now(),
        "updated_at": _now(),
    }
    ITEMS.append(row)
    if original:
        STORAGE[("wardrobe-original", path)] = PNG
    if segmented:
        STORAGE[("wardrobe-segmented", segmented)] = CUTOUT
    return row


DEFAULT_RESULT = {
    "cutout_base64": base64.b64encode(CUTOUT).decode(),
    "label": "Top",
    "confidence": 0.9123,
    "analysis": {
        "category": "Top",
        "item_name": "Ivory Knit Top",
        "primary_color": "Ivory",
        "style": "streetwear",
        "condition": "good",
        "condition_note": "No visible damage.",
    },
    "classification_source": "Online (Gemini)",
}


class FakeWorker:
    def __init__(self) -> None:
        self.result = DEFAULT_RESULT
        self.error: AIWorkerError | None = None
        self.calls: list[tuple[int, str, float]] = []
        self.health_data = {
            "status": "ok",
            "checkpoint_available": True,
            "model_loaded": True,
            "model_error": None,
            "rfdetr_ready": True,
            "cuda_available": False,
            "gemini_configured": True,
        }

    async def analyze(self, image: bytes, content_type: str, threshold: float = 0.25) -> dict:
        self.calls.append((len(image), content_type, threshold))
        if self.error is not None:
            raise self.error
        return self.result

    async def health(self):
        return self.health_data


@pytest.fixture()
def ctx():
    global FAIL_PATCH, FAIL_UPLOAD
    auth_module.clear_auth_cache()
    ITEMS.clear()
    STORAGE.clear()
    PATCHES.clear()
    FAIL_PATCH = False
    FAIL_UPLOAD = False

    worker = FakeWorker()
    app = create_app()
    app.dependency_overrides[get_settings] = lambda: Settings(
        database_backend="supabase",
        auth_backend="supabase",
        supabase_url="https://proj.supabase.co",
        supabase_anon_key="anon",
        _env_file=None,
    )
    http = httpx.AsyncClient(transport=httpx.MockTransport(fake_supabase))
    app.dependency_overrides[get_http] = lambda: http
    app.dependency_overrides[get_ai_worker] = lambda: worker

    with TestClient(app) as client:
        yield SimpleNamespace(client=client, worker=worker, http=http)


def auth(token: str | None = "token-alice") -> dict:
    return {} if token is None else {"Authorization": f"Bearer {token}"}


# ── auth / ownership ──────────────────────────────────────────────


def test_analyze_requires_authentication(ctx):
    seed_item()
    response = ctx.client.post("/api/wardrobe/00000000-0000-4000-8000-000000000001/analyze")
    assert response.status_code in (401, 403)
    assert not ctx.worker.calls
    assert ITEMS[0]["segmentation_status"] == "pending"


def test_analyze_cannot_touch_another_users_item(ctx):
    seed_item()
    response = ctx.client.post(
        "/api/wardrobe/00000000-0000-4000-8000-000000000001/analyze",
        headers=auth("token-bob"),
    )
    assert response.status_code == 404
    assert not ctx.worker.calls
    assert ITEMS[0]["segmentation_status"] == "pending"
    assert ("wardrobe-original", f"{ALICE}/original.png") in STORAGE


def test_analyze_missing_original_image(ctx):
    seed_item(original=False)
    response = ctx.client.post(
        "/api/wardrobe/00000000-0000-4000-8000-000000000001/analyze",
        headers=auth(),
    )
    assert response.status_code == 409
    assert "missing" in response.json()["detail"].lower()
    assert not ctx.worker.calls
    assert ITEMS[0]["segmentation_status"] == "failed"
    assert ITEMS[0]["item_name"] == "My Edited Tee"


# ── success path ──────────────────────────────────────────────────


def test_analyze_success_stores_cutout_and_returns_suggestions(ctx):
    item = seed_item()
    response = ctx.client.post(
        f"/api/wardrobe/{item['id']}/analyze",
        headers=auth(),
    )

    assert response.status_code == 200, response.text
    body = response.json()

    assert body["item"]["segmentation_status"] == "completed"
    assert body["item"]["segmented_image_path"].startswith(f"{ALICE}/")
    assert body["item"]["segmented_image_path"].endswith(".png")
    assert body["item"]["image_url"].startswith("https://proj.supabase.co/storage/v1")
    assert ("wardrobe-segmented", body["item"]["segmented_image_path"]) in STORAGE
    assert STORAGE[("wardrobe-segmented", body["item"]["segmented_image_path"])] == CUTOUT

    assert body["detection"] == {"label": "Top", "confidence": 0.9123}
    assert body["classification_source"] == "Online (Gemini)"
    assert "Google Gemini" in body["privacy_notice"]

    suggestions = body["suggestions"]
    assert suggestions["item_name"] == "Ivory Knit Top"
    assert suggestions["category"] == "Tops"
    assert suggestions["subcategory"] == "Top"
    assert suggestions["colour"] == "Ivory"
    assert suggestions["style"] == "Street"
    assert suggestions["condition"] == "good"
    assert "pattern" not in suggestions
    assert "season" not in suggestions
    assert "suggested_occasions" not in suggestions

    # User-edited metadata is untouched, and only segmentation columns are written.
    assert ITEMS[0]["item_name"] == "My Edited Tee"
    assert ITEMS[0]["colour"] == "Faded Pink"
    assert ITEMS[0]["style"] == "Minimal"
    assert ITEMS[0]["subcategory"] == "T-shirt"
    assert set(PATCHES[-1]) == {"segmented_image_path", "segmentation_status"}
    assert ctx.worker.calls[0][1] == "image/png"


def test_reanalysis_replaces_the_previous_cutout(ctx):
    old_path = f"{ALICE}/old-cutout.png"
    item = seed_item(segmented=old_path, status="completed")

    response = ctx.client.post(f"/api/wardrobe/{item['id']}/analyze", headers=auth())

    assert response.status_code == 200, response.text
    new_path = response.json()["item"]["segmented_image_path"]
    assert new_path != old_path
    assert ("wardrobe-segmented", old_path) not in STORAGE
    assert ("wardrobe-segmented", new_path) in STORAGE


# ── AI failures ───────────────────────────────────────────────────


def test_segmentation_failure_marks_failed_and_preserves_original(ctx):
    item = seed_item()
    ctx.worker.error = AIWorkerError(422, "no_garment", "No garment was detected")

    response = ctx.client.post(f"/api/wardrobe/{item['id']}/analyze", headers=auth())

    assert response.status_code == 422
    assert ITEMS[0]["segmentation_status"] == "failed"
    assert ITEMS[0]["segmented_image_path"] is None
    assert ITEMS[0]["item_name"] == "My Edited Tee"
    assert ("wardrobe-original", f"{ALICE}/original.png") in STORAGE
    assert not [key for key in STORAGE if key[0] == "wardrobe-segmented"]


def test_gemini_failure_marks_failed_and_preserves_metadata(ctx):
    item = seed_item()
    ctx.worker.error = AIWorkerError(502, "gemini_failed", "Garment classification failed")

    response = ctx.client.post(f"/api/wardrobe/{item['id']}/analyze", headers=auth())

    assert response.status_code == 502
    assert ITEMS[0]["segmentation_status"] == "failed"
    assert ITEMS[0]["segmented_image_path"] is None
    assert ITEMS[0]["item_name"] == "My Edited Tee"
    assert ITEMS[0]["colour"] == "Faded Pink"
    assert ("wardrobe-original", f"{ALICE}/original.png") in STORAGE
    assert not [key for key in STORAGE if key[0] == "wardrobe-segmented"]


def test_worker_unreachable_maps_to_service_unavailable(ctx):
    item = seed_item()
    ctx.worker.error = AIWorkerError(503, "worker_unavailable", "The AI service is not running")

    response = ctx.client.post(f"/api/wardrobe/{item['id']}/analyze", headers=auth())

    assert response.status_code == 503
    assert ITEMS[0]["segmentation_status"] == "failed"


# ── storage / database failures ───────────────────────────────────


def test_storage_upload_failure_does_not_complete_analysis(ctx):
    global FAIL_UPLOAD
    item = seed_item()
    FAIL_UPLOAD = True

    response = ctx.client.post(f"/api/wardrobe/{item['id']}/analyze", headers=auth())

    assert response.status_code == 502
    assert ITEMS[0]["segmentation_status"] == "failed"
    assert ITEMS[0]["segmented_image_path"] is None
    assert ("wardrobe-original", f"{ALICE}/original.png") in STORAGE
    assert not [key for key in STORAGE if key[0] == "wardrobe-segmented"]


def test_database_failure_cleans_up_newly_uploaded_cutout(ctx):
    global FAIL_PATCH
    item = seed_item()
    FAIL_PATCH = True

    response = ctx.client.post(f"/api/wardrobe/{item['id']}/analyze", headers=auth())

    assert response.status_code == 502
    # The new cutout must not be left behind when the row could not be updated.
    assert not [key for key in STORAGE if key[0] == "wardrobe-segmented"]
    assert ("wardrobe-original", f"{ALICE}/original.png") in STORAGE
    assert ITEMS[0]["segmented_image_path"] is None


def test_invalid_original_bytes_are_rejected_without_calling_ai(ctx):
    item = seed_item()
    STORAGE[("wardrobe-original", f"{ALICE}/original.png")] = b"not an image"

    response = ctx.client.post(f"/api/wardrobe/{item['id']}/analyze", headers=auth())

    assert response.status_code == 422
    assert ITEMS[0]["segmentation_status"] == "failed"
    assert not ctx.worker.calls


# ── mapping ───────────────────────────────────────────────────────


def test_every_checkpoint_label_maps_to_a_valid_database_category():
    assert len(RF_DETR_LABELS) == 18
    for label, (category, subcategory) in RF_DETR_LABELS.items():
        assert category in VALID_CATEGORIES, label
        assert subcategory is None or isinstance(subcategory, str)

    assert map_label("Jacket") == ("Outerwear", "Jacket")
    assert map_label("Jeans") == ("Bottoms", "Jeans")
    assert map_label("Dress") == ("Dresses", "Dress")
    assert map_label("Hat") == ("Other", "Hat")
    assert map_label("t-shirt") == ("Tops", "T-shirt")


def test_unknown_or_missing_label_is_handled_gracefully():
    assert map_label("Space Suit") == ("Other", None)
    assert map_label(None) == ("Other", None)

    suggestions = build_suggestions(
        {
            "category": "Accessory",
            "item_name": "Unknown Item",
            "primary_color": "Grey",
            "style": "formal",
            "condition": "damaged",
            "condition_note": "Torn hem.",
        },
        "Space Suit",
    )
    assert suggestions["category"] == "Other"
    assert suggestions["subcategory"] is None
    assert suggestions["style"] == "Smart"


def test_gemini_category_fallback_only_for_others():
    for label in ("Others", None):
        suggestions = build_suggestions({"category": "Top", "item_name": "Tee"}, label)
        assert suggestions["category"] == "Tops"

    # A recognised label always wins over the model's category opinion.
    suggestions = build_suggestions({"category": "Bottom", "item_name": "Jeans"}, "Jeans")
    assert suggestions["category"] == "Bottoms"


def test_mapped_style_is_always_a_frontend_value():
    for raw in ("casual", "formal", "sporty", "streetwear"):
        suggestions = build_suggestions({"category": "Top", "style": raw}, "Top")
        assert suggestions["style"] in VALID_STYLES

    assert build_suggestions({"category": "Top", "style": "avant-garde"}, "Top")["style"] is None


# ── AI status ─────────────────────────────────────────────────────


def test_ai_status_reports_worker_capabilities_without_secrets(ctx):
    response = ctx.client.get("/api/ai/status", headers=auth())

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["checkpoint_available"] is True
    assert body["worker_available"] is True
    assert body["rfdetr_ready"] is True
    assert body["model_loaded"] is True
    assert body["cuda_available"] is False
    assert body["gemini_configured"] is True
    assert "api_key" not in json.dumps(body).lower()


def test_ai_status_when_worker_is_unavailable(ctx):
    ctx.worker.health_data = None

    response = ctx.client.get("/api/ai/status", headers=auth())

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "unavailable"
    assert body["worker_available"] is False


def test_ai_status_requires_auth(ctx):
    assert ctx.client.get("/api/ai/status").status_code in (401, 403)
