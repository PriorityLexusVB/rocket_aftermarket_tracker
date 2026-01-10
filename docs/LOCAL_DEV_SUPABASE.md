# Local Dev: Supabase Configuration

This app expects Supabase env vars at runtime. When they’re missing (common in fresh clones), the dev server falls back to an in-memory stub client so the UI can still load — but data-driven pages (Deals, Calendar, Appointments, etc.) will appear empty.

## Quick setup

1. Create `.env.local` by copying `.env.local.example`.
2. Set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

Get these from your Supabase project settings (API section).

3. Restart the dev server.

## Verify

- Visit `/debug-auth` (DEV-only route) and confirm:
  - `configured: true`
  - connection check passes

## Common pitfalls

- If you change `.env.local`, you must restart Vite.
- If PostgREST relationship errors occur (schema cache), follow: `docs/TROUBLESHOOTING_SCHEMA_CACHE.md`.
