# Closet Remix — Project Progress (handoff document)

## Current phase
Phase 3C (frontend AI integration) — COMPLETE in code and covered by build/backend regression checks. The Add Clothing flow can save, analyze, review/edit AI suggestions, PATCH them, and display the cutout. Live end-to-end verification still needs a real Supabase project and a `GEMINI_API_KEY`.

## Completed phases
- Phase 0: inspection and planning (decisions below)
- Phase 1: frontend foundation with isolated mock data
- Phase 2: SQL schema + RLS + storage, Supabase auth in frontend, FastAPI JWT verification + profile API
- Phase 3: RF-DETR worker + Gemini classification (3B), then authenticated frontend analyze/review flow (3C)

## Decisions (from user)
- Categories = Roboflow classes: Tops, Bottoms, Dresses, Outerwear, Shoes, Bags, Other. Finer names (Shirt, Skirt, Jeans) are `subcategory`.
- Everything runs locally on the user's Windows laptop.
- Claude writes the Supabase SQL; user runs it.
- Surprise Me is a button. Auth = email + password only.

## Completed features (Phase 1, all on mock data)
- Design system (Tailwind tokens: ivory/ink/rose/sage, Fraunces + DM Sans), shared UI (buttons, chips, cards, modal, toast, skeletons, empty/error states)
- Responsive layout: fixed sidebar (desktop), top bar + drawer (tablet/mobile)
- Today, Wardrobe (filters, search, detail, edit, delete, add-clothing picker with local validation/preview), Outfit Studio (4 occasions, Surprise me, Remix, Save / Not for me / Mark as worn), Saved, History (14-day strip, repeat badges), Insights (computed from mock history; empty state when < 3 wears)

## Project structure
frontend/src/{components,components/ui,pages,layouts,hooks,services,mocks,utils}
backend/, database/, docs/, models/ — scaffolded, empty except docs/models README.

## Mock isolation (replace in Phase 2+)
- `src/mocks/` (data.js, mockApi.js) — DELETE when real API is wired.
- `src/services/api.js` is the only module pages import data from; it currently re-exports mockApi. Swap each export for an Axios call via `services/http.js` (same names/shapes).
- `services/http.js` already has the Axios instance and a token-provider hook for the Supabase JWT.

## Frontend data contracts (mock shapes the real API must match)
- WardrobeItem: id, item_name, category, subcategory, colour, colour_hex(derive/optional), pattern, style, suggested_occasions[], season, image_url, times_worn
- Outfit: id, outfit_name, occasion, recommendation_score, styling_explanation, items[WardrobeItem]
- generate/remix/surprise → { mode, occasion, outfits[Outfit] }
- Saved → Outfit + saved_at, worn, last_worn_at
- History entry → { id, worn_at, occasion, outfit, recently_worn, repeated, repeat_count }
- Insights → { sufficient_data, categories_most/least, colours, favourite_items, underused_items, top_combinations, repeat_stats, untried }
Planned REST endpoints: see section 8 of the master instructions (unchanged so far).

## Database changes (Phase 2)
database/migrations/001_init.sql (tables, constraints, indexes, triggers), 002_rls.sql (RLS + grants), 003_storage.sql (3 private buckets + per-user folder policies). `database/schema.sql` = all three concatenated (paste into Supabase SQL Editor).
Tables: profiles, wardrobe_items, outfits (+combo_key), outfit_items, saved_outfits, outfit_feedback, outfit_wear_history. See docs/architecture.md for design decisions.

## Important configuration
See `.env.example`, `frontend/.env.example`, `backend/.env.example`, and docs/SUPABASE_SETUP.md. Frontend with no Supabase vars = demo mode (mock data, no login).

## Phase 2 additions
- Frontend: `services/supabase.js`, `context/AuthContext.jsx`, `components/ProtectedRoute.jsx`, `pages/AuthPages.jsx` (Login, Register), sign-out in sidebar, Today greets by auth name. Axios sends the JWT (token provider).
- Backend: `app/main.py`, `core/{config,auth,http}.py`, `database/supabase_rest.py` (PostgREST as the user), `api/{health,profile}.py`, `schemas/profile.py`, tests in `backend/tests/`.
- API contracts: docs/api.md

## Tests performed (Phase 2)
- SQL: 30 checks on a local PostgreSQL 16 with a Supabase shim (`database/tests/00_supabase_shim.sql`, `rls_test.sql`): 30/30 pass — cross-user read/insert/update/delete blocked on all tables and storage paths, anon blocked, CHECK constraints, duplicate save / same-day wear / not-for-me / combination blocked, signup trigger, item-delete cascade. Shim = emulation, not real Supabase.
- Backend: `pytest` 11/11 pass (fake Supabase). Real uvicorn + curl against a stand-in Supabase: 401 without/with bad token, profile read/update, CORS preflight OK.
- Frontend (headless Chromium, stand-in Supabase): redirect to /login, wrong-password message, register → Today with name, session persists on reload, sign out, protected route, login works; demo mode regression passes.
- NOT tested: real Supabase project, email-confirmation flow, token refresh over a long session, two real browsers.

## Tests performed (Phase 1)
- `npm run build` passes.
- Headless Chromium (desktop 1440 / mobile 390): all 6 routes render, no JS errors.
- Interaction checks passed: Save, Not for me, Remix, Surprise me, category filter, search + empty state, delete item.
- NOT tested: real devices, tablet width, keyboard-only flow.

## Known issues / pending
- Fraunces/DM Sans load from Google Fonts (needs internet); fallback fonts otherwise.
- Wardrobe images are generated silhouettes (mock only); real photos replace them in Phase 3.
- Mock "worn" counts and scores are demo values; the real engine is Phase 4.
- Colour swatches need a `colour_hex`; the AI does not currently suggest a hex value, so existing/user values are preserved.
- AI review updates only name, category, subcategory, colour and style; pattern, season and occasions are intentionally left alone.

## Open items needing the user
- Colab notebook was private: need `.ipynb` or link set to "Anyone with link", plus weights file, rfdetr version, class mapping.
- Verify `ollama list` shows `qwen3-vl:4b`.
- User has NOT created the Supabase project yet: follow docs/SUPABASE_SETUP.md, then run the app with real auth.

## Phase 3B additions
- `backend/ai_worker/` — local Python 3.13 worker (RF-DETR singleton + GPU lock, Gemini prompt/schema, `/health`, `/analyze`); run `cd backend && .venv-ai/Scripts/python.exe -m ai_worker.worker`.
- FastAPI: `POST /api/wardrobe/{id}/analyze` (ownership check, JWT storage download, cutout upload, cleanup on DB failure, suggestions only) and real `GET /api/ai/status`.
- Mapping: 18 RF-DETR labels → valid `category`/`subcategory`, Gemini `primary_color` → `colour`, Gemini style → valid frontend style. No `pattern`/`season`/`suggested_occasions` invention; `condition` is suggestion-only (no migration).
- Tests: 48 backend tests pass (18 new Phase 3B cases). Frontend build passes. Phase 3B itself made no frontend/UI changes.

## Phase 3C additions
- `AddClothingModal` keeps normal manual save and adds **Save & analyze**: it creates the item through the existing upload/create flow, then calls `POST /api/wardrobe/{id}/analyze`.
- Staged progress covers saving and analysis. Analysis failures leave the saved item and its metadata intact, with **Try AI again** and **Keep my details** actions.
- On success, a review panel shows the cutout plus editable name, category, subcategory, colour and style. Only **Save suggestions** sends a PATCH, and only for those five fields.
- `Wardrobe` merges the analyze response into local state immediately (signed cutout URL + `segmentation_status`), so the refreshed grid shows the cutout without a full reload.
- Friendly handling for missing Gemini configuration, no garment detected, worker unavailable/network failure, timeouts, missing photos and generic analysis failures. Manual entry remains available in demo mode and when AI fails.
- No API keys or worker tokens are referenced in frontend code; the browser only calls the authenticated FastAPI endpoints.
- Frontend build passes (pre-existing chunk-size warning only). Backend tests: 48 passed.

## Next steps
- Run against a real Supabase project and add `GEMINI_API_KEY` to `backend/.env`; then manually verify upload → analyze → review → PATCH → refreshed cutout against live services.
- Note: deletion also removes outfits (and their history) containing the item — the ItemDetailModal copy still says otherwise.
