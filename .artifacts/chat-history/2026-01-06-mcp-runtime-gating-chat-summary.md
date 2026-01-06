# Chat Summary — MCP + Runtime Gating + Single Source of Truth

Date: 2026-01-06
Repo: PriorityLexusVB/rocket_aftermarket_tracker
Branch at time of work: main

## Why this exists

Copilot chat scrollback is fragile across machines. This file captures the **decisions, evidence, and file-level changes** from the session so you can resume later predominantly from repo state.

This is **not a verbatim transcript**; it is a high-signal summary.

---

## Goals

1. Get deterministic PASS/FAIL proof that MCP servers are usable (Chrome DevTools, Supabase, GitHub, Playwright).
2. Fix local runtime issues ("nothing loads on localhost") and then diagnose post-login failures using evidence-first network/console.
3. Avoid pushing migrations immediately; instead make the app tolerate missing optional tables without repeated 404/PGRST205 spam.
4. Ensure repo instructions / prompts / MCP setup are maintained as a **single source of truth** (reduce drift).

---

## Key decisions

- **Chose Path (2): do NOT push migrations yet.**
  - Implement **client-side capability gating** for optional tables (`sms_templates`, `notification_outbox`).
  - Behavior: first missing-table signature disables that feature for the remainder of the browser tab session.

---

## Runtime / DB mismatch findings

- Post-login failures were dominated by PostgREST missing table errors:
  - `PGRST205` / message like: "Could not find the table 'public.<table>' in the schema cache".
  - Tables implicated: `sms_templates`, `notification_outbox`.
- Separate mismatch noted earlier in the session:
  - Frontend referenced `jobs.next_promised_iso`, but DB/migrations appeared to use `promised_date` (schema alignment deferred).

---

## What was implemented (behavior)

### Optional-table capability gating (session-scoped)

- Capability flags live in `sessionStorage` (per tab) and are mirrored in an in-memory export.
- Keys:
  - `cap_smsTemplatesTable`
  - `cap_notificationOutboxTable`
- When disabled:
  - queries short-circuit to `[]`
  - dependent UI is hidden/soft-disabled
  - repeated failing calls stop

### Realtime subscription safety

- Avoid subscribing to realtime changes for `notification_outbox` unless the table is verified to exist for the session.
  - Prevents “realtime spam” in missing-table environments.

---

## “Single source of truth” wiring (to prevent drift)

Authoritative sources:

- MCP servers (repo): `.vscode/mcp.json`
- Copilot/agent prompt+instruction wiring: `.vscode/settings.json`
- Agent workflow policies: `AGENTS.md`
- Guardrails: `.github/copilot-instructions.md` and `.github/instructions/Aftermarket – Workspace Guardrails (DO NOT DEVIATE).instructions.md`
- MCP operational notes: `docs/MCP-NOTES.md`
- Deterministic MCP verification prompts:
  - `.github/prompts/mcp-healthcheck.prompt.md`
  - `.github/prompts/mcp-setup-verifier.prompt.md`

Non-authoritative / informational:

- `mcp-servers-config.json` (kept informational; should not contradict `.vscode/mcp.json`).

---

## Files touched (high-value)

### Runtime gating

- `src/utils/capabilityTelemetry.js`
- `src/lib/supabase/safeSelect.js`
- `src/services/notificationService.js`
- `src/services/adminService.js`
- `src/services/tenantService.js`
- `src/services/smsTemplateService.js`
- `src/services/advancedFeaturesService.js`
- `src/pages/admin/index.jsx`
- `src/pages/administrative-configuration-center/components/SmsTemplateManager.jsx`

### Tests

- `src/tests/unit/optionalTables.capabilityGating.test.jsx`
  - Covers “disable once + no repeated calls” for **both** `sms_templates` and `notification_outbox`.

### Docs / setup

- `README.md` (documents optional-table capability gating lifecycle + reset)
- `.vscode/settings.json` (prompt discovery + serverSampling key alignment)
- `.github/prompts/mcp-healthcheck.prompt.md`
- `.github/prompts/mcp-setup-verifier.prompt.md`

---

## Verification commands and observed outcomes

- Unit tests:
  - `pnpm -s vitest run` (stable) — passed in-session after changes.
- Typecheck:
  - `pnpm typecheck` — passed.
- Lint:
  - `pnpm lint` — ran with no errors shown in output.

---

## How to reset capability gating (manual)

If you’re on a project where `sms_templates` / `notification_outbox` tables don’t exist and you want to re-test the “first error disables” flow:

- Delete the session storage keys:
  - `cap_smsTemplatesTable`
  - `cap_notificationOutboxTable`
- Or run in browser console:
  - `sessionStorage.clear()`
- Refresh.

---

## Deterministic proof steps to re-run when you’re back

1. Start dev server (if not already): `pnpm dev`
2. In a fresh tab/session:
   - Confirm at most one failing request per missing optional table, then no repeats.
3. Run MCP healthcheck prompt:
   - `.github/prompts/mcp-healthcheck.prompt.md`

---

## Open items / future follow-ups (if desired)

- Decide whether to apply migrations to bring missing tables into the connected Supabase project.
- Resolve the `jobs.next_promised_iso` vs `promised_date` mismatch (schema alignment) as a dedicated, migration-reviewed change.
