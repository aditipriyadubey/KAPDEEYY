from fastapi import APIRouter, Depends

from app.core.auth import AuthUser, get_current_user
from app.core.config import Settings, get_settings
from app.schemas.ai import AIStatusOut
from app.services.ai import AIWorkerClient, get_ai_worker

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(settings: Settings = Depends(get_settings)) -> dict:
    """Public liveness check. Reports configuration presence only, never secrets."""
    return {"status": "ok", "supabase_configured": settings.supabase_configured}


@router.get("/ai/status", response_model=AIStatusOut)
async def ai_status(
    _: AuthUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    worker: AIWorkerClient = Depends(get_ai_worker),
) -> AIStatusOut:
    """Report readiness without loading the model or exposing any secret.

    The worker loads RF-DETR once at startup; this probe only reads its cached
    state. Gemini configuration is reported as a boolean, never as the key.
    """
    checkpoint = settings.segmentation_weights_file.is_file()
    health = await worker.health()
    available = health is not None

    if not available:
        return AIStatusOut(
            status="unavailable",
            checkpoint_available=checkpoint,
            worker_available=False,
            rfdetr_ready=False,
        )

    rfdetr_ready = bool(health.get("rfdetr_ready"))
    gemini_ready = bool(health.get("gemini_configured"))
    model_loaded = bool(health.get("model_loaded"))

    return AIStatusOut(
        status="ok" if checkpoint and rfdetr_ready and gemini_ready else "degraded",
        checkpoint_available=checkpoint and bool(health.get("checkpoint_available", True)),
        worker_available=True,
        rfdetr_ready=rfdetr_ready,
        model_loaded=model_loaded,
        cuda_available=bool(health.get("cuda_available")),
        gemini_configured=gemini_ready,
        detail={
            "worker_status": health.get("status"),
            "model_error": health.get("model_error"),
        },
    )
