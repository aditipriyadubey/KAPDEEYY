# Closet Remix
AI-powered wardrobe manager. React + Vite + Tailwind frontend, FastAPI backend, Supabase, RF-DETR + Qwen3-VL.

## Quick start
- **Demo mode (no setup):** `cd frontend && npm install && npm run dev` → http://localhost:5173 (mock data, no login).
- **Real auth:** follow `docs/SUPABASE_SETUP.md`, then also run the backend: `cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000`.
- **Backend tests:** `cd backend && python -m pytest`.

Docs: `docs/PROJECT_PROGRESS.md` (handoff), `docs/architecture.md`, `docs/api.md`.
