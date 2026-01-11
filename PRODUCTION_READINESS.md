# Production Readiness Checklist

This repo is a Vite + React + TailwindCSS app backed by Supabase (PostgREST + RLS).

The goal of this checklist is to provide a **repeatable, fail-fast, non-destructive** way to confirm we’re ready to ship.

## One-command gate

Run the automated checklist runner:

```bash
pnpm release:check
```

What it does:

- Refuses to run if `VITE_SUPABASE_URL` or any configured DB connection string (`E2E_DATABASE_URL`/`DATABASE_URL`/`SUPABASE_DB_URL`) contains the production Supabase project ref `ogjtmtndgiqqdtwatsue`.
- Runs: `pnpm lint` → `pnpm -s vitest run` → `pnpm typecheck` → `pnpm build`.
- Runs Playwright E2E only if `E2E_EMAIL`, `E2E_PASSWORD`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY` are present.

Note: the Supabase project ref is the subdomain in `https://<ref>.supabase.co`.

## Manual “meticulous” validation (recommended)

These are the checks that catch issues automation can miss.

1. **Staging rehearsal**

- Deploy to a staging Vercel environment pointing at a dedicated staging Supabase project.
- Confirm RLS is enabled and the app is not using service role keys client-side.

2. **RLS & schema health endpoints (local via Vite dev server)**

With `pnpm dev` running:

- `http://127.0.0.1:5173/api/health-loaner-assignments`

Expected: `{ ok: true }` or clear remediation guidance if RLS blocks reads.

3. **Critical user flows (smoke)**

- Auth: login + refresh + deep link.
- Deals: list → edit → reload → confirm persisted fields.
- Loaners: assign loaner → reload → verify loaner persists.

## Rollback plan

- Code rollback: revert the deploy (or revert the merge commit).
- Schema rollback: apply a new forward migration that undoes the change (never edit historical migrations).
