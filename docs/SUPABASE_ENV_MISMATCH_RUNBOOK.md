# Supabase Environment Mismatch Runbook (Avoiding “It exists here but not there”)

Last updated: 2026-01-20

This repo uses **Vite + React** on the client and a **Supabase MCP wrapper** for safe DB introspection.

The #1 footgun is accidentally pointing the **app** at one Supabase project while the **MCP tools** point at another.
That creates confusing symptoms like:

- Scheduling/debug pages show items, but DB queries don’t find them.
- “No deals” in the UI even though you expect data.
- IDs in logs/debug output that don’t exist in the project you’re querying.

## Two different env files are in play

- `.env.local` (Vite dev default)
  - Used by `pnpm dev` / Vite when running the app locally.
  - **This is the most common source of mismatches.**

- `.env.e2e.local` (Supabase MCP wrapper default)
  - Used by `bash scripts/mcp/supabase-mcp.sh --check` and any Supabase MCP operations.

If these point at different Supabase projects, the UI and MCP evidence will disagree.

## Quick diagnosis

1. Open `/debug-auth` in the app.
2. Look at the **Supabase environment** section:
   - `VITE_SUPABASE_URL`
   - inferred **project ref**

If it warns about a known production ref, you’re pointed at prod.

## Fix: align local dev to the non-prod project

Recommended: copy the non-prod values from `.env.e2e.local` into `.env.local`.

Keys:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Then restart the dev server:

- `pnpm dev`

## Proof step

After restarting:

1. Re-open `/debug-auth`.
2. Confirm the **project ref** matches the non-prod project.
3. Click **Probe Deals** and verify it returns the expected count.

## At-home checklist (quick start)

When you get home and want to continue without losing time:

1. Pull latest code

- `git pull origin main`

1. Ensure local dev is not pointed at prod

- Check `.env.local` (do **not** commit it).
- Make sure these are set to your **non-prod** project:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Easiest: copy the non-prod URL + anon key from `.env.e2e.local` into `.env.local`.

1. Run the repo verification

- `pnpm -s verify`

1. Start the app

- `pnpm dev`

1. Confirm you’re on the intended Supabase project

- Open `/debug-auth` and check the **Supabase environment** section.
- If it shows a known production ref warning, stop and fix `.env.local` first.

1. Re-test the original symptom

- On `/debug-auth`, click **Probe Deals**.
- Then check `/deals` and confirm the expected item appears.

## Optional: enable Supabase MCP tools at home

Only needed if you want to run MCP-based DB checks locally.

- Put `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` in `.env.e2e.local`.
- Run: `bash scripts/mcp/supabase-mcp.sh --check`

## Why this repo is extra strict

The Supabase MCP wrapper hard-blocks a known production project ref to prevent accidental DDL / schema introspection against prod.
The app, however, will still run if you point it at prod — so we added:

- a debug banner that shows the current `VITE_SUPABASE_URL`
- a dev-time console warning if the URL matches the known prod ref

## Notes

- Do **not** commit `.env.local` or `.env.e2e.local`.
- The debug page intentionally never prints keys/tokens.
