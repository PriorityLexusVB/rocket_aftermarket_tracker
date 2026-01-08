---
name: vite-env-sanity
agent: agent
description: Fix Vite client env usage: remove process/process.env/globalThis.process from src/** and verify with pnpm guard:client-env + pnpm test.
---

Goal: eliminate `process`/`process.env` usage from browser/client code in a Vite app (`src/**`) without breaking behavior.

Rules:

- Only touch files under `src/**` unless explicitly required.
- Preserve env key names (e.g., `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- Prefer Vite env in client code: `import.meta.env.VITE_*`, `import.meta.env.MODE`, `import.meta.env.DEV`.

Steps:

1. Search `src/**` for `process.env`, `globalThis.process`, or `process`.
2. Replace client usages with `import.meta.env` equivalents (no Node polyfills).
3. Verify:
   - `pnpm -s guard:client-env`
   - `pnpm -s vitest run`
4. Output files changed + verification results.
