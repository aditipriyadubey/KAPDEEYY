# Deploying KAPDEEYY

The app ships as two pieces:

| Piece | What it is | Production requirement |
| --- | --- | --- |
| `backend/` | FastAPI + SQLite + local image storage | A host that can run the Docker image **with a mounted persistent volume** |
| `frontend/` | Vite/React static build | Any static host with SPA fallback |

SQLite and the uploaded images must never sit on an ephemeral filesystem.
`backend/Dockerfile` therefore defaults `SQLITE_PATH` and `UPLOADS_PATH` to
`/data`, and `/data` must be a mounted volume (Render disk, Railway volume, Fly
volume, or any managed VM disk).

> For multi-instance or multi-user scale, switch the existing adapters to the
> Supabase/Postgres path (`DATABASE_BACKEND=supabase`, `AUTH_BACKEND=supabase`)
> and object storage. The current local architecture is deliberately
> single-instance and PostgreSQL-migration-friendly rather than multi-writer.

## 1. Backend

### Environment variables (server only — never in the frontend)

| Variable | Required | Example |
| --- | --- | --- |
| `DATABASE_BACKEND` | yes | `sqlite` |
| `AUTH_BACKEND` | yes | `local` |
| `SQLITE_PATH` | yes | `/data/kapdeeyy.db` |
| `UPLOADS_PATH` | yes | `/data/uploads` |
| `JWT_SECRET` | yes | long random string (32+ bytes) |
| `CORS_ORIGINS` | yes | `https://your-frontend.example` |
| `AI_WORKER_URL` | for segmentation | `http://ai-worker:8001` |
| `AI_WORKER_TOKEN` | for segmentation | shared random string |
| `SEGMENTATION_WEIGHTS_PATH` | for segmentation | `/models/checkpoint_best_total.pth` |
| `GEMINI_API_KEY` | optional | only used by the AI worker |

`JWT_SECRET` must be set explicitly in production. If it is empty the app
generates one in `backend/.local/jwt_secret`, which does not survive a container
rebuild and would sign out every user.

### Build and run

From `backend/`:

```bash
docker build -t kapdeeyy-backend .

docker run -d --name kapdeeyy \
  -p 8000:8000 \
  -v kapdeeyy-data:/data \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e CORS_ORIGINS="https://your-frontend.example" \
  -e AI_WORKER_URL="http://host.docker.internal:8001" \
  -e AI_WORKER_TOKEN="change-me" \
  kapdeeyy-backend
```

Then, on the host:

```bash
curl https://your-backend.example/api/health
# {"status":"ok",...}
```

The health endpoint does not touch the database. After the first authenticated
request the schema is created/migrated automatically and is recorded in the
`schema_migrations` table.

### AI worker (optional but needed for real segmentation)

The worker needs the RF-DETR/Torch environment (`backend/.venv-ai`) and the
checkpoint at `models/checkpoint_best_total.pth`. It is a separate process:

```bash
cd backend && .venv-ai/Scripts/python.exe -m ai_worker.worker   # Windows
cd backend && .venv-ai/bin/python -m ai_worker.worker           # POSIX
```

It binds `127.0.0.1:8001` by default; set `AI_WORKER_HOST=0.0.0.0` when it has
to be reachable from another container, and keep `AI_WORKER_TOKEN` set.

If the worker is unavailable the upload and save flow still works; garments are
stored with `segmentation_status = failed` and the UI reports it honestly.

## 2. Frontend

`VITE_API_URL` is baked in at build time, so build with the public API origin:

```bash
cd frontend
VITE_API_URL="https://your-backend.example/api" npm ci
npm run build        # -> frontend/dist
```

Deploy `frontend/dist` to any static host. `frontend/public/_redirects` provides
the SPA fallback (`/* /index.html 200`) for Netlify and Cloudflare Pages. On
Vercel, add the equivalent rewrite in the dashboard.

After deploying, set the backend's `CORS_ORIGINS` to the frontend origin (comma
separate multiple origins). `localhost` and `127.0.0.1` are treated as the same
origin automatically for local development.

## 3. Migrating existing local data

Run this from `backend/` while the local app is running:

```bash
python scripts/backup_data.py
```

It writes `data/backups/<timestamp>/kapdeeyy.db` using SQLite's online backup
API (so recent `-wal` writes are included), copies `uploads/`, and records row
counts plus an integrity check in `manifest.json`.

To move that data into the deployed volume:

1. Stop the deployed backend.
2. Copy `kapdeeyy.db` to the volume path in `SQLITE_PATH`.
3. Copy the backup's `uploads/` folder to the path in `UPLOADS_PATH`.
4. Start the backend and check `GET /api/health`, then sign in.

Restoring over an existing deployment replaces the database for **every** user,
so keep the backup directory until verification passes.

## 4. Verification checklist

- `GET /api/health` returns `{"status":"ok"}`.
- `GET /api/ai/status` (authenticated) reports `worker_available: true` and
  `rfdetr_ready: true` when the worker is running.
- Register → upload a garment → the cutout appears in Wardrobe after a refresh.
- Studio returns looks built only from that account's garments.
- Camera prompt appears on Virtual Try-On, and denying it shows the fallback.
- Sign in as a second account: the wardrobe is empty (no cross-user data).
