"""Client for the local AI worker (backend/.venv-ai).

Only this module knows the worker's address and shared token. The Gemini key
lives in the worker environment and is never sent to this process or the
browser.
"""

from __future__ import annotations

import base64
from typing import Any

import httpx
from fastapi import Depends, HTTPException, status

from app.core.config import Settings, get_settings
from app.core.http import get_http


class AIWorkerError(Exception):
    """A worker-side failure that should be reported without leaking details."""

    def __init__(self, status_code: int, code: str, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.code = code
        self.detail = detail


class AIWorkerUnavailable(AIWorkerError):
    def __init__(self) -> None:
        super().__init__(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "worker_unavailable",
            "The AI service is not running. Start the local AI worker and try again.",
        )


class AIWorkerClient:
    def __init__(self, client: httpx.AsyncClient, settings: Settings) -> None:
        self._client = client
        self._settings = settings

    @property
    def _headers(self) -> dict[str, str]:
        token = self._settings.ai_worker_token.strip()
        return {"X-AI-Worker-Token": token} if token else {}

    async def health(self) -> dict[str, Any] | None:
        """Readiness probe. Never loads the model; returns None when offline."""
        try:
            resp = await self._client.get(
                f"{self._settings.ai_worker_url.rstrip('/')}/health",
                headers=self._headers,
                timeout=5,
            )
        except httpx.HTTPError:
            return None
        if resp.status_code != 200:
            return None
        try:
            body = resp.json()
        except ValueError:
            return None
        return body if isinstance(body, dict) else None

    async def analyze(
        self,
        image: bytes,
        content_type: str,
        threshold: float = 0.25,
    ) -> dict[str, Any]:
        """Send the original image and receive the cutout + Gemini metadata."""
        payload = {
            "image_base64": base64.b64encode(image).decode("ascii"),
            "content_type": content_type,
            "threshold": threshold,
        }

        try:
            resp = await self._client.post(
                f"{self._settings.ai_worker_url.rstrip('/')}/analyze",
                json=payload,
                headers=self._headers,
                # Inference may take a while on CPU; the shared client's default
                # timeout is far too short for the first (cold-cache) request.
                timeout=self._settings.ai_worker_timeout_seconds,
            )
        except httpx.TimeoutException:
            raise AIWorkerError(
                status.HTTP_504_GATEWAY_TIMEOUT,
                "worker_timeout",
                "The AI service timed out. Please try again.",
            )
        except httpx.HTTPError:
            raise AIWorkerUnavailable()

        if resp.status_code >= 400:
            code, detail = "worker_error", "The AI service could not analyze this image"
            try:
                error = resp.json().get("error") or {}
                code = error.get("code") or code
                detail = error.get("message") or detail
            except (ValueError, AttributeError):
                pass
            raise AIWorkerError(
                resp.status_code if resp.status_code < 500 else status.HTTP_502_BAD_GATEWAY,
                code,
                detail,
            )

        try:
            body = resp.json()
        except ValueError:
            raise AIWorkerError(
                status.HTTP_502_BAD_GATEWAY,
                "invalid_worker_response",
                "The AI service returned an invalid response",
            )

        if not isinstance(body, dict) or not body.get("cutout_base64") or not isinstance(body.get("analysis"), dict):
            raise AIWorkerError(
                status.HTTP_502_BAD_GATEWAY,
                "invalid_worker_response",
                "The AI service returned an incomplete response",
            )
        return body


def get_ai_worker(
    client: httpx.AsyncClient = Depends(get_http),
    settings: Settings = Depends(get_settings),
) -> AIWorkerClient:
    return AIWorkerClient(client, settings)


__all__ = [
    "AIWorkerClient",
    "AIWorkerError",
    "AIWorkerUnavailable",
    "get_ai_worker",
]
