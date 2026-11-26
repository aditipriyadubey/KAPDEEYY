from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import ai, auth, health, media, outfits, profile, wardrobe
from app.core.config import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http = httpx.AsyncClient(timeout=15)
    try:
        yield
    finally:
        await app.state.http.aclose()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Closet Remix API", version="0.2.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    app.include_router(auth.router, prefix="/api")
    app.include_router(health.router, prefix="/api")
    app.include_router(profile.router, prefix="/api")
    app.include_router(wardrobe.router, prefix="/api")
    app.include_router(media.router, prefix="/api")
    app.include_router(ai.router, prefix="/api")
    app.include_router(outfits.router, prefix="/api")

    return app


app = create_app()