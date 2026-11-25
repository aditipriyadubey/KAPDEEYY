import httpx
from fastapi import Request


def get_http(request: Request) -> httpx.AsyncClient:
    """Shared AsyncClient (created in app lifespan). Overridden in tests."""
    return request.app.state.http
