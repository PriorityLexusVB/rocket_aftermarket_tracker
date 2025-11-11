## Aftermarket Tracker — Final Master Agent Prompt (Phases 1–3 Verified, 4–10 Ready)

### At-a-glance status
- Documentation-only changes applied (no runtime behavior changes)
- Tests: PASS — 515 passed, 2 skipped
- Lint: 0 errors
- Build: Successful
- Phases 1–3: Implemented and verified in codebase
- Rollback: revert commit or delete added documentation/artifact files

### Context & Stack lock
- Stack: Vite 5, React 18, TailwindCSS, Supabase (PostgREST + RLS + pg_trgm), pnpm, Vitest (Playwright optional)
- Do NOT change the stack, remove dependencies under `rocketCritical`, or modify historical migrations

### Guardrails (authoritative)
- Follow: `/.github/copilot-instructions.md` and `/.github/instructions/Aftermarket – Workspace Guardrails (DO NOT DEVIATE).instructions.md`
- Supabase client: only in service/lib modules (never in React components)
- Maintain tenant scoping (org/profile) in all queries
- Forms: controlled inputs only; keep dropdown caching TTL at 5 minutes; autosave debounce ≈600ms
- RLS: preserve policies; new tables must mirror tenant isolation
- Relationship errors: if you see “Could not find a relationship…”, run `NOTIFY pgrst, 'reload schema'`, wait 5 seconds, retry; document evidence

### Abort conditions (STOP and emit a TODO)
- Unknown MCP field or schema introspection error
- Relationship still failing after cache reload
- Performance improvement < 5% (must show BEFORE/AFTER data)
- Index differs materially from planned covering index
- Any request that would bypass guardrails

### Tools, MCP, and extensions to use
- Supabase MCP
  - Use before any schema-sensitive change: list tables, list policies, list extensions
- GitHub tools
  - Search code usages before refactors; branch per phase; small PRs
- Local health endpoints
  - `api/health-*.js` for capabilities/performance checks; save outputs to `.artifacts`
- Testing
  - `pnpm test` (Vitest), optional `pnpm e2e` (Playwright)
- Recommended VS Code extensions
  - ESLint, Prettier, Tailwind CSS IntelliSense, Playwright Test (optional), GitHub Pull Requests and Issues, GitHub Copilot/Copilot Chat

### Artifacts (authoritative evidence paths)
- `.artifacts/mcp-introspect/` — schema/policies/extensions + health JSONs
- `.artifacts/deal-perm-map/` — permission mapping evidence
- `.artifacts/time-normalize/` — time/date normalization evidence
- `.artifacts/explain/` — EXPLAIN BEFORE/AFTER for tuned queries
- Future: `.artifacts/appointments/`, `.artifacts/drawers/`, `.artifacts/calendar/`, `.artifacts/prune-demo/` for phases 4–8

### Verification status (current baseline)
- Tests: PASS — 515 passed, 2 skipped
- Build: PASS
- Lint: PASS (0 errors)
- Phase 1: `mapPermissionError` in `src/services/dealService.js`
- Phase 2: `normalizeDealTimes` integrated in service mapping
- Phase 3: `formatPromiseDate` / `formatTimeWindow` in `src/utils/dateDisplay.js`, fixed off-by-one via date-fns parse/format
- No runtime impact from docs consolidation; zero risk

### PR checklist (must include every PR)
- [ ] Summary (1–2 sentences)
- [ ] Guardrails respected (reference sections 2–5 in copilot instructions)
- [ ] Test results snippet (pass count)
- [ ] Lint status (0 errors)
- [ ] Performance evidence (if applicable) with BEFORE/AFTER EXPLAIN
- [ ] Rollback plan (revert commit or delete new docs; migrations revert via new migration only)
- [ ] Artifacts list (paths added/updated)
- [ ] STOP conditions: evaluated and none triggered (or TODO committed)

### Rollback strategy
- Code-only: `git revert <commit>`
- Docs-only: remove added markdown/artifact files
- Schema changes (when approved): new migration to reverse prior DDL (never edit historical migrations)
- Index: drop newly added index only if safe; document rationale

### Remaining phases (4–10) — ready for execution

#### Phase 4: Appointments simplification
- Goal: Reduce complexity; unify lane grouping
- Do:
  - Extract pure helpers (`groupVendorJobs`, `groupOnsiteJobs`)
  - Replace ad-hoc null checks with `formatTimeWindow`
  - Add unit tests for grouping; ensure calendar tests stay green
- Artifact: `.artifacts/appointments/verification.md`

#### Phase 5: Drawer streamlining
- Goal: Minimize prop drilling and re-renders
- Do:
  - Identify heavy children; memoize with stable keys
  - Localize trivial open/close state per drawer
  - Preserve controlled form behavior
- Tests: Interaction tests validating save/cancel unchanged
- Artifact: `.artifacts/drawers/profile-render-stats.json`

#### Phase 6: Calendar UX lane clarity
- Goal: Visual separation for vendor vs onsite without model changes
- Do:
  - Deterministic color mapping by `service_type` + small legend component
  - Ensure event ID uniqueness (reuse current generator)
- Tests: Extend Step 22 to assert color coding & lanes
- Artifact: `.artifacts/calendar/lane-snapshot.json` (+ optional screenshot)

#### Phase 7: Performance health polish
- Goal: Confirm covering indexes; tune remaining slow query (scoped)
- Do:
  - Cross-check `PERFORMANCE_INDEXES.md`; add ONLY missing ones
  - EXPLAIN BEFORE/AFTER; abort if < 5% improvement (document)
- Artifacts: `.artifacts/explain/<date>-<slug>-before.txt` and `...-after.txt`

#### Phase 8: Prune demo jobs script (dry-run)
- Goal: Safe cleanup utility
- Do:
  - `scripts/pruneDemoJobs.js` with `--dry-run` default; `--apply --confirm` required
  - Output JSON + CSV summary
  - Unit test selection logic; no side effects in dry-run
- Artifact: `.artifacts/prune-demo/preview-<date>.csv`

#### Phase 9: Final checks & documentation
- Goal: Consolidation
- Do:
  - Re-run tests, lint, typecheck
  - Update `docs/DEPLOY_CHECKLIST.md`
  - Summarize artifacts in `FINAL_VERIFICATION_COMPLETE.md`
- Artifact: `.artifacts/final-phase-report.md`

#### Phase 10: Final PR & close-out
- Goal: Merge safely
- Do:
  - Aggregate artifact references
  - Fill PR checklist; provide rollback mapping per phase commit
  - Confirm no guardrail violations
- Artifact: `.artifacts/final-verification-report-master-prompt.md` (append phase deltas)

### Contracts & edge cases
- Date/time: empty strings → null → friendly display; no “Invalid Date”
- Promise date: timezone-stable; parse `YYYY-MM-DD` as local date
- RLS: Staff vs Manager remains enforced; rerun multi-user tests after service changes
- Dropdowns: Deactivated items excluded for new selections; existing references still show names
- Error handling: Map permission errors to remediation; no silent catch-alls

### Operational loop (each phase)
1. Branch: `feature/phase-<n>-<short-slug>`
2. If schema/perf related: run Supabase MCP introspection
3. Plan minimal diff; write tests first where practical
4. Implement small commits
5. Run: tests, lint, typecheck
6. Capture artifacts
7. Draft PR with checklist
8. If STOP condition hits: commit TODO file and pause

### Test coverage expectations
- For each new helper: happy path + one edge case (null/empty/invalid)
- UI/interaction: behavior assertions or resilient snapshots
- Performance: do not assert timing unless behind env flag (avoid flakiness)

### Optional, low-risk extras
- Telemetry: add non-breaking metric (e.g., `calendar_render_ms`) behind feature flag
- Health endpoints: add “indexes_verified: true/false”
- Docs: add helper references to `docs/QUICK_START_DEVELOPMENT.md`

### Command reference (local)
```bash
pnpm dev
pnpm test
pnpm lint
pnpm typecheck
```

### STOP phrase (embed in logic)
If any required guardrail cannot be honored, STOP and emit a TODO with rationale—do not proceed with unsafe modifications.

### Current ready state (for next agent run)
- Phases 1–3 verified and in use
- Phases 4–10 defined with tests/artifacts criteria
- Guardrails cross-checked with the latest `/.github/copilot-instructions.md`
