---
name: vite-env-sanity
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
