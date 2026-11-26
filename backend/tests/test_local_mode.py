"""Phase 2A + Phase 3 local-mode tests.

Covers the real SQLite adapter, local JWT auth, per-user isolation, local image
storage, authenticated media, and the upload -> segmentation -> SQLite flow.
The AI worker is replaced with an in-process fake here (real RF-DETR inference
was verified separately against the local worker).
"""
from __future__ import annotations

import base64
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core import auth as auth_module
from app.core.config import Settings, get_settings
from app.main import create_app
from app.services.ai import get_ai_worker

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64
CUTOUT = b"\x89PNG\r\n\x1a\n" + b"c" * 32


class FakeWorker:
    """Simulates segmentation success while Gemini is unavailable."""

    def __init__(self) -> None:
        self.calls = 0

    async def analyze(self, image: bytes, content_type: str, threshold: float = 0.25) -> dict:
        self.calls += 1
        return {
            "cutout_base64": base64.b64encode(CUTOUT).decode(),
            "label": "T-shirt",
            "confidence": 0.91,
            "analysis": {},  # Gemini unavailable -> no metadata
            "classification_source": "Unavailable (Gemini) - manual review",
        }

    async def health(self):
        return {
            "status": "ok",
            "checkpoint_available": True,
            "model_loaded": True,
            "rfdetr_ready": True,
            "cuda_available": False,
            "gemini_configured": False,
        }


@pytest.fixture()
def ctx():
    tmp = Path(tempfile.mkdtemp(prefix="kapdeeyy_local_"))
    settings = Settings(
        database_backend="sqlite",
        auth_backend="local",
        supabase_url="",
        supabase_anon_key="",
        sqlite_path=str(tmp / "test.db"),
        uploads_path=str(tmp / "uploads"),
        _env_file=None,
    )
    auth_module.clear_auth_cache()
    worker = FakeWorker()

    app = create_app()
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_ai_worker] = lambda: worker
    with TestClient(app) as client:
        yield client, settings, worker, tmp


def auth(client, email="alice@example.com", password="secret123"):
    client.post(
        "/api/auth/register",
        json={"full_name": email.split("@")[0], "email": email, "password": password},
    )
    token = client.post(
        "/api/auth/login", json={"email": email, "password": password}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def upload(client, headers, data=PNG):
    return client.post(
        "/api/wardrobe/upload",
        headers=headers,
        files={"file": ("item.png", data, "image/png")},
    )


# ── auth ──────────────────────────────────────────────────────────

def test_register_login_me_and_validation(ctx):
    client, _, _, _ = ctx
    r = client.post(
        "/api/auth/register",
        json={"full_name": "Alice", "email": "alice@example.com", "password": "secret123"},
    )
    assert r.status_code == 201, r.text
    assert r.json()["email"] == "alice@example.com"

    dup = client.post(
        "/api/auth/register",
        json={"full_name": "Alice", "email": "alice@example.com", "password": "secret123"},
    )
    assert dup.status_code == 409

    bad = client.post("/api/auth/login", json={"email": "alice@example.com", "password": "wrong"})
    assert bad.status_code == 401

    good = client.post("/api/auth/login", json={"email": "alice@example.com", "password": "secret123"})
    assert good.status_code == 200
    token = good.json()["access_token"]

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["full_name"] == "Alice"
    assert client.get("/api/profile", headers={"Authorization": f"Bearer {token}"}).status_code == 200


def test_protected_routes_require_auth(ctx):
    client, _, _, _ = ctx
    assert client.get("/api/wardrobe").status_code == 401
    assert client.get("/api/profile").status_code == 401
    assert client.get("/api/outfits/recommendations").status_code == 401


def test_wardrobe_is_isolated_between_users(ctx):
    client, _, _, _ = ctx
    alice = auth(client, "alice@example.com")
    bob = auth(client, "bob@example.com")

    created = client.post(
        "/api/wardrobe",
        headers=alice,
        json={"item_name": "Alice Tee", "category": "Tops"},
    )
    assert created.status_code == 201, created.text
    item_id = created.json()["id"]

    assert [i["item_name"] for i in client.get("/api/wardrobe", headers=alice).json()] == ["Alice Tee"]
    assert client.get("/api/wardrobe", headers=bob).json() == []
    assert client.patch(f"/api/wardrobe/{item_id}", headers=bob, json={"item_name": "hack"}).status_code == 404
    assert client.delete(f"/api/wardrobe/{item_id}", headers=bob).status_code == 404


# ── upload / segmentation / media ────────────────────────────────

def test_upload_rejects_non_image_and_oversized(ctx):
    client, _, _, _ = ctx
    h = auth(client)
    assert upload(client, h, data=b"not an image").status_code == 415
    assert upload(client, h, data=PNG + b"0" * (10 * 1024 * 1024)).status_code == 413


def test_upload_segment_save_and_media_access(ctx):
    client, settings, worker, _ = ctx
    alice = auth(client, "alice@example.com")
    bob = auth(client, "bob@example.com")

    up = upload(client, alice)
    assert up.status_code == 201, up.text
    path = up.json()["path"]
    user_id = path.split("/")[0]
    original_file = settings.uploads_dir / user_id / "originals" / path.split("/", 1)[1]
    assert original_file.is_file()

    created = client.post(
        "/api/wardrobe",
        headers=alice,
        json={"item_name": "Real Tee", "category": "Tops", "original_image_path": path},
    )
    assert created.status_code == 201, created.text
    item_id = created.json()["id"]

    analysis = client.post(f"/api/wardrobe/{item_id}/analyze", headers=alice)
    assert analysis.status_code == 200, analysis.text
    body = analysis.json()
    assert body["item"]["segmentation_status"] == "completed"
    assert body["classification_source"].startswith("Unavailable (Gemini)")
    # Gemini is optional: the cutout is stored even with no metadata.
    assert body["suggestions"]["category"] == "Tops"
    assert body["suggestions"]["item_name"] is None

    seg_path = body["item"]["segmented_image_path"]
    seg_file = settings.uploads_dir / user_id / "segmented" / seg_path.split("/", 1)[1]
    assert seg_file.is_file() and seg_file.read_bytes() == CUTOUT

    media = body["item"]["image_url"]
    assert media.startswith("/api/media/")
    assert client.get(media).status_code == 200
    assert client.get(media).content == CUTOUT
    assert client.get(media.split("?")[0]).status_code == 401
    # Another user cannot read the private image.
    other = client.get(media.split("?")[0], params={"token": bob["Authorization"].split()[1]})
    assert other.status_code == 404

    # Refresh (a fresh list request) still returns the saved garment.
    listed = client.get("/api/wardrobe", headers=alice).json()
    assert [i["id"] for i in listed] == [item_id]
    assert listed[0]["image_url"].startswith("/api/media/")

    # Edit then delete; files are removed with the row.
    edited = client.patch(f"/api/wardrobe/{item_id}", headers=alice, json={"item_name": "Edited"})
    assert edited.status_code == 200 and edited.json()["item_name"] == "Edited"
    deleted = client.delete(f"/api/wardrobe/{item_id}", headers=alice)
    assert deleted.status_code == 200 and deleted.json()["removed_images"] == 2
    assert not original_file.exists() and not seg_file.exists()
    assert client.get("/api/wardrobe", headers=alice).json() == []


def test_segmentation_failure_is_reported_not_hidden(ctx):
    client, _, worker, _ = ctx
    h = auth(client)

    async def boom(*args, **kwargs):
        from app.services.ai import AIWorkerError

        raise AIWorkerError(503, "worker_unavailable", "The AI service is not running")

    worker.analyze = boom
    up = upload(client, h).json()
    item = client.post(
        "/api/wardrobe",
        headers=h,
        json={"item_name": "No AI", "category": "Tops", "original_image_path": up["path"]},
    ).json()

    r = client.post(f"/api/wardrobe/{item['id']}/analyze", headers=h)
    assert r.status_code == 503
    assert "AI service" in r.json()["detail"]
    listed = client.get("/api/wardrobe", headers=h).json()
    assert listed[0]["segmentation_status"] == "failed"


def test_persistence_across_restart(ctx):
    """A new app instance pointed at the same DB/files still serves the garment."""
    client, settings, _, _ = ctx
    alice = auth(client, "persist@example.com")
    up = upload(client, alice).json()
    item = client.post(
        "/api/wardrobe",
        headers=alice,
        json={"item_name": "Persisted", "category": "Tops", "original_image_path": up["path"]},
    ).json()
    media = client.post(f"/api/wardrobe/{item['id']}/analyze", headers=alice).json()["item"]["image_url"]
    token = alice["Authorization"]

    auth_module.clear_auth_cache()
    restarted = create_app()
    restarted.dependency_overrides[get_settings] = lambda: settings
    restarted.dependency_overrides[get_ai_worker] = lambda: FakeWorker()
    with TestClient(restarted) as c2:
        listed = c2.get("/api/wardrobe", headers={"Authorization": token}).json()
        assert [i["item_name"] for i in listed] == ["Persisted"]
        assert c2.get(media).status_code == 200
        assert c2.get("/api/auth/me", headers={"Authorization": token}).status_code == 200
