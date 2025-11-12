# Copilot Instructions — Aftermarket Tracker (Vite + React + Tailwind + Supabase)

Authoritative workspace guardrails for any automated coding agent (Copilot Chat, MCP agents, scripted refactors). These rules sit alongside `./.github/instructions/Aftermarket – Workspace Guardrails (DO NOT DEVIATE).instructions.md` and MUST be honored. If an agent cannot comply, it must stop and emit a TODO instead of making unsafe changes.

## 1. Stack Lock (DO NOT MODIFY)

Frontend: Vite 5 + React 18 + TailwindCSS.
Backend: Supabase (PostgREST + RLS + pg_trgm) accessed via service modules.
Testing: Vitest (unit), optional Playwright (e2e), no Jest config changes.
Package manager: `pnpm` (version pinned in `package.json` + `.nvmrc` Node 20). No dependency removals of critical packages noted under `rocketCritical` key.

## 2. Data & Access Rules

- NEVER import Supabase client directly in React components for CRUD; only in service / lib modules.
- All queries must include tenant scoping (orgId / profile context) where applicable.
- Relationship errors like: `Could not find a relationship` → run `NOTIFY pgrst, 'reload schema'` then retry (document evidence in PR).
- RLS: preserve existing policies; when adding new tables ensure equivalent tenant isolation.

## 3. UI & State Rules

- All form inputs controlled (`value` + `onChange`), no `defaultValue` reintroductions.
- Debounced autosave: keep current delay (≈600ms) unless explicitly requested to change.
- Maintain dropdown caching TTL (5 minutes) and prefetch pattern in `App.jsx`.
- Do not introduce new global stores without explicit approval.

## 4. Reliability / Observability Enhancements (Agent Allowed)

Agents may implement tasks that:

1. Improve telemetry (extend capability telemetry summary WITHOUT breaking existing keys).
2. Add structured logging wrappers (must remain side-effect free when disabled).
3. Augment health endpoints with non-invasive hints (no breaking schema).
4. Provide CSV export metadata lines (already present) — ensure backward compatibility.

Forbidden: Removing existing telemetry keys, changing public component props, or altering migration history retrospectively.

## 5. Performance / Schema Tasks

Allowed (with evidence artifacts in `.artifacts/`):

- Adding covering indexes defined in `PERFORMANCE_INDEXES.md` if missing.
- Enabling `pg_trgm` extension (verify already installed before migration duplication).
- Creating optional materialized views (MV) only if flagged as OPTIONAL; must include refresh strategy docs.
- Running `EXPLAIN (BUFFERS, ANALYZE)` BEFORE and AFTER for any tuned query; store results under `.artifacts/explain/<date>-<slug>.txt`.

Disallowed: Dropping existing primary/foreign keys, renaming columns outside a dedicated migration PR, mass data rewrites without explicit request.

## 6. Migration Safety Workflow

1. Read current migrations (`supabase/migrations`).
2. If drift or need for new migration: propose plan in a comment (no code) → wait for approval.
3. On approval: generate single migration file with clear, reversible DDL.
4. NEVER edit historical migration files; create a new timestamped one.
5. Provide verification SQL + expected results in PR body.

## 7. MCP Usage Pattern

Supabase MCP: schema introspection (list tables, list policies, list extensions) BEFORE code changes.
GitHub MCP: search code usages before refactors.
If any MCP action returns an unknown field error: abort modification & emit TODO.

## 8. Error Handling Guardrails

Use existing error classifier; do not introduce broad `catch (e) {}` blocks swallowing specifics.
Surface actionable hints (e.g., “Retry after schema reload”) rather than raw stack traces.

## 9. Testing Expectations

- Add or update minimal tests for every public behavior change (happy path + at least one edge case).
- Keep test file naming consistent; do not migrate to Jest.
- If adding performance assertions: gate behind an environment flag so they don’t break CI with variable timing.

## 10. Prompt Template (Embed in Agent Runs)

```
You are modifying Aftermarket Tracker under strict guardrails.
Constraints: No stack changes; no dependency removals; follow tenant scoping; do not touch migration history except via new timestamped migration.
If you cannot perform a requested action safely, STOP and output a TODO with rationale.
Always: (1) Inspect schema via MCP; (2) Plan minimal diff; (3) Implement; (4) Run lint + tests; (5) Produce artifacts for performance changes.
```

## 11. PR Checklist (Agents MUST Include)

- [ ] Summary of change (1–2 sentences).
- [ ] Guardrails respected (explicit bullets referencing sections 2–5).
- [ ] Test results snippet (pass count).
- [ ] Lint status (0 errors required).
- [ ] Performance evidence (if applicable) with BEFORE/AFTER explain files.
- [ ] Rollback plan (how to revert migration / code diff).

## 12. Fallback / Abort Conditions

Abort and emit TODO when:

- Relationship expansion still fails post cache reload.
- Required index already exists but differs materially (needs manual review).
- Performance gain < 5% after attempt (provide data then request guidance).

## 13. Non-Goals

No UI redesigns; no state management rewrites; no switching test runners; no adding analytics vendors.

## 14. Reference Files

- **Master Execution Prompt**: `MASTER_EXECUTION_PROMPT.md` (comprehensive phased execution plan)
- Workspace Guardrails: `.github/instructions/Aftermarket – Workspace Guardrails (DO NOT DEVIATE).instructions.md`
- Performance Plan: `PERFORMANCE_INDEXES.md`
- Telemetry Logic: `src/utils/capabilityTelemetry.js`
- Health Endpoints: `api/health-*` & `src/api/health/*`
- MCP Notes: `docs/MCP-NOTES.md`

## 15. Phased Execution (See MASTER_EXECUTION_PROMPT.md)

**Phases 1-3 COMPLETED** (Permission mapping, Time normalization, Date display)
**Phases 4-10 READY** (Appointments, Drawers, Calendar, Performance, Scripts, Docs, PR)

For detailed phase descriptions, implementation status, and execution guidelines, refer to `MASTER_EXECUTION_PROMPT.md`.

---

If any ambiguity arises, agents must prefer READ + PLAN over MODIFY. Provide a precise diff proposal before acting if risk > low.

End of instructions.
