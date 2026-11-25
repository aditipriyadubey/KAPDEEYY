# Architecture (as built through Phase 3C)

Browser (React) ──REST + Bearer JWT──▶ FastAPI ──▶ Supabase (Auth verify, PostgREST as the user, Storage)
                                          └──▶ local AI worker (loopback HTTP)
                                                 ├─ RF-DETR segmentation (Python 3.13 env)
                                                 └─ Gemini classification

- Login/registration happen in the browser with Supabase Auth (anon key). The browser gets a JWT.
- Every API call sends `Authorization: Bearer <jwt>`. FastAPI verifies it via Supabase `GET /auth/v1/user` and uses ONLY that identity.
- FastAPI talks to Postgres through PostgREST **with the user's JWT**, so Row Level Security enforces ownership even if app code is wrong.
- No service-role key is used yet; when needed (Phase 3 cleanup) it stays in the backend only.
- Demo mode: if the frontend has no Supabase env vars it runs with mock data and no login.

## AI runtime (Phase 3B)
- FastAPI runs on Python 3.14; RF-DETR/Torch run in `backend/.venv-ai` (Python 3.13), so the two
  communicate over authenticated loopback HTTP instead of importing AI code into FastAPI.
- The worker loads `models/checkpoint_best_total.pth` once at startup and keeps it as a singleton.
  `ThreadingHTTPServer` handles health probes while a single GPU lock serialises inference, so
  simultaneous uploads cannot exhaust VRAM. `/health` never loads the model.
- FastAPI downloads the original with the user's JWT, sends it to the worker, uploads the returned
  transparent PNG to `wardrobe-segmented`, and only then updates `segmented_image_path` and
  `segmentation_status`. AI values are returned as suggestions, never written over user metadata.
- Gemini uses the Phase 3A prompt and Pydantic schema. `GEMINI_API_KEY` lives in the worker env /
  `backend/.env` and never reaches FastAPI responses or the browser.
- Invalid/corrupt images and unknown garment labels are handled; failures set
  `segmentation_status='failed'` and leave the original and metadata intact. Uploaded cutouts are
  removed if the database update fails. No service-role key and no new SQL migrations are used.

## Frontend AI flow (Phase 3C)
- Add Clothing first uploads the original and creates the item through the existing Phase 2
  endpoints. **Save & analyze** then calls the authenticated analyze endpoint for that item.
- The modal shows separate saving and analysis stages. After creation, any AI failure keeps the
  item and its metadata; the user can retry analysis or close and edit manually.
- Successful analysis returns a signed cutout URL and suggestions. The review panel edits only
  name, category, subcategory, colour and style; **Save suggestions** is the only action that
  PATCHes them. Missing AI values fall back to the user's saved values instead of clearing them.
- `Wardrobe` merges the analyze response into local state, so the grid displays the cutout
  immediately. No keys or worker tokens are present in the browser bundle.

## Data model decisions
- `outfits` holds one row per unique combination per user (`combo_key` = sorted item ids). Not-For-Me, saved and worn all reference the combination.
- saved / feedback / history use a composite FK `(outfit_id, user_id)` so rows can only point at the same user's outfits.
- `outfit_wear_history` has `unique (user_id, outfit_id, worn_on)` — double clicks cannot create duplicates.
- Deleting a wardrobe item deletes the outfits containing it (trigger) and, by cascade, their saved/feedback/history rows.
