"""Wardrobe tests: storage uploads, signed URLs, metadata CRUD and isolation.

Supabase Auth, PostgREST + RLS and Storage are replaced by an in-process fake
(httpx.MockTransport). The fake enforces the same ownership rules as
database/migrations/002_rls.sql and 003_storage.sql.
"""
import json
from datetime import datetime, timezone

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

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"0" * 64
WEBP = b"RIFF\x00\x00\x00\x00WEBP" + b"0" * 64

ITEMS: list[dict] = []
STORAGE: dict[tuple[str, str], bytes] = {}
FAIL_INSERT = False
FAIL_STORAGE_DELETE = False


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _eq(value: str | None) -> str | None:
    if not value:
        return None
    return value.removeprefix("eq.")


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

        params = request.url.params
        method = request.method

        if method == "GET":
            rows = [row for row in ITEMS if row["user_id"] == uid]
            wanted = _eq(params.get("id"))
            if wanted:
                rows = [row for row in rows if row["id"] == wanted]
            return httpx.Response(200, json=[dict(row) for row in rows])

        if method == "POST":
            if FAIL_INSERT:
                return httpx.Response(500, json={"message": "insert failed"})
            values = _json(request)
            if values.get("user_id") != uid:  # RLS insert check
                return httpx.Response(403, json={})
            row = {
                "id": values.get("id") or f"00000000-0000-4000-8000-{len(ITEMS):012d}",
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
                "original_image_path": values.get("original_image_path"),
                "segmented_image_path": values.get("segmented_image_path"),
                "segmentation_status": values.get("segmentation_status", "pending"),
                "created_at": _now(),
                "updated_at": _now(),
            }
            ITEMS.insert(0, row)
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
            if "user_id" in values and values["user_id"] != uid:
                return httpx.Response(403, json={})
            rows[0].update(values)
            rows[0]["updated_at"] = _now()
            return httpx.Response(200, json=[dict(rows[0])])

        if method == "DELETE":
            wanted = _eq(params.get("id"))
            kept, deleted = [], []
            for row in ITEMS:
                if row["user_id"] == uid and row["id"] == wanted:
                    deleted.append(dict(row))
                else:
                    kept.append(row)
            ITEMS[:] = kept
            return httpx.Response(200, json=deleted)

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
                json={
                    "signedURL": (
                        f"/object/sign/{bucket}/{object_path}?token=fake-token"
                    )
                },
            )

        if request.method == "POST":
            bucket, object_path = relative.split("/", 1)
            if object_path.split("/")[0] != uid:
                return httpx.Response(403, json={})
            STORAGE[(bucket, object_path)] = request.content
            return httpx.Response(200, json={"Key": f"{bucket}/{object_path}"})

        if request.method == "DELETE":
            bucket = relative
            if FAIL_STORAGE_DELETE:
                return httpx.Response(500, json={"message": "delete failed"})
            removed = 0
            for prefix in _json(request).get("prefixes", []):
                if prefix.split("/")[0] != uid:
                    return httpx.Response(403, json={})
                if STORAGE.pop((bucket, prefix), None) is not None:
                    removed += 1
            return httpx.Response(200, json=[{"name": str(removed)}])

    return httpx.Response(404, json={})


@pytest.fixture()
def client():
    global FAIL_INSERT, FAIL_STORAGE_DELETE
    auth_module.clear_auth_cache()
    ITEMS.clear()
    STORAGE.clear()
    FAIL_INSERT = False
    FAIL_STORAGE_DELETE = False

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


def upload(client, token="token-alice", data=PNG, filename="tee.png", media="image/png"):
    return client.post(
        "/api/wardrobe/upload",
        headers=auth(token),
        files={"file": (filename, data, media)},
    )


def create_item(client, token="token-alice", name="Ivory Ribbed Tee", image_path=None):
    if image_path is None:
        uploaded = upload(client, token)
        assert uploaded.status_code == 201, uploaded.text
        image_path = uploaded.json()["path"]

    response = client.post(
        "/api/wardrobe",
        headers=auth(token),
        json={
            "item_name": name,
            "category": "Tops",
            "subcategory": "T-shirt",
            "colour": "Ivory",
            "colour_hex": "#EFEADF",
            "pattern": "Textured",
            "style": "Minimal",
            "suggested_occasions": ["College", "Casual"],
            "season": "All-season",
            "original_image_path": image_path,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


# ── auth + upload validation ──────────────────────────────────────


def test_wardrobe_requires_token(client):
    assert client.get("/api/wardrobe").status_code == 401
    assert upload(client, token=None).status_code in (401, 403)
    assert (
        client.post(
            "/api/wardrobe",
            json={"item_name": "x", "category": "Tops"},
        ).status_code
        == 401
    )


def test_upload_rejects_non_image(client):
    response = upload(client, data=b"not an image", media="image/png")
    assert response.status_code == 415
    assert not STORAGE


def test_upload_rejects_oversized_image(client):
    response = upload(client, data=b"\x89PNG\r\n\x1a\n" + b"0" * (10 * 1024 * 1024))
    assert response.status_code == 413
    assert not STORAGE


def test_upload_accepts_jpeg_png_webp(client):
    for index, (data, media) in enumerate(
        ((PNG, "image/png"), (JPEG, "image/jpeg"), (WEBP, "image/webp"))
    ):
        response = upload(client, data=data, filename=f"item{index}", media=media)
        assert response.status_code == 201, response.text


def test_upload_stores_file_under_authenticated_user_folder(client):
    response = upload(client, filename="../../evil.exe", media="text/html")
    assert response.status_code == 201, response.text

    body = response.json()
    folder, filename = body["path"].split("/")
    assert folder == ALICE
    assert filename.endswith(".png")
    assert "evil" not in filename
    assert STORAGE[("wardrobe-original", body["path"])].startswith(b"\x89PNG")
    assert body["image_url"].startswith("https://proj.supabase.co/storage/v1")
    assert "fake-token" in body["image_url"]


def test_discard_upload_only_allows_own_files(client):
    alice_path = upload(client).json()["path"]
    bob_path = upload(client, token="token-bob").json()["path"]

    assert (
        client.delete(
            "/api/wardrobe/upload", headers=auth(), params={"path": bob_path}
        ).status_code
        == 400
    )
    assert (
        client.delete(
            "/api/wardrobe/upload",
            headers=auth(),
            params={"path": "../wardrobe-original/x.png"},
        ).status_code
        == 400
    )

    response = client.delete(
        "/api/wardrobe/upload", headers=auth(), params={"path": alice_path}
    )
    assert response.status_code == 200
    assert ("wardrobe-original", alice_path) not in STORAGE
    assert ("wardrobe-original", bob_path) in STORAGE


# ── create ────────────────────────────────────────────────────────


def test_create_persists_metadata_and_returns_signed_image(client):
    uploaded = upload(client).json()
    response = client.post(
        "/api/wardrobe",
        headers=auth(),
        json={
            "item_name": "  Ivory Ribbed Tee  ",
            "category": "Tops",
            "subcategory": "T-shirt",
            "colour": "Ivory",
            "colour_hex": "#EFEADF",
            "pattern": "Textured",
            "style": "Minimal",
            "suggested_occasions": ["College", "Casual"],
            "season": "All-season",
            "original_image_path": uploaded["path"],
        },
    )

    assert response.status_code == 201, response.text
    item = response.json()

    assert item["item_name"] == "Ivory Ribbed Tee"
    assert item["user_id"] == ALICE
    assert item["segmentation_status"] == "pending"
    assert item["original_image_path"] == uploaded["path"]
    assert item["image_url"].startswith("https://proj.supabase.co/storage/v1")
    assert len(ITEMS) == 1
    assert ITEMS[0]["suggested_occasions"] == ["College", "Casual"]


def test_create_rejects_another_users_image_path(client):
    bob_path = upload(client, token="token-bob").json()["path"]
    response = client.post(
        "/api/wardrobe",
        headers=auth(),
        json={
            "item_name": "Stolen",
            "category": "Tops",
            "original_image_path": bob_path,
        },
    )
    assert response.status_code == 400
    assert not ITEMS


def test_create_rejects_path_traversal_and_missing_files(client):
    for path in (
        f"{ALICE}/../../{BOB}/x.png",
        f"{ALICE}/missing.png",
        f"/{ALICE}/x.png",
    ):
        response = client.post(
            "/api/wardrobe",
            headers=auth(),
            json={
                "item_name": "Bad path",
                "category": "Tops",
                "original_image_path": path,
            },
        )
        assert response.status_code == 400, path

    assert not ITEMS


def test_create_cannot_inject_user_id_or_status(client):
    response = client.post(
        "/api/wardrobe",
        headers=auth(),
        json={
            "item_name": "Injected",
            "category": "Tops",
            "user_id": BOB,
            "segmentation_status": "completed",
        },
    )
    assert response.status_code == 422
    assert not ITEMS


def test_failed_insert_cleans_up_uploaded_file(client):
    global FAIL_INSERT
    path = upload(client).json()["path"]
    FAIL_INSERT = True

    response = client.post(
        "/api/wardrobe",
        headers=auth(),
        json={
            "item_name": "Lost item",
            "category": "Tops",
            "original_image_path": path,
        },
    )

    assert response.status_code == 502
    assert ("wardrobe-original", path) not in STORAGE
    assert not ITEMS


# ── fetch / isolation ─────────────────────────────────────────────


def test_list_returns_only_own_items_with_signed_urls(client):
    alice_item = create_item(client, name="Alice Tee")
    bob_item = create_item(client, token="token-bob", name="Bob Tee")

    alice_list = client.get("/api/wardrobe", headers=auth()).json()
    bob_list = client.get("/api/wardrobe", headers=auth("token-bob")).json()

    assert [item["id"] for item in alice_list] == [alice_item["id"]]
    assert [item["id"] for item in bob_list] == [bob_item["id"]]
    assert alice_list[0]["image_url"].startswith("https://proj.supabase.co/storage/v1")
    assert bob_list[0]["image_url"].startswith("https://proj.supabase.co/storage/v1")


# ── edit ──────────────────────────────────────────────────────────


def test_edit_updates_metadata(client):
    item = create_item(client)

    response = client.patch(
        f"/api/wardrobe/{item['id']}",
        headers=auth(),
        json={
            "item_name": "Edited Tee",
            "colour": "Black",
            "suggested_occasions": ["Party"],
            "season": "Winter",
        },
    )

    assert response.status_code == 200, response.text
    updated = response.json()
    assert updated["item_name"] == "Edited Tee"
    assert updated["colour"] == "Black"
    assert updated["suggested_occasions"] == ["Party"]
    assert updated["season"] == "Winter"
    assert updated["image_url"]
    assert ITEMS[0]["item_name"] == "Edited Tee"


def test_edit_cannot_touch_another_users_item(client):
    item = create_item(client)

    response = client.patch(
        f"/api/wardrobe/{item['id']}",
        headers=auth("token-bob"),
        json={"item_name": "Hijacked"},
    )

    assert response.status_code == 404
    assert ITEMS[0]["item_name"] == "Ivory Ribbed Tee"


def test_edit_rejects_unknown_fields(client):
    item = create_item(client)
    response = client.patch(
        f"/api/wardrobe/{item['id']}",
        headers=auth(),
        json={"user_id": BOB},
    )
    assert response.status_code == 422


# ── delete ────────────────────────────────────────────────────────


def test_delete_removes_original_and_segmented_images_then_row(client):
    item = create_item(client)
    segmented_path = f"{ALICE}/cutout.png"
    ITEMS[0]["segmented_image_path"] = segmented_path
    STORAGE[("wardrobe-segmented", segmented_path)] = b"\x89PNG\r\n\x1a\ncutout"

    response = client.delete(f"/api/wardrobe/{item['id']}", headers=auth())

    assert response.status_code == 200, response.text
    assert response.json()["removed_images"] == 2
    assert not ITEMS
    assert ("wardrobe-original", item["original_image_path"]) not in STORAGE
    assert ("wardrobe-segmented", segmented_path) not in STORAGE


def test_delete_does_not_report_success_when_storage_cleanup_fails(client):
    global FAIL_STORAGE_DELETE
    item = create_item(client)
    FAIL_STORAGE_DELETE = True

    response = client.delete(f"/api/wardrobe/{item['id']}", headers=auth())

    assert response.status_code == 502
    assert "not be deleted" not in response.json()["detail"]  # cleanup, not DB, failed
    assert len(ITEMS) == 1
    assert ("wardrobe-original", item["original_image_path"]) in STORAGE


def test_delete_refuses_invalid_stored_path(client):
    item = create_item(client)
    ITEMS[0]["original_image_path"] = f"{BOB}/foreign.png"
    STORAGE[("wardrobe-original", f"{BOB}/foreign.png")] = PNG

    response = client.delete(f"/api/wardrobe/{item['id']}", headers=auth())

    assert response.status_code == 409
    assert len(ITEMS) == 1
    assert ("wardrobe-original", f"{BOB}/foreign.png") in STORAGE


def test_delete_cannot_touch_another_users_item(client):
    item = create_item(client)

    response = client.delete(f"/api/wardrobe/{item['id']}", headers=auth("token-bob"))

    assert response.status_code == 404
    assert len(ITEMS) == 1
    assert ("wardrobe-original", item["original_image_path"]) in STORAGE
