"""Authentication tests for local-first mode (Phase 2A)."""

import os
import tempfile
import uuid
import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException

from app.core.config import Settings, get_settings
from app.main import create_app


@pytest.fixture()
def client():
    """Create a test client with local SQLite mode."""
    from app.core import auth as auth_module

    auth_module.clear_auth_cache()

    # Use a temp db file so each test gets a fresh DB
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp_path = os.path.join(tempfile.gettempdir(), "test_{}.db".format(uuid.uuid4().hex[:8]))
    tmp.close()
    # Delete any existing file to start fresh
    if os.path.exists(tmp_path):
        os.unlink(tmp_path)

    # Override sqlite_path in settings so each test uses its own DB
    # (The sqlite_file property uses sqlite_path, not a constructor parameter)
    app = create_app()
    app.dependency_overrides[get_settings] = lambda: Settings(
        database_backend="sqlite",
        auth_backend="local",
        supabase_url="",
        supabase_anon_key="",
        _env_file=None,
        sqlite_path=tmp_path,  # Override to use temp DB per test
    )

    with TestClient(app) as c:
        yield c

    # Cleanup after test - close connection, then delete
    import time
    time.sleep(0.1)  # Small delay to release file handle
    if os.path.exists(tmp_path):
        try:
            os.unlink(tmp_path)
        except PermissionError:
            pass  # File still in use, will be cleaned up manually later


def test_register_new_user(client):
    """Register a new user and verify the response."""
    response = client.post("/api/auth/register", json={
        "full_name": "Test User",
        "email": "test@example.com",
        "password": "password123",
    })
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["full_name"] == "Test User"
    assert "id" in data


def test_duplicate_email_registration(client):
    """Register with the same email twice should fail with 409."""
    # First registration
    response1 = client.post("/api/auth/register", json={
        "full_name": "Test User",
        "email": "test@example.com",
        "password": "password123",
    })
    assert response1.status_code == 201, response1.text

    # Second registration with same email should fail
    response2 = client.post("/api/auth/register", json={
        "full_name": "Different User",
        "email": "test@example.com",
        "password": "password123",
    })
    assert response2.status_code == 409, response2.text


def test_login_valid_credentials(client):
    """Login with valid credentials should return a JWT."""
    # First register a user
    client.post("/api/auth/register", json={
        "full_name": "Login User",
        "email": "login@example.com",
        "password": "password123",
    })

    # Now login
    response = client.post("/api/auth/login", json={
        "email": "login@example.com",
        "password": "password123",
    })
    assert response.status_code == 200, response.text
    data = response.json()
    assert "access_token" in data
    assert data["expires_in"] > 0


def test_login_invalid_credentials(client):
    """Login with wrong password should return 401."""
    # Register first
    client.post("/api/auth/register", json={
        "full_name": "Bad Login User",
        "email": "bad@example.com",
        "password": "password123",
    })

    # Wrong password
    response = client.post("/api/auth/login", json={
        "email": "bad@example.com",
        "password": "wrongpassword",
    })
    assert response.status_code == 401, response.text


def test_login_nonexistent_user(client):
    """Login with nonexistent user should return 401."""
    response = client.post("/api/auth/login", json={
        "email": "nonexistent@example.com",
        "password": "password123",
    })
    assert response.status_code == 401, response.text


def test_me_with_valid_token(client):
    """GET /api/auth/me with valid JWT should return user info."""
    # Register and login to get a token
    client.post("/api/auth/register", json={
        "full_name": "Me User",
        "email": "me@example.com",
        "password": "password123",
    })

    login_response = client.post("/api/auth/login", json={
        "email": "me@example.com",
        "password": "password123",
    })
    token = login_response.json()["access_token"]

    # Get me
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["email"] == "me@example.com"
    assert data["id"]  # UUID issued at registration


def test_me_without_token(client):
    """GET /api/auth/me without token should fail."""
    response = client.get("/api/auth/me")
    assert response.status_code == 401, response.text


def test_me_with_invalid_token(client):
    """GET /api/auth/me with invalid token should fail."""
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid.token.here"})
    assert response.status_code == 401, response.text


def test_protected_endpoint_requires_auth(client):
    """Protected endpoint (profile) requires authentication."""
    response = client.get("/api/profile")
    assert response.status_code == 401, response.text


def test_user_isolation(client):
    """Two registered users should have isolated data."""
    # Register user 1
    client.post("/api/auth/register", json={
        "full_name": "User One",
        "email": "user1@example.com",
        "password": "password123",
    })

    # Register user 2
    client.post("/api/auth/register", json={
        "full_name": "User Two",
        "email": "user2@example.com",
        "password": "password123",
    })

    # Login as user 1 and create a wardrobe item
    login1 = client.post("/api/auth/login", json={
        "email": "user1@example.com",
        "password": "password123",
    })
    token1 = login1.json()["access_token"]

    login2 = client.post("/api/auth/login", json={
        "email": "user2@example.com",
        "password": "password123",
    })
    token2 = login2.json()["access_token"]

    # User 1 creates a wardrobe item
    client.post("/api/wardrobe", json={
        "item_name": "User 1 Shirt",
        "category": "Tops",
    }, headers={"Authorization": f"Bearer {token1}"})

    # User 2 creates a wardrobe item
    client.post("/api/wardrobe", json={
        "item_name": "User 2 Shirt",
        "category": "Tops",
    }, headers={"Authorization": f"Bearer {token2}"})

    # Verify user 1 can only see their own items
    response = client.get("/api/wardrobe", headers={"Authorization": f"Bearer {token1}"})
    assert response.status_code == 200
    user1_items = response.json()
    user1_ids = {item["id"] for item in user1_items}
    assert len(user1_ids) == 1
    assert user1_ids.pop().endswith("User 1 Shirt") or user1_items[0]["item_name"] == "User 1 Shirt"

    # Verify user 2 can only see their own items
    response = client.get("/api/wardrobe", headers={"Authorization": f"Bearer {token2}"})
    assert response.status_code == 200
    user2_items = response.json()
    user2_ids = {item["id"] for item in user2_items}
    assert len(user2_ids) == 1