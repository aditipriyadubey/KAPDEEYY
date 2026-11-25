# Supabase setup (about 10 minutes, free tier is enough)

1. Go to https://supabase.com → sign in → **New project**. Pick a name (e.g. `closet-remix`), set a database password (save it), choose the region nearest you. Wait ~2 min for it to finish.
2. **Run the SQL.** Left menu → **SQL Editor** → **New query**. Paste the whole contents of `database/schema.sql` → **Run**. You should see "Success. No rows returned".
   (It is migrations 001 + 002 + 003 in one file. Run it once on a fresh project.)
3. **Auth settings.** Authentication → **Providers** → Email is on by default. For an easy demo, go to Authentication → **Sign In / Providers** (or "Settings") and turn **off "Confirm email"**. If you leave it on, new users must click an emailed link before signing in (the app handles both).
4. **Get the keys.** Project Settings → **API** (or "API Keys"):
   - Project URL → `https://xxxx.supabase.co`
   - `anon` / publishable key → safe for the browser.
   - `service_role` / secret key → **never** put in the frontend or Git. Not needed until Phase 3.
5. **Create the env files** (they are git-ignored):
   - `frontend/.env`
     ```
     VITE_API_URL=http://localhost:8000/api
     VITE_SUPABASE_URL=https://xxxx.supabase.co
     VITE_SUPABASE_ANON_KEY=<anon key>
     ```
   - `backend/.env`
     ```
     SUPABASE_URL=https://xxxx.supabase.co
     SUPABASE_ANON_KEY=<anon key>
     CORS_ORIGINS=http://localhost:5173
     ```
6. Run (two terminals):
   ```
   cd backend
   python -m venv .venv && .venv\Scripts\activate      # Windows
   pip install -r requirements.txt
   uvicorn app.main:app --reload --port 8000

   cd frontend
   npm install
   npm run dev
   ```
7. Open http://localhost:5173 → Create account → you should land on Today with your name. In Supabase → Table Editor → `profiles`, your row should exist.
8. Check the API: http://localhost:8000/api/health → `{"status":"ok","supabase_configured":true}`; interactive docs at http://localhost:8000/docs.

## Verify privacy yourself (two-user test)
Register two accounts in two different browsers/profiles. Each should see only its own name, and (from Phase 3 on) only its own wardrobe. The SQL-level isolation tests are in `database/tests/` (see PROJECT_PROGRESS.md).
