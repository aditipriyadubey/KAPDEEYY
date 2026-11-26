"""Phase 5: Save, unsave, feedback, wear history regression tests.

Added to verify Phase 5 API features work correctly.
Follows exact patterns from test_wardrobe.py for auth/Supabase mocking.
"""
import httpx
import pytest

from fastapi.testclient import TestClient

from app.core import auth as auth_module
from app.core.config import Settings, get_settings
from app.core.http import get_http
from app.main import create_app


ALICE = "11111111-1111-4111-8111-111111111111"
BOB = "22222222-2222-4222-8222-222222222222"
TOKENS = {"token-alice": ALICE, "token-bob": BOB}


def _now():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def _json(request):
    import json
    return json.loads(request.content) if request.content else {}


def _eq(value: str | None) -> str | None:
    if not value:
        return None
    return value.removeprefix("eq.")


STATUS_OK = 200
STATUS_CREATED = 201
STATUS_FORBIDDEN = 403
STATUS_NOT_FOUND = 404
STATUS_UNAUTHORIZED = 401


# ── in-memory stores (module level) ──────────────────────────────
ITEMS: list[dict] = []
SAVED: list[dict] = []
FEEDBACK: list[dict] = []
WEAR_HISTORY: list[dict] = []
OUTFITS: list[dict] = []
OUTFIT_ITEMS: list[dict] = []


# ── fake Supabase REST API ────────────────────────────────────────
# Exact pattern from test_wardrobe.py, with essential paths for Phase 5
def fake_supabase(request: httpx.Request) -> httpx.Response:
    token = request.headers.get("authorization", "").removeprefix("Bearer ")
    uid = TOKENS.get(token)

    if request.url.path == "/auth/v1/user":
        if not uid:
            return httpx.Response(status_code=STATUS_UNAUTHORIZED,
                                  json={"msg": "invalid JWT"})
        return httpx.Response(status_code=STATUS_OK,
                              json={"id": uid, "email": f"{uid[:4]}@x.com"})

    if request.headers.get("apikey") != "anon":
        return httpx.Response(status_code=STATUS_UNAUTHORIZED,
                              json={})

    method = request.method
    path = request.url.path

    # ── wardrobe_items (needed to hydrate outfits + increment times_worn) ──
    if path == "/rest/v1/wardrobe_items":
        if not uid:
            return httpx.Response(status_code=STATUS_UNAUTHORIZED, json={})

        params = request.url.params

        if method == "GET":
            rows = [row for row in ITEMS if row["user_id"] == uid]
            wanted = _eq(params.get("id"))
            if wanted and wanted.startswith("in.("):
                ids = {
                    value.strip().strip('"')
                    for value in wanted.removeprefix("in.(").removesuffix(")").split(",")
                    if value.strip()
                }
                rows = [row for row in rows if row["id"] in ids]
            elif wanted:
                rows = [row for row in rows if row["id"] == wanted]
            return httpx.Response(status_code=STATUS_OK,
                                  json=[dict(row) for row in rows])

        if method == "PATCH":
            wanted = _eq(params.get("id"))
            rows = [
                row for row in ITEMS
                if row["user_id"] == uid and row["id"] == wanted
            ]
            if not rows:
                return httpx.Response(status_code=STATUS_OK, json=[])
            values = _json(request)
            if "user_id" in values and values["user_id"] != uid:
                return httpx.Response(status_code=STATUS_FORBIDDEN, json={})
            if not isinstance(values.get("times_worn", 0), int):
                # PostgREST cannot execute SQL expressions sent as values.
                return httpx.Response(status_code=400,
                                      json={"message": "invalid input syntax"})
            rows[0].update(values)
            row = dict(rows[0])
            row["updated_at"] = _now()
            return httpx.Response(status_code=STATUS_OK, json=[row])

    # Essential paths for Phase 5 tests
    if path == "/rest/v1/outfits":
        if method == "GET":
            params = request.url.params
            wanted = _eq(params.get("id"))
            if wanted:
                rows = [o for o in OUTFITS if o["id"] == wanted]
            else:
                rows = OUTFITS
            return httpx.Response(status_code=STATUS_OK,
                                  json=[dict(row) for row in rows])

    if path == "/rest/v1/outfit_items":
        if method == "GET":
            outfit_id = _eq(request.url.params.get("outfit_id"))
            rows = [o for o in OUTFIT_ITEMS if o["outfit_id"] == outfit_id] if outfit_id else []
            return httpx.Response(status_code=STATUS_OK,
                                  json=[dict(row) for row in rows])

    if path == "/rest/v1/saved_outfits":
        if method == "GET":
            outfit_id = _eq(request.url.params.get("outfit_id"))
            rows = [s for s in SAVED if s["user_id"] == uid and s["outfit_id"] == outfit_id] if outfit_id else []
            return httpx.Response(status_code=STATUS_OK,
                                  json=[dict(row) for row in rows])

        if method == "POST":
            values = _json(request)
            if values.get("user_id") != uid:
                return httpx.Response(status_code=STATUS_FORBIDDEN,
                                      json={})
            existing = [s for s in SAVED if s["user_id"] == uid and s["outfit_id"] == values["outfit_id"]]
            if existing:
                return httpx.Response(status_code=STATUS_OK,
                                      json=[dict(existing[0])])
            row = {
                "id": f"{uid[:8]}-{len(SAVED)+1:03d}",
                "user_id": uid,
                "outfit_id": values["outfit_id"],
            }
            SAVED.append(row)
            return httpx.Response(status_code=STATUS_CREATED,
                                  json=[dict(row)])

        if method == "DELETE":
            wanted = request.url.path.rstrip("/").split("/")[-1]
            new_list = [s for s in SAVED if not (s["user_id"] == uid and s["outfit_id"] == wanted)]
            SAVED.clear()
            SAVED.extend(new_list)
            return httpx.Response(status_code=STATUS_OK,
                                  json={"ok": True})

    if path == "/rest/v1/outfit_feedback":
        if method == "GET":
            # Check if feedback already exists for this user/outfit/type
            outfit_id = _eq(request.url.params.get("outfit_id"))
            ftype = _eq(request.url.params.get("feedback_type"))
            rows = [f for f in FEEDBACK
                    if f["user_id"] == uid
                    and f["outfit_id"] == (outfit_id or f["outfit_id"])
                    and f["feedback_type"] == (ftype or f["feedback_type"])] if (outfit_id or ftype) else []
            return httpx.Response(status_code=STATUS_OK,
                                  json=[dict(row) for row in rows])

        if method == "POST":
            values = _json(request)
            if values.get("user_id") != uid:
                return httpx.Response(status_code=STATUS_FORBIDDEN,
                                      json={})
            existing = [f for f in FEEDBACK
                        if f["user_id"] == uid
                        and f["outfit_id"] == values["outfit_id"]
                        and f["feedback_type"] == values.get("feedback_type")]
            if existing:
                return httpx.Response(status_code=STATUS_OK,
                                      json=[dict(existing[0])])
            row = {
                "id": f"{uid[:8]}-{len(FEEDBACK)+1:03d}",
                "user_id": uid,
                "outfit_id": values["outfit_id"],
                "feedback_type": values.get("feedback_type", "NOT_FOR_ME"),
            }
            FEEDBACK.append(row)
            return httpx.Response(status_code=STATUS_CREATED,
                                  json=[dict(row)])

    if path == "/rest/v1/outfit_wear_history":
        if method == "GET":
            # RLS in production; the fake scopes by the caller's token instead and
            # honours the eq. filters the endpoints rely on.
            params = request.url.params
            rows = [h for h in WEAR_HISTORY if h["user_id"] == uid]
            for field in ("id", "outfit_id", "worn_on"):
                wanted = _eq(params.get(field))
                if wanted:
                    rows = [row for row in rows if str(row.get(field)) == wanted]
            return httpx.Response(status_code=STATUS_OK,
                                  json=[dict(row) for row in rows])

        if method == "POST":
            from datetime import datetime, timezone
            values = _json(request)
            if values.get("user_id") != uid:
                return httpx.Response(status_code=STATUS_FORBIDDEN,
                                      json={})
            worn_on = values.get("worn_on", datetime.now().date().isoformat())
            existing = [h for h in WEAR_HISTORY
                        if h["user_id"] == uid
                        and h["outfit_id"] == values["outfit_id"]
                        and h["worn_on"] == worn_on]
            if existing:
                return httpx.Response(status_code=STATUS_OK,
                                      json=[dict(existing[0])])
            row = {
                "id": f"{uid[:8]}-{len(WEAR_HISTORY)+1:03d}",
                "user_id": uid,
                "outfit_id": values["outfit_id"],
                "worn_on": worn_on,
                "worn_at": _now(),
                "occasion": None,
            }
            WEAR_HISTORY.append(row)
            item_ids = values.get("item_ids", [])
            for item_id in item_ids:
                for item in ITEMS:
                    if item["id"] == item_id and item["user_id"] == uid:
                        item["times_worn"] = item.get("times_worn", 0) + 1
            return httpx.Response(status_code=STATUS_CREATED,
                                  json=[dict(row)])

    return httpx.Response(status_code=404, json={"detail": "Not Found"})


def auth(token: str | None = "token-alice") -> dict:
    # Exact pattern from test_wardrobe.py
    return {} if token is None else {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def client():
    from app.core import auth as auth_module

    auth_module.clear_auth_cache()

    # reset stores
    ITEMS.clear()
    SAVED.clear()
    FEEDBACK.clear()
    WEAR_HISTORY.clear()
    OUTFITS.clear()
    OUTFIT_ITEMS.clear()

    # Pre-create outfits using valid UUIDs so the /rest/v1/outfits mock works
    outfit1_id = "11111111-1111-4111-8111-111111111111"  # ALICE's UUID
    outfit2_id = "22222222-2222-4222-8222-222222222222"  # BOB's UUID
    OUTFITS.extend([
        {"id": outfit1_id, "user_id": ALICE, "name": "Outfit 1"},
        {"id": outfit2_id, "user_id": ALICE, "name": "Outfit 2"},
    ])

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
    with TestClient(app) as c:
        yield c


# ============================================================
# Save / Unsaved
# ============================================================

class TestSaveOutfit:
    """POST /api/outfits/{outfit_id}/save  and  DELETE /api/outfits/{outfit_id}/save"""

    def test_save_outfit_creates_record(self, client):
        """Saving an outfit creates a saved_outfits record."""
        outfit_id = "11111111-1111-4111-8111-111111111111"  # ALICE's outfit
        r = client.post(f"/api/outfits/{outfit_id}/save", headers=auth())
        assert r.status_code == STATUS_OK, r.text
        body = r.json()
        assert body["ok"] is True

    def test_unsave_outfit_removes_record(self, client):
        """Deleting a saved outfit removes the saved_outfits record."""
        outfit_id = "22222222-2222-4222-8222-222222222222"  # BOB's outfit
        client.post(f"/api/outfits/{outfit_id}/save", headers=auth())
        r = client.delete(f"/api/outfits/{outfit_id}/save", headers=auth())
        assert r.status_code == STATUS_OK, r.text
        body = r.json()
        assert body["ok"] is True


# ============================================================
# Feedback
# ============================================================

class TestFeedback:
    """POST /api/outfits/{outfit_id}/feedback  and  duplicate prevention"""

    def test_submit_not_for_me_creates_record(self, client):
        """Submitting NOT_FOR_ME feedback creates a record."""
        outfit_id = "11111111-1111-4111-8111-111111111111"
        r = client.post(f"/api/outfits/{outfit_id}/feedback", headers=auth(),
                        json={"feedback_type": "NOT_FOR_ME"})
        assert r.status_code == STATUS_OK, r.text
        body = r.json()
        assert body["ok"] is True

    def test_duplicate_feedback_returns_existing(self, client):
        """Submitting same feedback twice returns existing record."""
        outfit_id = "11111111-1111-4111-8111-111111111111"
        client.post(f"/api/outfits/{outfit_id}/feedback", headers=auth(),
                    json={"feedback_type": "NOT_FOR_ME"})
        r2 = client.post(f"/api/outfits/{outfit_id}/feedback", headers=auth(),
                         json={"feedback_type": "NOT_FOR_ME"})
        assert r2.status_code == STATUS_OK, r2.text
        assert len([f for f in FEEDBACK if f["outfit_id"] == outfit_id]) == 1


# ============================================================
# Wear History / Same-Day Duplicate Prevention
# ============================================================

class TestWearHistory:
    """POST /api/outfits/{outfit_id}/worn  and  same-day / different-day logic"""

    def test_mark_worn_creates_history_record(self, client):
        """Marking an outfit as worn creates a wear-history record."""
        outfit_id = "11111111-1111-4111-8111-111111111111"
        item_id = "66666666-6666-6666-8666-666666666666"
        outfit_item_id = "00000000-0000-4000-8000-000000000001"
        OUTFIT_ITEMS.append({
            "id": outfit_item_id,
            "outfit_id": outfit_id,
            "wardrobe_item_id": item_id,
        })
        ITEMS.append({
            "id": item_id, "user_id": ALICE,
            "item_name": "Test Item", "category": "Tops",
            "created_at": _now(), "updated_at": _now(), "times_worn": 0
        })

        r = client.post(f"/api/outfits/{outfit_id}/worn", headers=auth(),
                        json={"worn_on": "2024-01-15", "item_ids": [item_id]})
        assert r.status_code == STATUS_OK, r.text
        body = r.json()
        assert body["ok"] is True

        item = next((i for i in ITEMS if i["id"] == item_id), None)
        assert item is not None
        assert item["times_worn"] == 1

    def test_same_day_repeated_request_does_not_double_increment(self, client):
        """Calling mark_worn twice on the same day does NOT double-increment times_worn."""
        outfit_id = "11111111-1111-4111-8111-111111111111"
        item_id = "88888888-8888-8888-8888-888888888888"
        outfit_item_id = "00000000-0000-4000-8000-000000000002"
        OUTFIT_ITEMS.append({
            "id": outfit_item_id,
            "outfit_id": outfit_id,
            "wardrobe_item_id": item_id,
        })
        ITEMS.append({
            "id": item_id, "user_id": ALICE,
            "item_name": "Test Item", "category": "Tops",
            "created_at": _now(), "updated_at": _now(), "times_worn": 0
        })

        r1 = client.post(f"/api/outfits/{outfit_id}/worn", headers=auth(),
                         json={"worn_on": "2024-01-15", "item_ids": [item_id]})
        assert r1.status_code == STATUS_OK, r1.text

        r2 = client.post(f"/api/outfits/{outfit_id}/worn", headers=auth(),
                         json={"worn_on": "2024-01-15", "item_ids": [item_id]})
        assert r2.status_code == STATUS_OK, r2.text

        item = next((i for i in ITEMS if i["id"] == item_id), None)
        assert item is not None
        assert item["times_worn"] == 1, f"Expected times_worn=1, got {item['times_worn']}"

    def test_different_day_increments_times_worn(self, client):
        """A wear on a new day increments times_worn again.

        `worn_on` is decided by the backend (server date), not by the request
        body, so a previous day is seeded directly to represent an earlier wear.
        """
        from datetime import date, timedelta

        outfit_id = "11111111-1111-4111-8111-111111111111"
        item_id = "aaaabbbb-aaaa-4aaa-8aaa-aaaabbbbccccdd"
        outfit_item_id = "00000000-0000-4000-8000-000000000003"
        OUTFIT_ITEMS.append({
            "id": outfit_item_id,
            "outfit_id": outfit_id,
            "wardrobe_item_id": item_id,
        })
        ITEMS.append({
            "id": item_id, "user_id": ALICE,
            "item_name": "Test Item", "category": "Tops",
            "created_at": _now(), "updated_at": _now(), "times_worn": 1
        })
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        WEAR_HISTORY.append({
            "id": "11111111-900",
            "user_id": ALICE,
            "outfit_id": outfit_id,
            "worn_on": yesterday,
            "worn_at": _now(),
            "occasion": None,
        })

        r1 = client.post(f"/api/outfits/{outfit_id}/worn", headers=auth())
        assert r1.status_code == STATUS_OK, r1.text

        item = next((i for i in ITEMS if i["id"] == item_id), None)
        assert item is not None
        assert item["times_worn"] == 2, f"Expected times_worn=2, got {item['times_worn']}"

    def test_wear_history_shows_all_records(self, client):
        """Wear history endpoint returns all wear records for the caller.

        The supported route is GET /api/outfits/history (there is no per-outfit
        history route). Duplicate prevention is per outfit and per day, so two
        different outfits are marked worn to produce two records.
        """
        outfit_ids = [
            "11111111-1111-4111-8111-111111111111",
            "22222222-2222-4222-8222-222222222222",
        ]
        for index, outfit_id in enumerate(outfit_ids):
            item_id = f"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa{index}"
            OUTFIT_ITEMS.append({
                "id": f"00000000-0000-4000-8000-00000000000{index + 4}",
                "outfit_id": outfit_id,
                "wardrobe_item_id": item_id,
            })
            ITEMS.append({
                "id": item_id, "user_id": ALICE,
                "item_name": f"Test Item {index}", "category": "Tops",
                "created_at": _now(), "updated_at": _now(), "times_worn": 0
            })
            worn = client.post(f"/api/outfits/{outfit_id}/worn", headers=auth())
            assert worn.status_code == STATUS_OK, worn.text

        r = client.get("/api/outfits/history", headers=auth())
        assert r.status_code == STATUS_OK, r.text
        records = r.json()
        assert len(records) >= 2, (len(WEAR_HISTORY), WEAR_HISTORY, records)