# Local AI worker (Phase 3B)

The backend API runs on Python 3.14, but RF-DETR / Torch live in the separate
Python 3.13 environment `backend/.venv-ai`. This worker bridges the two over
loopback HTTP; FastAPI never imports the legacy root `backend.py`.

- RF-DETR is loaded once at startup and reused (singleton).
- One GPU lock serialises inference, so concurrent uploads queue instead of
  exhausting VRAM.
- Gemini classification reuses the existing prompt and `GarmentInfo` schema.
- The Gemini key is read from the worker environment / `backend/.env` and is
  never returned by any endpoint.

## Install (already provisioned in this checkout)

```bash
cd backend
.venv-ai/Scripts/python.exe -m pip install -r ai_worker/requirements.txt
```

`google-genai` is required for classification. The checkpoint stays at
`models/checkpoint_best_total.pth` (git-ignored); do not download a new one.

## Configure

Add to `backend/.env` (never commit it):

```bash
GEMINI_API_KEY=...
AI_WORKER_TOKEN=...            # optional shared secret
AI_WORKER_HOST=127.0.0.1       # keep loopback unless you know why
AI_WORKER_PORT=8001
SEGMENTATION_WEIGHTS_PATH=models/checkpoint_best_total.pth
```

The FastAPI backend reads `AI_WORKER_URL`, `AI_WORKER_TOKEN` and
`AI_WORKER_TIMEOUT_SECONDS` from the same file.

## Run

From `backend/` (do **not** run `-m backend.ai_worker.worker` from the project
root; the root `backend.py` shadows the package):

```bash
cd backend
.venv-ai/Scripts/python.exe -m ai_worker.worker
```

Only one worker can hold the port. A second worker now exits with a clear bind
error instead of silently sharing 8001 with an older process. Stop the existing
worker before starting a new one.

Then start FastAPI in another terminal:

```bash
cd backend
../.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

## HTTP contract

`GET /health` (no model load) returns:

```json
{
  "status": "ok",
  "checkpoint_available": true,
  "model_loaded": true,
  "model_error": null,
  "rfdetr_ready": true,
  "cuda_available": false,
  "gemini_configured": true
}
```

`POST /analyze` with `{"image_base64": "...", "threshold": 0.25}` returns the
transparent PNG cutout, detection label/confidence and Gemini garment metadata.
Errors use `{"error": {"code": "...", "message": "..."}}` with codes such as
`no_garment`, `segmentation_failed`, `gemini_failed`,
`gemini_not_configured`, `model_unavailable`.

If `AI_WORKER_TOKEN` is set, both endpoints require
`X-AI-Worker-Token: <token>`.
