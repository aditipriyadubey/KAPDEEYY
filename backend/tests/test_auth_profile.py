"""Auth + profile tests. Supabase is replaced by an in-process fake (httpx.MockTransport)
that behaves like Supabase Auth + PostgREST + RLS for the `profiles` table."""
import httpx
import pytest
from fastapi.testclient import TestClient

from app.core import auth as auth_module
from app.core.config import Settings, get_settings
from app.core.http import get_http
from app.main import create_app

TOKENS = {"token-alice": "11111111-1111-1111-1111-111111111111", "token-bob": "22222222-2222-2222-2222-222222222222"}
PROFILES = {}
CALLS: list[httpx.Request] = []


def fake_supabase(request: httpx.Request) -> httpx.Response:
    CALLS.append(request)
    token = request.headers.get("authorization", "").removeprefix("Bearer ")
    uid = TOKENS.get(token)
    if request.url.path == "/auth/v1/user":
        if not uid:
            return httpx.Response(401, json={"msg": "invalid JWT"})
        return httpx.Response(200, json={"id": uid, "email": f"{uid[:4]}@x.com"})
    if request.url.path == "/rest/v1/profiles":
        if not uid:
            return httpx.Response(401, json={})
        # emulate RLS: caller only ever sees / changes their own row, whatever the filter says
        row = PROFILES.get(uid)
        wanted = request.url.params.get("id", "")
        if request.method == "GET":
            return httpx.Response(200, json=[row] if row and wanted == f"eq.{uid}" else [])
        if request.method == "PATCH":
            if not row or wanted != f"eq.{uid}":
                return httpx.Response(200, json=[])
            import json as _json
            row.update(_json.loads(request.content))
            return httpx.Response(200, json=[row])
    return httpx.Response(404, json={})


@pytest.fixture()
def client():
    auth_module.clear_auth_cache()
    CALLS.clear()
    PROFILES.clear()
    for tok, uid in TOKENS.items():
        PROFILES[uid] = {"id": uid, "full_name": tok.split("-")[1].title(), "email": f"{uid[:4]}@x.com"}

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


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_health_is_public(client):
    assert client.get("/api/health").json()["status"] == "ok"


def test_profile_requires_token(client):
    assert client.get("/api/profile").status_code == 401


def test_profile_rejects_invalid_token(client):
    assert client.get("/api/profile", headers=auth("garbage")).status_code == 401


def test_profile_returns_own_row(client):
    r = client.get("/api/profile", headers=auth("token-alice"))
    assert r.status_code == 200
    assert r.json()["full_name"] == "Alice"


def test_each_user_gets_their_own_profile(client):
    assert client.get("/api/profile", headers=auth("token-alice")).json()["full_name"] == "Alice"
    assert client.get("/api/profile", headers=auth("token-bob")).json()["full_name"] == "Bob"


def test_update_profile_uses_token_identity(client):
    r = client.put("/api/profile", headers=auth("token-alice"), json={"full_name": "  Alice B  "})
    assert r.status_code == 200 and r.json()["full_name"] == "Alice B"
    assert PROFILES[TOKENS["token-bob"]]["full_name"] == "Bob"  # untouched


def test_frontend_cannot_choose_user_id(client):
    r = client.put("/api/profile", headers=auth("token-alice"),
                   json={"full_name": "x", "id": TOKENS["token-bob"]})
    assert r.status_code == 422  # unknown fields forbidden
    assert PROFILES[TOKENS["token-bob"]]["full_name"] == "Bob"


def test_user_id_query_param_is_ignored(client):
    r = client.get(f"/api/profile?id={TOKENS['token-bob']}", headers=auth("token-alice"))
    assert r.json()["full_name"] == "Alice"
    rest_calls = [c for c in CALLS if c.url.path == "/rest/v1/profiles"]
    assert all(c.url.params["id"] == f"eq.{TOKENS['token-alice']}" for c in rest_calls)


def test_blank_name_rejected(client):
    assert client.put("/api/profile", headers=auth("token-alice"), json={"full_name": "   "}).status_code == 422


def test_user_jwt_forwarded_so_rls_applies(client):
    client.get("/api/profile", headers=auth("token-alice"))
    rest = [c for c in CALLS if c.url.path == "/rest/v1/profiles"][0]
    assert rest.headers["authorization"] == "Bearer token-alice"
    assert rest.headers["apikey"] == "anon"


def test_unconfigured_server_returns_503(client):
    client.app.dependency_overrides[get_settings] = lambda: Settings(database_backend="supabase", auth_backend="supabase", _env_file=None)
    assert client.get("/api/profile", headers=auth("token-alice")).status_code == 503
