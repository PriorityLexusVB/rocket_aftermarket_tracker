AFTERMARKET TRACKER — WORKSPACE GUARDRAILS (Quick, Authoritative)

This file is the short, durable “do not deviate” summary.
For full detail, also follow:

- `.github/copilot-instructions.md` (primary, comprehensive)
- `AGENTS.md` (agent operating mode + GitOps safety)
- `.github/WORKFLOWS_AGENT_PREFLIGHT.md` (required preflight checklist)

Stack lock (DO NOT MODIFY)

- Vite 5 + React 18 + TailwindCSS.
- Supabase (PostgREST + RLS + pg_trgm) accessed via service/lib modules.
- Package manager is `pnpm` (version pinned in `package.json#packageManager`), Node 20 (see `.nvmrc`).

Data & access rules

- NEVER import Supabase client directly in React components for CRUD; use service/lib modules.
- All reads/writes must be tenant scoped (orgId/profile context) where applicable.
- If you hit: “Could not find a relationship …” after schema changes → run `NOTIFY pgrst, 'reload schema'` then retry; record evidence.

UI & state rules

- All inputs are controlled (`value` + `onChange`); do not reintroduce `defaultValue`.
- Keep debounced autosave ≈600ms unless explicitly requested to change.
- Keep dropdown caching TTL (5 minutes) and the prefetch pattern in `App.jsx`.
- Client env guardrail: browser code under `src/**` must never reference `process` / `process.env`.

Schema/migrations safety

- Do not edit historical migrations; only add new timestamped migrations.
- For schema/performance work: capture evidence (introspection + BEFORE/AFTER EXPLAIN) under `.artifacts/`.

Workflow safety

- Before multi-step work: run the preflight checklist in `.github/WORKFLOWS_AGENT_PREFLIGHT.md`.
- Keep changes PR-sized and minimal; avoid refactors unrelated to the task.
- Git: follow `AGENTS.md` (push/history rewrite requires explicit user approval).
