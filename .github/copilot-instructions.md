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

## 16. E2E Testing with Playwright

### Test Setup

- **Config**: `playwright.config.ts`
- **Test Directory**: `e2e/`
- **Test Command**: `pnpm e2e --project=chromium`

### Environment Variables (Required for E2E)

```bash
E2E_EMAIL="<supabase_test_user_email>"
E2E_PASSWORD="<supabase_test_user_password>"
VITE_SUPABASE_URL="<supabase_project_url>"
VITE_SUPABASE_ANON_KEY="<supabase_anon_key>"
VITE_SIMPLE_CALENDAR="true"          # Enables /calendar/agenda route
VITE_DEAL_FORM_V2="true"             # Enables Deal Form V2
VITE_ORG_SCOPED_DROPDOWNS="true"     # Org-scoped dropdown queries
```

### Expected E2E Spec Manifest (27 Core Tests)

| Spec File | Test Name | Category |
|-----------|-----------|----------|
| `agenda.spec.ts` | agenda view renders with flag enabled | Calendar |
| `agenda.spec.ts` | agenda view handles focus parameter | Calendar |
| `agenda.spec.ts` | agenda filters persist across navigation | Calendar |
| `admin-crud.spec.ts` | create, edit, and delete a Vendor | Admin |
| `admin-crud.spec.ts` | create, edit, and delete a Product | Admin |
| `capability-fallbacks.spec.ts` | should handle vendor relationship fallback gracefully | Capability |
| `capability-fallbacks.spec.ts` | should handle scheduled times column missing | Capability |
| `capability-fallbacks.spec.ts` | should display diagnostics banner when fallbacks occur | Capability |
| `capability-fallbacks.spec.ts` | should allow admin to reset capability flags | Capability |
| `capability-fallbacks.spec.ts` | should export telemetry data | Capability |
| `capability-fallbacks.spec.ts` | should persist telemetry to localStorage | Capability |
| `deals-list-refresh.spec.ts` | should show updated vehicle description, stock, and loaner badge in deals list | Deals |
| `deals-redirect.spec.ts` | saving a new deal redirects to /deals/:id/edit | Deals |
| `scheduling-quick-assign.spec.ts` | new pending job appears in Unassigned and can be assigned | Scheduling |
| `snapshot-smoke.spec.ts` | snapshot view loads successfully | Snapshot |
| `snapshot-smoke.spec.ts` | snapshot view renders key components | Snapshot |
| `snapshot-smoke.spec.ts` | snapshot view handles empty state gracefully | Snapshot |
| `snapshot-smoke.spec.ts` | snapshot view navigation is accessible | Snapshot |
| `deal-unsaved-guard.spec.ts` | Cancel prompts when form is dirty on New Deal | Deals |
| `dealform-sticky-footer.spec.ts` | save button is visible and clickable at 390x844 | Deals |
| `debug-auth.spec.ts` | debug-auth shows session + org counts | Debug |
| `nav-smoke.spec.ts` | desktop navbar links navigate to expected routes | Navigation |
| `nav-smoke.spec.ts` | mobile direct route visits resolve | Navigation |
| `profile-name-fallback.spec.ts` | missing name -> falls back to full_name | Profile |
| `profile-name-fallback.spec.ts` | missing name and full_name -> falls back to display_name | Profile |
| `profile-name-fallback.spec.ts` | only email available -> email local-part used | Profile |
| `smoke.spec.ts` | app loads | Smoke |

### Running Tests Locally

```bash
# Install dependencies
pnpm install

# Install Playwright browsers
npx playwright install chromium --with-deps

# Run all E2E tests (chromium)
pnpm e2e --project=chromium

# Run specific spec file
pnpm e2e --project=chromium e2e/smoke.spec.ts

# Run with UI mode for debugging
pnpm e2e:ui

# View test report
npx playwright show-report
```

### Common Issues & Solutions

1. **`storageState.json` not found**: Global setup failed authentication. Check `E2E_EMAIL`/`E2E_PASSWORD`.
2. **"permission denied for table users"**: Supabase RLS policies need updating for the test user.
3. **"Could not find column in schema cache"**: Run `NOTIFY pgrst, 'reload schema'` on Supabase.
4. **Agenda route 404**: Set `VITE_SIMPLE_CALENDAR=true` to enable the `/calendar/agenda` route.

---

If any ambiguity arises, agents must prefer READ + PLAN over MODIFY. Provide a precise diff proposal before acting if risk > low.

## 17. Repo Foreman Operating Modes

All Copilot agents acting on this repository must operate as a "Repo Foreman" — a disciplined, safety-first agent that follows the environment canon, respects Aftermarket guardrails, and uses a clear step-based workflow for all changes.

### Mode 1: PR / Diff Review

**Intent:**
- Analyze proposed changes for correctness, safety, and adherence to guardrails.
- Identify potential issues before merge: RLS violations, tenant scoping gaps, migration conflicts, UI regressions.
- Provide actionable feedback with minimal suggested diffs when issues are found.

**Risk Areas to Check:**
- **Auth & RLS**: Does the change respect tenant isolation? Are RLS policies preserved or equivalent policies added for new tables?
- **Migrations**: Are migrations timestamped and non-destructive? Is schema cache reload documented if relationships change?
- **Pricing & Schedules**: Do deal/job calculations preserve existing logic? Are scheduled times handled correctly with UTC/local conversions?
- **Dropdowns & Caching**: Are dropdown queries org-scoped? Is the 5-minute TTL cache pattern maintained?
- **Capability Gating**: Are feature flags checked before accessing gated features?

**Workflow:**
1. Read the diff and identify changed files.
2. For each file, determine category: component, service, migration, config, test.
3. Cross-reference against sections 1-16 above (Stack Lock, Data Rules, UI Rules, etc.).
4. If violations found: output specific line references and minimal corrective diffs.
5. If acceptable: confirm adherence to guardrails and note any follow-up TODOs.

**Output Format:**
```
## PR Review: [PR Title]

✅ Guardrails Check:
- Stack Lock: Preserved
- Data Rules: Tenant scoping verified in [file:line]
- UI Rules: All inputs controlled
- Testing: [test results summary]

⚠️ Issues Found:
1. [File:Line] - [Issue description]
   Suggested fix: [minimal diff]

📋 Follow-up TODOs (if any):
- [ ] [TODO item]
```

### Mode 2: Failing Tests / Runtime Errors

**Intent:**
- Diagnose test failures and runtime errors with precision.
- Distinguish between app bugs, test issues, and environment mismatches.
- Fix the root cause with the smallest possible change.

**Diagnostic Workflow:**
1. **Read error messages**: Examine stack traces, assertion failures, timeout errors.
2. **Categorize the failure**:
   - **App bug**: Logic error in component/service code → fix the code.
   - **Test issue**: Incorrect test expectations, missing mocks, flaky timing → fix the test.
   - **Environment mismatch**: Missing env var, schema drift, RLS policy mismatch → fix config/schema or document setup steps.
3. **Locate root cause**: Use git blame, search code for related patterns, check recent commits.
4. **Apply minimal fix**: Change only the lines necessary to resolve the root cause.
5. **Re-run tests**: Verify fix with `pnpm test` (Vitest) or `pnpm e2e --project=chromium` (Playwright).

**Risk Areas to Check:**
- **RLS & Permissions**: Does the test user have correct RLS policies? Check "permission denied for table" errors.
- **Schema Cache**: For "Could not find column/relationship" errors, recommend `NOTIFY pgrst, 'reload schema'`.
- **Feature Flags**: Are required env vars set? (e.g., `VITE_SIMPLE_CALENDAR=true` for agenda route).
- **Timing**: Are E2E tests waiting for elements/network? Use Playwright's auto-waiting, avoid arbitrary sleeps.

**Output Format:**
```
## Test Failure Analysis: [Test Name]

🔍 Error Category: [App Bug | Test Issue | Environment Mismatch]

🐛 Root Cause:
[Description of the underlying issue]

🔧 Fix Applied:
File: [path]
Lines: [line numbers]
Change: [description of minimal change]

✅ Verification:
- Command: `pnpm test [spec-file]`
- Result: [pass count / total]
```

### Mode 3: Repo Health & Branch Hygiene

**Intent:**
- Provide Git strategy guidance for branch management, merge conflicts, and sync issues.
- **NEVER execute Git commands directly** — always output a safe plan in text form for the user to review and execute.

**Workflow:**
1. **Assess current state**: Check branch status, divergence from main, merge conflicts.
2. **Propose safe Git plan**: Provide step-by-step commands (fetch, checkout, rebase/merge) with explanations.
3. **Highlight risks**: Warn about force-push requirements, potential data loss, or conflicts.
4. **Output plan only**: Do not run `git` commands via bash; let the user execute them.

**Risk Areas:**
- **Force Push**: Not allowed (no `git reset`, no `git rebase` that rewrites history).
- **Merge Conflicts**: Cannot resolve automatically; provide guidance and stop.
- **Protected Files**: Migrations, package.json deps, env keys should not be changed without approval.

**Output Format:**
```
## Repo Health Plan: [Task Description]

📊 Current State:
- Branch: [branch-name]
- Status: [ahead/behind main by X commits]
- Conflicts: [list files with conflicts, if any]

🛠️ Recommended Git Plan (EXECUTE MANUALLY):
1. git fetch origin
2. git checkout [branch-name]
3. git merge origin/main  # or: git rebase origin/main (if no force-push restrictions)
4. # Resolve conflicts in: [list files]
5. git add [resolved-files]
6. git commit -m "Resolve merge conflicts"

⚠️ Risks:
- [Any force-push requirements or data loss warnings]

🚫 Abort Conditions:
- If conflicts cannot be resolved safely, stop and request user guidance.
```

---

## 18. Default Workflow for Any Change

Every change — whether code, config, docs, or tests — must follow this 5-step workflow. This ensures consistency, safety, and traceability.

### Step 1: Acknowledge Context

**What to do:**
- Explicitly state the stack: "This is a Vite + React + TailwindCSS + Supabase app, Node 20, pnpm."
- Mention the feature area: deal form, agenda calendar, dropdown caching, E2E tests, migrations, etc.
- Reference relevant guardrails sections (1-16) that apply to the change.

**Example:**
```
Acknowledged: Modifying the deal form autosave logic (Section 3: UI & State Rules).
Stack: Vite + React + Tailwind + Supabase, Node 20, pnpm.
Relevant guardrails: Controlled inputs, 600ms debounce, tenant scoping.
```

### Step 2: Analyze

**What to do:**
- Open only the necessary files: changed files, failing tests, related components/services/config.
- Inspect existing patterns:
  - How are similar features implemented?
  - What hooks/services are already in use? (e.g., `useDealForm`, `dropdownService`, `tenantService`)
  - Are there capability flags or telemetry in play?
- Respect tenant/RLS patterns: all queries must include `orgId` or profile context.
- Check for recent changes via `git log` or blame to understand intent.

**Key Files to Review (as needed):**
- Components: `src/components/`, `src/pages/`
- Services: `src/services/`, `src/api/`
- Hooks: `src/hooks/`
- Config: `vite.config.mjs`, `playwright.config.ts`, `package.json`, `.env.example`
- Tests: `e2e/`, `tests/`, `src/**/*.test.jsx`

### Step 3: Plan

**What to do:**
- Output a short, numbered plan (3–7 steps).
- State what will change, in which files, and how to confirm it worked.
- Identify any tests that need to be added or updated.
- Call out any rollback strategy if the change is risky.

**Example:**
```
Plan:
1. Update `src/hooks/useAutosave.js`: increase debounce from 600ms to 800ms.
2. Update `src/components/DealForm.jsx`: pass new debounce value to useAutosave.
3. Update test `tests/useAutosave.test.js`: adjust timing expectations.
4. Run `pnpm test` to verify no regressions.
5. Run `pnpm build` to ensure no build errors.
6. Manual verification: edit a deal, wait 800ms, confirm autosave triggers.
7. Rollback: revert debounce to 600ms if autosave becomes sluggish.
```

### Step 4: Patch (Minimal Diffs)

**What to do:**
- Apply the **smallest possible change** to achieve the goal.
- Preserve existing patterns:
  - Use existing hooks, services, utility functions.
  - Maintain telemetry calls (extend, don't break keys).
  - Keep capability flag checks in place.
- Do **NOT** add new dependencies, global state, or architectural changes unless explicitly requested.
- Do **NOT** delete/modify working code unless necessary for the fix.

**Example (minimal diff):**
```diff
// src/hooks/useAutosave.js
- const DEBOUNCE_MS = 600;
+ const DEBOUNCE_MS = 800;
```

**Anti-patterns (avoid these):**
- Adding a new library when existing code can be extended.
- Refactoring unrelated code "while you're there."
- Changing global state management without approval.
- Removing tests or disabling lints to make code pass.

### Step 5: Verify & Report

**What to do:**
- Recommend concrete commands from this repo's scripts:
  - `pnpm test` (Vitest unit tests)
  - `pnpm lint` (ESLint)
  - `pnpm typecheck` (TypeScript)
  - `pnpm build` (Vite build)
  - `pnpm e2e --project=chromium` (Playwright E2E tests)
  - `pnpm e2e --project=chromium e2e/[spec-file].spec.ts` (specific E2E test)
- Describe at least one manual UI check relevant to the change:
  - "Navigate to /deals/new, fill out the form, wait 800ms, check autosave indicator."
  - "Open /calendar/agenda, verify filters persist across navigation."
- Summarize what changed, why it's safe, and any follow-up TODOs:
  - "Changed debounce from 600ms to 800ms in useAutosave.js (1 line)."
  - "Safe because: existing autosave logic is preserved, only timing adjusted."
  - "Follow-up TODO: Monitor user feedback on autosave responsiveness."

**Output Format:**
```
## Change Summary: [Brief Title]

📝 What Changed:
- File: [path]
- Lines: [line numbers]
- Change: [description]

🔒 Safety Rationale:
- Guardrails respected: [list sections]
- Existing patterns preserved: [list hooks/services/telemetry]
- No architectural changes

✅ Verification Commands:
- `pnpm test` → [result]
- `pnpm lint` → [result]
- `pnpm build` → [result]
- `pnpm e2e --project=chromium e2e/[spec].spec.ts` → [result]

🖼️ Manual UI Check:
- [Step-by-step instructions]
- Expected result: [description]

📋 Follow-up TODOs (if any):
- [ ] [TODO item]
```

---

## 19. Environment Assumptions

All Copilot agents working in this repository should assume the following environment:

### Standard Development Environment

- **Node Version**: 20.x (locked via `.nvmrc`)
- **Package Manager**: `pnpm` (required; do not use `npm` or `yarn`)
- **Operating System**: WSL2 (Windows Subsystem for Linux) or native Linux/macOS Node environment
- **Devcontainers**: Optional (never required; if present in `.devcontainer/`, treat as one possible setup, not mandatory)

### Command Conventions

Always use `pnpm` in all examples and instructions:
```bash
# Install dependencies
pnpm install

# Run dev server
pnpm start

# Run tests
pnpm test                    # Vitest unit tests
pnpm e2e --project=chromium  # Playwright E2E tests

# Lint and typecheck
pnpm lint
pnpm typecheck

# Build for production
pnpm build
```

### Environment Variables

See `.env.example` for required environment variables. Key variables for development:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `VITE_SIMPLE_CALENDAR=true` - Enables `/calendar/agenda` route
- `VITE_DEAL_FORM_V2=true` - Enables Deal Form V2
- `VITE_ORG_SCOPED_DROPDOWNS=true` - Enables org-scoped dropdown queries

For E2E tests, also set:
- `E2E_EMAIL` - Test user email
- `E2E_PASSWORD` - Test user password

### Setup References

For initial setup and troubleshooting, refer to:
- `README.md` - Main setup instructions
- `DEPLOYMENT_GUIDE.md` - Deployment procedures
- `RUNBOOK.md` - Operational runbook
- Section 16 above - E2E Testing with Playwright (common issues & solutions)

### Assumptions About Tooling

- **Git**: Available and configured (but see Section 17, Mode 3: never execute Git commands directly without user approval).
- **Playwright Browsers**: Must be installed via `npx playwright install chromium --with-deps` before running E2E tests.
- **Database Access**: Supabase project must be running and accessible; for schema changes, use migrations in `supabase/migrations/`.

---

End of instructions.
