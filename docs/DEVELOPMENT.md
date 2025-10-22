# Development Setup

This app uses Vite + React and Supabase. To run locally, configure your environment once and the error "Missing VITE_SUPABASE_URL environment variable" will go away for good.

## 1) Environment variables (one-time)

Create a file named `.env.local` at the repo root (same level as `package.json`). Copy from `.env.example` and fill in your Supabase values:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=ey...YOUR-ANON-KEY
```

Notes:

- Do NOT commit `.env.local` (git-ignored). Never commit real keys.
- Only these two client-side vars are required.

### Windows PowerShell (temporary env for one session)

If you prefer to test without creating the file:

```powershell
$env:VITE_SUPABASE_URL = "https://YOUR-PROJECT.supabase.co"
$env:VITE_SUPABASE_ANON_KEY = "ey...YOUR-ANON-KEY"
```

## 2) Install and run

```powershell
pnpm install
pnpm run start   # http://localhost:5173
```

## 3) Build and Preview

```powershell
pnpm run build
pnpm run serve   # preview build output
```

## 4) E2E tests (optional)

- Without auth env, only the smoke test runs.
- With auth env, all tests run.

```powershell
# Optional env for auth flows
$env:PLAYWRIGHT_BASE_URL = "http://localhost:5173"
$env:E2E_EMAIL = "tester@example.com"
$env:E2E_PASSWORD = "your-password"

pnpm run e2e
```

## 5) Debug Auth page

In development, `/debug-auth` is available after signing in and shows session, org, and counts used to finalize RLS policies.

If you see permission errors in the console while navigating (e.g., vehicles/photos/calendar), copy them verbatim so we can propose minimal SQL policies.
