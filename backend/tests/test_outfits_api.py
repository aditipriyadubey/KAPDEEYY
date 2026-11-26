"""Tests for the outfits API and the recommendation database access.

Covers the Phase 1 repairs: OpenAPI generation, authenticated user wiring,
explicit ownership filters, and the recommendation engine reading the
caller's wardrobe through the request-scoped database client (instead of
building its own client with an empty token).

Supabase Auth + PostgREST are replaced by an in-process fake, following the
same pattern as test_wardrobe.py.
"""
import json
from datetime import date, datetime, timezone

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

ITEMS: list[dict] = []
OUTFITS: list[dict] = []
OUTFIT_ITEMS: list[dict] = []
SAVED: list[dict] = []
FEEDBACK: list[dict] = []
HISTORY: list[dict] = []

# Every PostgREST request the backend made, so tests can prove the caller's own
# token was forwarded (never an empty one).
REST_AUTH_HEADERS: list[str] = []


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _eq(value: str | None) -> str | None:
    if not value:
        return None
    return value.removeprefix("eq.")


def _json(request: httpx.Request) -> dict:
    return json.loads(request.content) if request.content else {}


def _match_eq(row: dict, params: httpx.QueryParams, field: str) -> bool:
    wanted = _eq(params.get(field))
    return not wanted or str(row.get(field)) == wanted


def _in_ids(value: str | None) -> set[str] | None:
    """Parse a PostgREST `in.(a,b,c)` filter into a set of ids."""
    if not value or not value.startswith("in.("):
        return None
    return {
        item.strip().strip('"')
        for item in value.removeprefix("in.(").removesuffix(")").split(",")
        if item.strip()
    }


def fake_supabase(request: httpx.Request) -> httpx.Response:
    token = request.headers.get("authorization", "").removeprefix("Bearer ")
    uid = TOKENS.get(token)

    if request.url.path == "/auth/v1/user":
        if not uid:
            return httpx.Response(401, json={"msg": "invalid JWT"})
        return httpx.Response(200, json={"id": uid, "email": f"{uid[:4]}@x.com"})

    if request.headers.get("apikey") != "anon":
        return httpx.Response(401, json={})

    REST_AUTH_HEADERS.append(request.headers.get("authorization", ""))
    if not uid:
        return httpx.Response(401, json={})

    path = request.url.path
    method = request.method
    params = request.url.params

    if path == "/rest/v1/wardrobe_items":
        if method == "GET":
            rows = [row for row in ITEMS if row["user_id"] == uid]
            ids = _in_ids(params.get("id"))
            if ids is not None:
                rows = [row for row in rows if row["id"] in ids]
            else:
                rows = [row for row in rows if _match_eq(row, params, "id")]
            return httpx.Response(200, json=[dict(row) for row in rows])

        if method == "POST":
            values = _json(request)
            if values.get("user_id") != uid:
                return httpx.Response(403, json={})
            row = {
                "id": values.get("id") or f"aaaa0000-0000-4000-8000-{len(ITEMS):012d}",
                "user_id": values["user_id"],
                "item_name": values["item_name"],
                "category": values["category"],
                "subcategory": values.get("subcategory"),
                "colour": values.get("colour"),
                "colour_hex": values.get("colour_hex"),
                "pattern": values.get("pattern"),
                "style": values.get("style"),
                "suggested_occasions": values.get("suggested_occasions") or [],
                "season": values.get("season"),
                "times_worn": values.get("times_worn", 0),
                "created_at": _now(),
                "updated_at": _now(),
            }
            ITEMS.append(row)
            return httpx.Response(201, json=[dict(row)])

        if method == "PATCH":
            wanted = _eq(params.get("id"))
            rows = [
                row
                for row in ITEMS
                if row["user_id"] == uid and row["id"] == wanted
            ]
            if not rows:
                return httpx.Response(200, json=[])
            values = _json(request)
            if not isinstance(values.get("times_worn", 0), int):
                return httpx.Response(400, json={"message": "invalid input syntax"})
            rows[0].update(values)
            return httpx.Response(200, json=[dict(rows[0])])

    if path == "/rest/v1/outfits":
        if method == "GET":
            rows = [row for row in OUTFITS if row["user_id"] == uid]
            rows = [row for row in rows if _match_eq(row, params, "id")]
            rows = [row for row in rows if _match_eq(row, params, "combo_key")]
            return httpx.Response(200, json=[dict(row) for row in rows])

        if method == "POST":
            values = _json(request)
            if values.get("user_id") != uid:
                return httpx.Response(403, json={})
            row = dict(values)
            row["id"] = f"bbbb0000-0000-4000-8000-{len(OUTFITS):012d}"
            OUTFITS.append(row)
            return httpx.Response(201, json=[dict(row)])

    if path == "/rest/v1/outfit_items":
        outfit_id = _eq(params.get("outfit_id"))
        if method == "GET":
            rows = [row for row in OUTFIT_ITEMS if row["outfit_id"] == outfit_id]
            return httpx.Response(200, json=[dict(row) for row in rows])

        if method == "POST":
            values = _json(request)
            row = dict(values)
            row["id"] = f"cccc0000-0000-4000-8000-{len(OUTFIT_ITEMS):012d}"
            OUTFIT_ITEMS.append(row)
            return httpx.Response(201, json=[dict(row)])

    if path == "/rest/v1/saved_outfits":
        if method == "GET":
            rows = [row for row in SAVED if row["user_id"] == uid]
            rows = [row for row in rows if _match_eq(row, params, "outfit_id")]
            return httpx.Response(200, json=[dict(row) for row in rows])

        if method == "POST":
            values = _json(request)
            if values.get("user_id") != uid:
                return httpx.Response(403, json={})
            existing = [
                row
                for row in SAVED
                if row["user_id"] == uid and row["outfit_id"] == values["outfit_id"]
            ]
            if existing:
                return httpx.Response(200, json=[dict(existing[0])])
            row = {
                "id": f"dddd0000-0000-4000-8000-{len(SAVED):012d}",
                "user_id": uid,
                "outfit_id": values["outfit_id"],
                "saved_at": _now(),
            }
            SAVED.append(row)
            return httpx.Response(201, json=[dict(row)])

        if method == "DELETE":
            outfit_id = _eq(params.get("outfit_id"))
            removed = [
                row
                for row in SAVED
                if row["user_id"] == uid
                and (outfit_id is None or row["outfit_id"] == outfit_id)
            ]
            SAVED[:] = [row for row in SAVED if row not in removed]
            return httpx.Response(200, json=removed)

    if path == "/rest/v1/outfit_feedback":
        if method == "GET":
            rows = [row for row in FEEDBACK if row["user_id"] == uid]
            rows = [row for row in rows if _match_eq(row, params, "outfit_id")]
            rows = [row for row in rows if _match_eq(row, params, "feedback_type")]
            return httpx.Response(200, json=[dict(row) for row in rows])

        if method == "POST":
            values = _json(request)
            if values.get("user_id") != uid:
                return httpx.Response(403, json={})
            row = {
                "id": f"eeee0000-0000-4000-8000-{len(FEEDBACK):012d}",
                "user_id": uid,
                "outfit_id": values["outfit_id"],
                "feedback_type": values.get("feedback_type", "NOT_FOR_ME"),
                "created_at": _now(),
            }
            FEEDBACK.append(row)
            return httpx.Response(201, json=[dict(row)])

    if path == "/rest/v1/outfit_wear_history":
        if method == "GET":
            rows = [row for row in HISTORY if row["user_id"] == uid]
            for field in ("outfit_id", "worn_on"):
                rows = [row for row in rows if _match_eq(row, params, field)]
            return httpx.Response(200, json=[dict(row) for row in rows])

        if method == "POST":
            values = _json(request)
            if values.get("user_id") != uid:
                return httpx.Response(403, json={})
            row = {
                "id": f"ffff0000-0000-4000-8000-{len(HISTORY):012d}",
                "user_id": uid,
                "outfit_id": values["outfit_id"],
                "worn_on": values.get("worn_on", date.today().isoformat()),
                "worn_at": _now(),
                "occasion": values.get("occasion"),
            }
            HISTORY.append(row)
            return httpx.Response(201, json=[dict(row)])

    return httpx.Response(404, json={"detail": "Not Found"})


@pytest.fixture()
def client():
    auth_module.clear_auth_cache()
    for store in (ITEMS, OUTFITS, OUTFIT_ITEMS, SAVED, FEEDBACK, HISTORY):
        store.clear()
    REST_AUTH_HEADERS.clear()

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


def auth(token: str | None = "token-alice") -> dict:
    return {} if token is None else {"Authorization": f"Bearer {token}"}


def seed_item(
    owner: str = ALICE,
    name: str = "Ivory Ribbed Tee",
    category: str = "Tops",
    style: str = "Minimal",
    occasions: list[str] | None = None,
) -> dict:
    row = {
        "id": f"aaaa0000-0000-4000-8000-{len(ITEMS):012d}",
        "user_id": owner,
        "item_name": name,
        "category": category,
        "subcategory": "T-shirt",
        "colour": "Ivory",
        "colour_hex": "#EFEADF",
        "pattern": "Solid",
        "style": style,
        "suggested_occasions": occasions if occasions is not None else ["College", "Casual"],
        "season": "All-season",
        "times_worn": 0,
        "created_at": _now(),
        "updated_at": _now(),
    }
    ITEMS.append(row)
    return row


# ── OpenAPI ───────────────────────────────────────────────────────


def test_openapi_schema_generates(client):
    """The annotation bugs previously made /openapi.json a 500."""
    response = client.get("/openapi.json")

    assert response.status_code == 200, response.text
    paths = response.json()["paths"]
    assert "/api/outfits/recommendations" in paths
    assert "/api/outfits/insights" in paths
    assert "/api/outfits/history" in paths


# ── recommendations ───────────────────────────────────────────────


def test_recommendations_require_authentication(client):
    assert client.get("/api/outfits/recommendations").status_code == 401


def test_recommendations_use_authenticated_users_wardrobe(client):
    top = seed_item(name="Ivory Ribbed Tee", category="Tops")
    bottom = seed_item(name="Blue Jeans", category="Bottoms", style="Classic")

    response = client.get("/api/outfits/recommendations", headers=auth())

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["algorithm_info"]["item_count"] == 2
    assert body["outfits"], "expected at least one top+bottom combination"

    returned_ids = {
        item["id"] for outfit in body["outfits"] for item in outfit["items"]
    }
    assert returned_ids <= {top["id"], bottom["id"]}

    # The service previously built its own client with an empty bearer token.
    assert REST_AUTH_HEADERS, "expected PostgREST calls"
    assert all(
        header.startswith("Bearer ") and len(header) > len("Bearer ")
        for header in REST_AUTH_HEADERS
    ), REST_AUTH_HEADERS


def test_recommendations_do_not_leak_between_users(client):
    alice_items = [
        seed_item(owner=ALICE, name="Alice Tee", category="Tops"),
        seed_item(owner=ALICE, name="Alice Jeans", category="Bottoms"),
    ]
    bob_items = [
        seed_item(owner=BOB, name="Bob Knit", category="Tops"),
        seed_item(owner=BOB, name="Bob Trousers", category="Bottoms"),
    ]

    alice = client.get("/api/outfits/recommendations", headers=auth()).json()
    bob = client.get(
        "/api/outfits/recommendations", headers=auth("token-bob")
    ).json()

    alice_ids = {item["id"] for outfit in alice["outfits"] for item in outfit["items"]}
    bob_ids = {item["id"] for outfit in bob["outfits"] for item in outfit["items"]}

    assert alice_ids == {item["id"] for item in alice_items}
    assert bob_ids == {item["id"] for item in bob_items}
    assert alice_ids.isdisjoint(bob_ids)


def test_recommendations_apply_occasion_and_style_filters(client):
    seed_item(name="College Tee", category="Tops", style="Minimal", occasions=["College"])
    seed_item(
        name="College Jeans",
        category="Bottoms",
        style="Minimal",
        occasions=["College"],
    )

    college = client.get(
        "/api/outfits/recommendations",
        headers=auth(),
        params={"occasion": "College", "style": "Minimal"},
    )
    party = client.get(
        "/api/outfits/recommendations",
        headers=auth(),
        params={"occasion": "Party"},
    )

    assert college.status_code == 200, college.text
    assert college.json()["outfits"]
    assert party.status_code == 200, party.text
    assert party.json()["outfits"] == []


# ── outfit lifecycle ──────────────────────────────────────────────


def _register_outfit(client, item_ids: list[str], name: str = "Quiet Classic") -> dict:
    response = client.post(
        "/api/outfits/register",
        headers=auth(),
        json={
            "outfit_name": name,
            "occasion": "College",
            "recommendation_score": 90,
            "styling_explanation": "Clean neutral pairing.",
            "wardrobe_item_ids": item_ids,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_outfit_lifecycle_records_the_authenticated_user(client):
    top = seed_item(name="Ivory Ribbed Tee", category="Tops")
    bottom = seed_item(name="Blue Jeans", category="Bottoms")

    outfit = _register_outfit(client, [top["id"], bottom["id"]])
    outfit_id = outfit["id"]
    assert {item["id"] for item in outfit["items"]} == {top["id"], bottom["id"]}

    assert client.post(f"/api/outfits/{outfit_id}/save", headers=auth()).status_code == 200
    assert client.get("/api/outfits/saved-ids", headers=auth()).json() == [outfit_id]

    feedback = client.post(f"/api/outfits/{outfit_id}/feedback", headers=auth())
    assert feedback.status_code == 200, feedback.text

    worn = client.post(f"/api/outfits/{outfit_id}/worn", headers=auth())
    assert worn.status_code == 200, worn.text

    assert SAVED and all(row["user_id"] == ALICE for row in SAVED)
    assert FEEDBACK and all(row["user_id"] == ALICE for row in FEEDBACK)
    assert HISTORY and all(row["user_id"] == ALICE for row in HISTORY)
    assert all(row["times_worn"] == 1 for row in ITEMS)


def test_read_endpoints_do_not_raise(client):
    top = seed_item(name="Ivory Ribbed Tee", category="Tops")
    bottom = seed_item(name="Blue Jeans", category="Bottoms")
    outfit = _register_outfit(client, [top["id"], bottom["id"]])
    client.post(f"/api/outfits/{outfit['id']}/save", headers=auth())
    client.post(f"/api/outfits/{outfit['id']}/worn", headers=auth())

    for path in (
        "/api/outfits/saved",
        "/api/outfits/saved-ids",
        "/api/outfits/worn-today-ids",
        "/api/outfits/history",
        "/api/outfits/insights",
    ):
        response = client.get(path, headers=auth())
        assert response.status_code == 200, f"{path}: {response.text}"


def test_insights_with_empty_history(client):
    """No wear history returns the empty shape instead of raising."""
    body = client.get("/api/outfits/insights", headers=auth()).json()

    assert body["sufficient_data"] is False
    assert body["total_worn"] == 0
    assert body["total_items"] == 0
    assert body["categories_most"] == []
    assert body["favourite_items"] == []


def test_insights_reports_wear_statistics_without_negative_rate(client):
    top = seed_item(name="Ivory Ribbed Tee", category="Tops")
    bottom = seed_item(name="Blue Jeans", category="Bottoms")
    outfit = _register_outfit(client, [top["id"], bottom["id"]])

    # Three wears of one combination: one unique outfit, so the repeat rate is a
    # positive percentage (it used to be computed as `1 - ratio * 100`).
    for day in ("2026-11-20", "2026-11-21", "2026-11-22"):
        HISTORY.append({
            "id": f"ffff0000-0000-4000-8000-{len(HISTORY):012d}",
            "user_id": ALICE,
            "outfit_id": outfit["id"],
            "worn_on": day,
            "worn_at": _now(),
            "occasion": "College",
        })
    ITEMS[0]["times_worn"] = 2
    ITEMS[1]["times_worn"] = 1

    body = client.get("/api/outfits/insights", headers=auth()).json()

    assert body["sufficient_data"] is True
    assert body["total_worn"] == 3
    assert body["repeat_stats"]["unique_outfits"] == 1
    assert 0 <= body["repeat_stats"]["repeat_rate"] <= 100
    assert body["favourite_items"][0] == {"id": top["id"], "times_worn": 2}
    assert body["underused_items"][0] == {"id": bottom["id"], "times_worn": 1}
    assert {row["category"] for row in body["categories_most"]} == {"Tops", "Bottoms"}
