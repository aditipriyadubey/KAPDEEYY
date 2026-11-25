"""Local AI worker for KAPDEEYY (Phase 3B).

Runs in the separate Python 3.13 environment (backend/.venv-ai) because the
RF-DETR / Torch stack does not support the backend's Python 3.14 yet. The
FastAPI backend talks to this process over loopback HTTP; the legacy root
``backend.py`` is never imported by FastAPI.

The RF-DETR model is loaded once at startup and reused for every request. A
single GPU lock serialises inference so two concurrent uploads cannot exhaust
VRAM. ``ThreadingHTTPServer`` keeps the worker responsive (health checks) while
one request is waiting on the model.

Run from the backend directory (NOT the project root: root ``backend.py``
would shadow the package):
    cd backend
    .venv-ai/Scripts/python.exe -m ai_worker.worker
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import logging
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Literal

from PIL import Image
from pydantic import BaseModel
from google import genai

logger = logging.getLogger("ai_worker")

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = PROJECT_ROOT / "backend"
DEFAULT_WEIGHTS = PROJECT_ROOT / "models" / "checkpoint_best_total.pth"

MAX_REQUEST_BYTES = 16 * 1024 * 1024  # base64 of the backend's 10 MB upload cap
GEMINI_MODEL = "gemini-2.5-flash"

# ── Existing Gemini contract, reused from the legacy implementation ──────────
# The prompt and schema are intentionally identical to backend.py so the
# Phase 3A behaviour does not change. Do not widen this schema with fields the
# model was not trained to produce (pattern / season / occasions).
class GarmentInfo(BaseModel):
    category: Literal["Top", "Bottom", "Outerwear", "Dress", "Accessory"]
    item_name: str
    primary_color: str
    style: Literal["casual", "formal", "sporty", "streetwear"]
    condition: Literal["good", "wrinkled", "stained", "damaged"]
    condition_note: str


ANALYZE_PROMPT = (
    "Analyze this segmented clothing item. Identify its category "
    "(Top = shirts, t-shirts, blouses, sweaters; Bottom = jeans, pants, trousers, shorts, skirts; "
    "Outerwear = jackets, coats, blazers, hoodies; Dress = dresses; Accessory = hats, bags, scarves). "
    "For item_name, use a clean 2-3 word boutique-style title combining color, cut/fabric, and garment "
    "(e.g., 'Ivory Knit Sweater', 'Black Tailored Top', 'Straight Blue Jeans'). "
    "Also identify primary_color, style, and visible condition (wrinkles, stains, or tears)."
)


class WorkerError(Exception):
    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


# ── Model state (singleton, one process) ─────────────────────────────────────
_MODEL = None
_MODEL_ERROR: str | None = None
_MODEL_LOCK = threading.Lock()
_GPU_LOCK = threading.Lock()


def _load_env_file(path: Path) -> None:
    """Minimal .env reader so GEMINI_API_KEY can live in backend/.env.

    Real process environment variables always win. Values are never logged.
    """
    if not path.is_file():
        return
    try:
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value
    except OSError:
        logger.warning("Could not read %s", path)


def _weights_path() -> Path:
    configured = os.getenv("SEGMENTATION_WEIGHTS_PATH", "").strip()
    if not configured:
        return DEFAULT_WEIGHTS
    path = Path(configured)
    return path if path.is_absolute() else PROJECT_ROOT / path


def checkpoint_available() -> bool:
    return _weights_path().is_file()


def load_model() -> None:
    """Load RF-DETR exactly once. Safe to call from startup and analysis."""
    global _MODEL, _MODEL_ERROR

    if _MODEL is not None or _MODEL_ERROR is not None:
        return

    with _MODEL_LOCK:
        if _MODEL is not None or _MODEL_ERROR is not None:
            return
        if not checkpoint_available():
            _MODEL_ERROR = f"Checkpoint not found at {_weights_path()}"
            logger.error(_MODEL_ERROR)
            return
        try:
            # Imported lazily so a broken Torch install only affects readiness,
            # not the health endpoint itself.
            from rfdetr import RFDETRSegSmall

            _MODEL = RFDETRSegSmall(
                pretrain_weights=str(_weights_path()),
                num_classes=18,
            )
            logger.info("RF-DETR loaded from %s", _weights_path())
        except Exception as exc:  # noqa: BLE001 - reported to the backend
            _MODEL_ERROR = f"{type(exc).__name__}: {exc}"
            logger.exception("RF-DETR could not be loaded")


def _segment(image: Image.Image, threshold: float) -> tuple[Image.Image, str | None, float]:
    """Run RF-DETR and return (RGBA cutout, detected label, confidence)."""
    if _MODEL is None:
        raise WorkerError(503, "model_unavailable", _MODEL_ERROR or "RF-DETR is not ready")

    try:
        import numpy as np

        rgb = image.convert("RGB")
        detections = _MODEL.predict(rgb, threshold=threshold)

        if len(detections) == 0 or detections.mask is None:
            raise WorkerError(422, "no_garment", "No garment was detected in this image")

        best = int(np.argmax(detections.confidence))
        mask = detections.mask[best]
        if mask is None:
            raise WorkerError(422, "no_garment", "No garment mask was produced")

        ys, xs = np.where(mask)
        if len(ys) == 0 or len(xs) == 0:
            raise WorkerError(422, "no_garment", "The detected garment mask is empty")

        pixels = np.array(rgb)
        rgba = np.dstack((pixels, (mask * 255).astype(np.uint8)))
        cutout = Image.fromarray(rgba[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1])

        label = None
        class_id = getattr(detections, "class_id", None)
        names = getattr(_MODEL, "class_names", None) or []
        if class_id is not None and len(class_id) > best:
            index = int(class_id[best])
            if 0 <= index < len(names):
                label = str(names[index])

        return cutout, label, float(detections.confidence[best])
    except WorkerError:
        raise
    except Exception as exc:  # noqa: BLE001 - surfaced as a failed analysis
        logger.exception("Segmentation failed")
        raise WorkerError(502, "segmentation_failed", f"Segmentation failed: {type(exc).__name__}") from exc


def _classify(cutout: Image.Image) -> dict[str, Any]:
    """Gemini classification using the existing prompt and Pydantic schema."""
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise WorkerError(
            503,
            "gemini_not_configured",
            "Garment classification is unavailable because GEMINI_API_KEY is not configured",
        )

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[cutout, ANALYZE_PROMPT],
            config={
                "response_mime_type": "application/json",
                "response_json_schema": GarmentInfo.model_json_schema(),
            },
        )
        info = GarmentInfo.model_validate_json(response.text)
        return info.model_dump()
    except Exception as exc:  # noqa: BLE001 - surfaced as a failed analysis
        logger.warning("Gemini classification failed (%s)", type(exc).__name__)
        raise WorkerError(502, "gemini_failed", "Garment classification failed") from exc


def analyze(image: Image.Image, threshold: float) -> dict[str, Any]:
    # The lock covers segmentation AND classification; the GPU only runs one
    # job at a time even if several requests arrive together.
    with _GPU_LOCK:
        load_model()
        cutout, label, confidence = _segment(image, threshold)
        analysis = _classify(cutout)

    buffer = io.BytesIO()
    cutout.save(buffer, format="PNG")
    return {
        "cutout_base64": base64.b64encode(buffer.getvalue()).decode("ascii"),
        "label": label,
        "confidence": round(confidence, 4),
        "analysis": analysis,
        "classification_source": "Online (Gemini)",
    }


def health_payload() -> dict[str, Any]:
    """Readiness without loading the model (startup already did that)."""
    import torch

    weights = _weights_path()
    return {
        "status": "ok" if _MODEL is not None else "degraded",
        "checkpoint_available": weights.is_file(),
        "checkpoint": weights.name,
        "model_loaded": _MODEL is not None,
        "model_error": _MODEL_ERROR,
        "rfdetr_ready": weights.is_file() and _MODEL is not None and _MODEL_ERROR is None,
        "cuda_available": bool(torch.cuda.is_available()),
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY", "").strip()),
    }


class WorkerHTTPServer(ThreadingHTTPServer):
    """Refuse a second listener on the same port.

    HTTPServer sets SO_REUSEADDR, which on Windows lets another process bind
    over an existing listener. That silently leaves an old worker (possibly
    started before backend/.env was updated) serving requests. On Windows we
    disable it so a failed restart is explicit; POSIX keeps reuse for quick
    restarts over TIME_WAIT sockets.
    """

    allow_reuse_address = os.name != "nt"


class Handler(BaseHTTPRequestHandler):
    server_version = "KAPDEEYYAI/1.0"

    def _authorized(self) -> bool:
        expected = os.getenv("AI_WORKER_TOKEN", "").strip()
        if not expected:
            return True
        return self.headers.get("X-AI-Worker-Token", "") == expected

    def _send(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _error(self, error: WorkerError) -> None:
        self._send(error.status, {"error": {"code": error.code, "message": error.message}})

    def do_GET(self) -> None:  # noqa: N802 - http.server API
        if self.path.split("?", 1)[0] != "/health":
            self._send(404, {"error": {"code": "not_found", "message": "Unknown endpoint"}})
            return
        if not self._authorized():
            self._send(401, {"error": {"code": "unauthorized", "message": "Invalid worker token"}})
            return
        self._send(200, health_payload())

    def do_POST(self) -> None:  # noqa: N802 - http.server API
        if self.path.split("?", 1)[0] != "/analyze":
            self._send(404, {"error": {"code": "not_found", "message": "Unknown endpoint"}})
            return
        if not self._authorized():
            self._send(401, {"error": {"code": "unauthorized", "message": "Invalid worker token"}})
            return

        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0:
            self._send(400, {"error": {"code": "invalid_request", "message": "Empty request body"}})
            return
        if length > MAX_REQUEST_BYTES:
            self._send(413, {"error": {"code": "image_too_large", "message": "Image is too large"}})
            return

        try:
            body = json.loads(self.rfile.read(length) or b"{}")
            raw = base64.b64decode(body.get("image_base64") or "", validate=True)
            threshold = float(body.get("threshold", 0.25))
        except (ValueError, TypeError, json.JSONDecodeError):
            self._send(400, {"error": {"code": "invalid_request", "message": "Malformed request"}})
            return

        if not raw:
            self._send(400, {"error": {"code": "invalid_image", "message": "No image supplied"}})
            return
        if not 0.0 < threshold <= 1.0:
            self._send(400, {"error": {"code": "invalid_request", "message": "Invalid threshold"}})
            return

        try:
            # verify() catches truncated/corrupt files before the model sees them.
            probe = Image.open(io.BytesIO(raw))
            probe.verify()
            image = Image.open(io.BytesIO(raw))
            image.load()
        except Exception:
            self._send(400, {"error": {"code": "invalid_image", "message": "Unsupported or corrupt image"}})
            return

        try:
            result = analyze(image, threshold)
        except WorkerError as exc:
            self._error(exc)
            return
        except Exception:  # noqa: BLE001 - never leak internals to the backend
            logger.exception("Unexpected analysis failure")
            self._send(500, {"error": {"code": "internal_error", "message": "Analysis failed"}})
            return

        self._send(200, result)

    def log_message(self, fmt: str, *args: Any) -> None:
        logger.info("%s - %s", self.address_string(), fmt % args)


def main() -> None:
    # Load backend/.env before reading AI_WORKER_HOST/PORT defaults so the same
    # file configures the worker and FastAPI. Values are never logged.
    _load_env_file(BACKEND_DIR / ".env")

    parser = argparse.ArgumentParser(description="KAPDEEYY local AI worker")
    parser.add_argument("--host", default=os.getenv("AI_WORKER_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.getenv("AI_WORKER_PORT", "8001")))
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    logger.info(
        "Configuration: gemini_configured=%s worker_token_required=%s",
        bool(os.getenv("GEMINI_API_KEY", "").strip()),
        bool(os.getenv("AI_WORKER_TOKEN", "").strip()),
    )

    # Bind first so a duplicate worker fails immediately instead of loading a
    # second copy of the model and then silently coexisting with the old one.
    try:
        server = WorkerHTTPServer((args.host, args.port), Handler)
    except OSError as exc:
        logger.error(
            "Could not bind %s:%s (%s). Another AI worker may already be running; "
            "stop it before starting a new one.",
            args.host,
            args.port,
            exc,
        )
        raise SystemExit(1) from exc
    server.daemon_threads = True

    # Load once at startup; /health must never trigger a model load.
    load_model()
    logger.info("AI worker listening on http://%s:%s", args.host, args.port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
