"""Read-only AI status endpoint (Phase 3B)."""
from fastapi import APIRouter, Depends

from app.core.auth import AuthUser, get_current_user
from app.core.config import Settings, get_settings
from app.schemas.ai import AIStatusOut
from app.services.ai import AIWorkerClient, get_ai_worker

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/status", response_model=AIStatusOut)
async def ai_status(
    user: AuthUser = Depends(get_current_user),
    worker: AIWorkerClient = Depends(get_ai_worker),
    settings: Settings = Depends(get_settings),
) -> AIStatusOut:
    """Report worker/model readiness without exposing secrets."""
    health = await worker.health()
    checkpoint = settings.segmentation_weights_file.is_file()

    if not health:
        return AIStatusOut(
            status="unavailable",
            checkpoint_available=checkpoint,
            worker_available=False,
            rfdetr_ready=False,
        )

    return AIStatusOut(
        status=str(health.get("status") or "ok"),
        checkpoint_available=bool(health.get("checkpoint_available", checkpoint)),
        worker_available=True,
        rfdetr_ready=bool(health.get("rfdetr_ready", False)),
        model_loaded=bool(health.get("model_loaded", False)),
        cuda_available=bool(health.get("cuda_available", False)),
        gemini_configured=bool(health.get("gemini_configured", False)),
    )
