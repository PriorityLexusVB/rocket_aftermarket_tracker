---
name: vite-env-sanity
<<<<<<< HEAD
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
=======
agent: agent
description: Sanity-check Vite env usage (prevent `process is not defined` in the browser).
argument-hint: tabHint=<url-or-title>
tools:
  - github/github-mcp-server/*
  - chrome-devtools/*
---

Goal: Prevent browser crashes caused by Node globals (`process`) leaking into Vite client bundles.

Rules:
- In any code path that can execute in the browser (typically under `src/**`), do NOT reference `process` or `process.env`.
- Use Vite env:
  - `import.meta.env.VITE_*`
  - `import.meta.env.DEV` / `import.meta.env.MODE`
- Node-only code may use `globalThis.process?.env`.

Steps:
1) Code scan (GitHub search)
   - Search `path:src "process.env"`.
   - Search `path:src "typeof process"` to confirm any fallback is guarded.

2) If any unguarded client-path `process` usage exists:
   - Replace with `import.meta.env` (preferred) OR
   - Gate Node-only access behind `typeof process !== 'undefined'` or `globalThis.process?.env`.

3) Runtime evidence (if chrome-devtools is available and you can reproduce)
   - list_pages → select app tab
   - take_screenshot
   - list_console_messages (look for `process is not defined`)

Return:
- Findings (file list)
- Smallest fix (exact minimal diffs)
- Proof step (how to retest)
>>>>>>> origin/main
