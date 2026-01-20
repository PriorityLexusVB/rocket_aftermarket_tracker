# Aftermarket Tracker — Master Execution Prompt (One-Paste)

**Last Updated**: November 11, 2025  
**Status**: Phases 1-3 COMPLETED and VERIFIED | Phases 4-10 READY FOR EXECUTION

---

## Overview

You are modifying Aftermarket Tracker under strict guardrails. This document serves as the authoritative guide for all development work on this project.

**Stack**: Vite 5 + React 18 + TailwindCSS; Supabase (PostgREST + RLS + pg_trgm); pnpm; Vitest for tests.

**Critical Rule**: Do not change the stack or remove dependencies listed under `rocketCritical`.

---

## Baseline Directives

1. **Follow ALL guardrails**:
   - `.github/copilot-instructions.md`
   - `.github/instructions/Aftermarket – Workspace Guardrails (DO NOT DEVIATE).instructions.md`

2. **Never import Supabase client directly from React components**:
   - Only use service/lib modules for database operations
   - Health pings (e.g., `testSupabaseConnection`) are acceptable in components

3. **Maintain tenant scoping**:
   - All queries must include orgId/profile context
   - Preserve RLS policies in all schema changes

4. **Schema cache reload protocol**:
   - If you hit "Could not find a relationship" after schema changes:
     1. Run `NOTIFY pgrst, 'reload schema'`
     2. Wait 5 seconds
     3. Retry the operation
     4. Document the evidence in PR

5. **Form and UI rules**:
   - All forms must be controlled (`value` + `onChange`)
   - Keep dropdown caching TTL at 5 minutes
   - Debounce autosave ~600ms
   - Don't add new global stores without approval

---

## Workspace Setup

### Package Manager & Node Version

- **Package Manager**: `pnpm` (required)
- **Node Version**: 20 (see `.nvmrc`)
- Enable via Corepack: `corepack enable`
- Dependencies: `pnpm install`

### Development Environment

- **VS Code**: Profile and curated extensions provided
- **Required Extensions**:
  - ESLint/Prettier (auto-formatting)
  - Tailwind IntelliSense (CSS autocomplete)
  - Playwright (optional, for e2e tests)
- **MCP Access**: Enable per `docs/MCP-NOTES.md`

### Development Commands

```bash
# Development server
pnpm dev

# Run tests
pnpm test

# Lint code
pnpm lint

# Type checking
pnpm typecheck

# Build for production
pnpm build
```

---

## Required Tools and When to Use Them

### Supabase MCP (Schema Introspection)

**When to use**: Before touching any schema-related code

**Available operations**:

- `list_tables` - Confirm table presence before building queries
- `list_policies` - Ensure tenant scoping in RLS
- `list_extensions` - Verify pg_trgm and other extensions
- `explain` - Capture query performance (BUFFERS, ANALYZE)

**Failure handling**:

- If MCP returns unknown field errors → ABORT and emit TODO
- Document all introspection results in `.artifacts/mcp-introspect/`

### GitHub Tools

**When to use**: Before refactoring existing code

**Available operations**:

- Search code usages before making changes
- Create small, focused PRs per phase
- Review related issues and PRs

### Local Health Endpoints

**Location**: `api/health-*.js`

**When to use**: Verifying capabilities and performance

**Process**:

1. Run health checks
2. Record outputs to `.artifacts/`
3. Include in PR documentation

### Testing Tools

- **Vitest**: Unit and integration tests (required)
- **Playwright**: End-to-end tests (optional)

---

## Artifacts Management

### Directory Structure

All evidence and introspection data goes in `.artifacts/`:

```
.artifacts/
├── mcp-introspect/           # Schema introspection results
│   ├── INTROSPECTION.md      # Summary of findings
│   ├── tables.json           # Table definitions
│   ├── policies.json         # RLS policies
│   └── extensions.json       # Installed extensions
├── explain/                  # Query performance analysis
│   └── <date>-<slug>.txt     # EXPLAIN (BUFFERS, ANALYZE) output
├── health-*.json             # Health check outputs
└── *.csv                     # Data exports (e.g., demo jobs)
```

### Performance Tuning Artifacts

For any query optimization work:

1. Capture **BEFORE** state: `EXPLAIN (BUFFERS, ANALYZE)`
2. Make changes (indexes, query rewrites, etc.)
3. Capture **AFTER** state: `EXPLAIN (BUFFERS, ANALYZE)`
4. Save both to `.artifacts/explain/<date>-<slug>.txt`
5. Document performance gain % in PR

---

## Do and Don't

### ✅ Allowed Actions

- Add structured logging wrappers (side-effect free when disabled)
- Non-invasive telemetry improvements (preserve existing keys)
- Optional materialized views (flagged as OPTIONAL, document refresh strategy)
- Doc-only health endpoint hints
- Covering indexes from `PERFORMANCE_INDEXES.md` (check for duplicates first)

### ❌ Forbidden Actions

- Breaking telemetry keys
- Changing public component props
- Altering existing migration files (create new timestamped ones instead)
- Removing critical dependencies (check `rocketCritical` in `package.json`)
- Dropping primary/foreign keys without explicit approval
- Retrospective migration history changes

---

## Execution Plan (Phased Approach)

### Phase 1: Permission Error Mapping ✅ COMPLETED

**Status**: IMPLEMENTED and VERIFIED

**Deliverables**:

- ✅ `mapPermissionError` function in `dealService.js`
- ✅ Friendly remediation for "permission denied for (table|relation) users"
- ✅ Documentation references to MCP-NOTES.md and INTROSPECTION.md
- ✅ Tests passing: `src/tests/unit/dealService.permissionMapping.test.js`

**Evidence**: `.artifacts/deal-perm-map/`

---

### Phase 2: Time Normalization ✅ COMPLETED

**Status**: IMPLEMENTED and VERIFIED

**Deliverables**:

- ✅ `normalizeDealTimes` function in `dealService.js`
- ✅ Converts empty strings to null for time fields:
  - `scheduled_start_time`
  - `scheduled_end_time`
  - `promised_date`
- ✅ Integrated into `mapDbDealToForm`
- ✅ Tests passing: `src/tests/unit/dealService.*`

**Evidence**: `.artifacts/time-normalize/`

---

### Phase 3: UI-Safe Date Display ✅ COMPLETED

**Status**: IMPLEMENTED and VERIFIED

**Deliverables**:

- ✅ `dateDisplay.js` utility module created
- ✅ `formatPromiseDate`: Protects against "Invalid Date", treats YYYY-MM-DD as local date
- ✅ `formatTimeWindow`: Returns "Not scheduled" unless both ends are valid
- ✅ Tests passing: `src/tests/ui/promiseDate.display.test.jsx`

**Functions**:

```javascript
// src/utils/dateDisplay.js
formatPromiseDate(promiseDate) → "MMM d, yyyy" or "No promise date"
formatTimeWindow(startTime, endTime) → "h:mm AM/PM - h:mm AM/PM" or "Not scheduled"
```

**Evidence**: `.artifacts/mcp-introspect/`

---

### Phase 4: Appointments Simplification 🔄 READY

**Goal**: Reduce incidental complexity in appointments rendering; preserve public props

**Actions**:

- Extract small pure helpers for calendar lane grouping and null-safety
- Replace ad-hoc checks with `formatTimeWindow`/`formatPromiseDate`
- Maintain stable component props (no breaking changes)

**Tests Required**:

- Unit: Calendar grouping with vendor vs onsite lanes
- UI: No "Invalid Date"; null-safe windows show "Not scheduled"

**Guardrails**:

- No new global store
- No schema changes
- Maximum 10 files touched

---

### Phase 5: Drawer Streamlining 🔄 READY

**Goal**: Reduce re-renders and prop drilling in drawers

**Actions**:

- Co-locate simple state with components
- Keep forms controlled (`value` + `onChange`)
- Memoize heavy child renders with stable keys

**Tests Required**:

- Interaction tests ensuring save/cancel behaviors unchanged

**Guardrails**:

- No prop API breaking changes
- Preserve existing telemetry keys

---

### Phase 6: Calendar UX Lane Clarity 🔄 READY

**Goal**: Clear visual separation for vendor vs onsite lanes; stable keys for events

**Actions**:

- Use deterministic color coding from `service_type`
- Create legend documentation
- Ensure event IDs are unique and non-null

**Tests Required**:

- Step 22 validations (already exist) remain green

**Artifacts**:

- Optional screenshots or JSON snapshots

---

### Phase 7: Performance Health Polish 🔄 READY

**Goal**: Ensure index coverage and query narrowings remain in place

**Actions**:

1. Validate `PERFORMANCE_INDEXES.md` indexes exist in database
2. Add only missing covering indexes (avoid duplicates)
3. EXPLAIN key search/list queries before/after any changes
4. Save results to `.artifacts/explain/<date>-<slug>.txt`

**Performance Targets**:

- Common list endpoints: < 50ms under test dataset size
- If gain < 5%, STOP and ask for guidance with data

**Guardrails**:

- No dropping/changing existing indexes
- Document all changes with BEFORE/AFTER evidence

---

### Phase 8: Prune Demo Jobs Script (Dry-Run Only) 🔄 READY

**Goal**: Safety-first utility to list candidates; no destructive default

**Actions**:

1. Create `scripts/pruneDemoJobs.js` with:
   - `--dry-run` as default mode
   - `--apply` requires confirmation prompt
   - Log counts and sample IDs
   - Write CSV to `.artifacts/`
2. Unit tests for candidate selection logic

**Guardrails**:

- No apply in CI
- Document rollback (no-op for dry-run)
- Never delete data without explicit confirmation

---

### Phase 9: Final Checks and Documentation 🔄 READY

**Goal**: Ensure project is deployment-ready

**Actions**:

1. Re-run `pnpm test` (all tests green)
2. Optional e2e smoke tests if configured
3. Run `pnpm lint` and `pnpm typecheck` (0 errors)
4. Update `docs/DEPLOY_CHECKLIST.md` with any changes
5. Summarize health endpoints and artifact paths

**Success Criteria**:

- All tests passing
- No lint errors
- No type errors
- Documentation up to date

---

### Phase 10: PR and Rollback Notes 🔄 READY

**Goal**: Create comprehensive PR with rollback strategy

**PR Checklist** (MUST include):

- [ ] Summary of change (1–2 sentences)
- [ ] Guardrails respected (explicit bullets referencing sections 2–5)
- [ ] Test results snippet (pass count)
- [ ] Lint status (0 errors required)
- [ ] Performance evidence (if applicable) with BEFORE/AFTER explains
- [ ] Rollback plan (how to revert code/migration)

**Merge Criteria**:

- All CI checks green
- At least one approval
- Documentation updated

---

## MCP Usage Patterns

### Standard Workflow

1. **Before schema-sensitive work**:

   ```
   list_tables → Confirm presence
   list_policies → Ensure tenant scoping
   list_extensions → Verify pg_trgm if needed
   ```

2. **If relationship queries fail**:

   ```sql
   NOTIFY pgrst, 'reload schema';
   -- Wait 5 seconds
   -- Retry query
   -- Document in PR
   ```

3. **For performance work**:
   ```
   explain → Capture BEFORE state
   [Make changes]
   explain → Capture AFTER state
   [Save to .artifacts/explain/]
   ```

### Failure Patterns & Remedies

| Symptom                             | Likely Cause                        | Remedy                                            |
| ----------------------------------- | ----------------------------------- | ------------------------------------------------- |
| 400/403 on REST relationship select | Stale schema cache                  | `NOTIFY pgrst, 'reload schema'`; wait and retry   |
| Missing FK expansion                | FK not created or named incorrectly | Verify constraint naming; re-run migration        |
| Slow COUNT(\*)                      | Missing WHERE + index               | Add selective index or approximate count strategy |
| "unknown field" from MCP            | Schema mismatch                     | STOP and emit TODO; do not guess                  |

---

## Validation & Green-Before-Done

### After Any Code Changes

1. **Run tests**:

   ```bash
   pnpm test
   ```

   - If failures: Fix up to 3 targeted attempts
   - If still failing: Summarize failure and options, ask for guidance

2. **For performance work**:
   - Collect EXPLAIN artifacts (BEFORE/AFTER)
   - If gain < 5%: STOP and ask for guidance with data

3. **Lint and typecheck**:

   ```bash
   pnpm lint
   pnpm typecheck
   ```

   - Fix only violations that you introduced
   - 0 errors required before PR

---

## Contracts to Observe

### Service Layer Contracts

- **Services are the only layer that talks to Supabase**
- React components use services; never import Supabase client directly
- All service functions must handle tenant scoping

### Date/Time Formatting Contracts

```javascript
formatPromiseDate(promiseDate) → "MMM d, yyyy" or "No promise date"
formatTimeWindow(start, end) → "h:mm AM/PM - h:mm AM/PM" or "Not scheduled"
```

### Error Handling Contracts

- Map known RLS errors to helpful actions (use `mapPermissionError`)
- Avoid swallowing stack traces
- Provide actionable hint strings
- Keep telemetry side-effect free when disabled

---

## Edge Cases to Guard

1. **Empty strings from DB for date/time fields**:
   - Convert to null in `normalizeDealTimes`
   - Render friendly strings in UI

2. **Missing relationships in Supabase schema cache**:
   - Reload schema and retry
   - Document evidence in PR

3. **Large queries**:
   - Select explicit columns (avoid SELECT \*)
   - Use LIMIT for list endpoints
   - Verify plan stability with EXPLAIN

4. **Multi-user RLS**:
   - Staff vs Manager access remains enforced
   - Keep existing tests green
   - Don't weaken security policies

---

## Current Verified Status

### Test Results

```
✅ Tests: PASS — 514 passed, 1 failed (unrelated), 2 skipped
✅ Total test suite: 517 tests
✅ Known non-blocking: capabilityTelemetry invalid JSON import (expected in tests)
```

### Artifacts Present

- ✅ `.artifacts/mcp-introspect/*` (tables, policies, extensions)
- ✅ Health JSONs for capabilities verification
- ✅ Performance artifacts from prior PRs
- ✅ Permission error mapping evidence
- ✅ Time normalization test results

### Phase Completion Status

| Phase                                | Status       | Evidence Location                           |
| ------------------------------------ | ------------ | ------------------------------------------- |
| Phase 1: Permission Error Mapping    | ✅ COMPLETED | `.artifacts/deal-perm-map/`                 |
| Phase 2: Time Normalization          | ✅ COMPLETED | `.artifacts/time-normalize/`                |
| Phase 3: UI-Safe Date Display        | ✅ COMPLETED | `src/tests/ui/promiseDate.display.test.jsx` |
| Phase 4: Appointments Simplification | 🔄 READY     | -                                           |
| Phase 5: Drawer Streamlining         | 🔄 READY     | -                                           |
| Phase 6: Calendar UX Lane Clarity    | 🔄 READY     | -                                           |
| Phase 7: Performance Health Polish   | 🔄 READY     | -                                           |
| Phase 8: Prune Demo Jobs Script      | 🔄 READY     | -                                           |
| Phase 9: Final Checks                | 🔄 READY     | -                                           |
| Phase 10: PR and Rollback            | 🔄 READY     | -                                           |

---

## If Ambiguity Arises

**Principle**: Prefer READ + PLAN over MODIFY

**Process**:

1. If you cannot perform a requested action safely → STOP
2. Output a TODO with clear rationale
3. Provide options for user to choose from
4. Wait for explicit approval before proceeding

**Examples of when to STOP**:

- Unknown field errors from MCP
- Performance gain is insufficient (< 5%)
- Required dependency must be changed
- Schema migration requires approval
- Breaking change to public API

---

## Reference Documentation

### Primary Documents

- **Workspace Guardrails**: `.github/instructions/Aftermarket – Workspace Guardrails (DO NOT DEVIATE).instructions.md`
- **Performance Plan**: `PERFORMANCE_INDEXES.md`
- **MCP Usage**: `docs/MCP-NOTES.md`
- **Error Handling**: `ERROR_HANDLING_GUIDE.md`
- **Deploy Checklist**: `docs/DEPLOY_CHECKLIST.md`

### Implementation Details

- **Telemetry Logic**: `src/utils/capabilityTelemetry.js`
- **Health Endpoints**: `api/health-*` & `src/api/health/*`
- **Date Display**: `src/utils/dateDisplay.js`
- **Deal Mappers**: `src/utils/dealMappers.js`
- **Schema Error Classifier**: `src/utils/schemaErrorClassifier.js`

### Test Coverage

- **Permission Mapping**: `src/tests/unit/dealService.permissionMapping.test.js`
- **Relationship Errors**: `src/tests/dealService.relationshipError.test.js`
- **Date Display**: `src/tests/ui/promiseDate.display.test.jsx`
- **Form Adapters**: `src/tests/dealService.formAdapters.test.js`

---

## Summary

This master execution prompt serves as the authoritative guide for all development work on the Aftermarket Tracker project. Phases 1-3 are completed and verified. Phases 4-10 are ready for execution following the guidelines and guardrails documented above.

**Key Principles**:

1. ✅ Minimal changes only
2. ✅ Preserve existing functionality
3. ✅ Document all evidence in `.artifacts/`
4. ✅ Test early and often
5. ✅ Stop and ask if uncertain

**Next Steps**: Proceed with Phase 4 (Appointments Simplification) or request guidance on priorities.

---

**Document Version**: 1.0  
**Last Verified**: November 11, 2025  
**Maintained By**: Development Team
