---
name: vite-env-sanity
agent: 'agent'
description: Fix Vite client env usage: remove process.env/globalThis.process from src/** and verify with pnpm guard:client-env + pnpm test.
tools:
  - 'github/github-mcp-server/*'
---

Goal: eliminate `process`/`process.env` usage from browser/client code in a Vite app (src/\*\*) without breaking behavior.

Rules:

- Only touch files under `src/**` unless explicitly required.
- Preserve env key names (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
- Prefer import.meta.env in client code.

Steps:

1. Search src/\*\* for `process.env`, `globalThis.process`, or `process`.
2. Replace client usages with:
   - import.meta.env.VITE\_\* for VITE vars
   - import.meta.env.MODE or import.meta.env.DEV for env-mode logic
3. Run:
   - pnpm -s guard:client-env (if present)
   - pnpm test
4. Output files changed + minimal diffs + verification results.
