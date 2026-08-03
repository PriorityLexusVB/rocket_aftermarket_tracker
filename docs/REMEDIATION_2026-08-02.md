# Rocket production remediation — 2026-08-02

This is the bounded execution ledger for the personnel, Auth/RLS, runtime,
claims, reporting, and continuity defects independently verified on 2026-08-02.
It is a closeout checklist, not a source of secrets or customer data.

## Baseline receipt

- Source: `main` / `origin/main` / remote `main` =
  `d4c95016747c5050a7352abbadd9b865a72e5e1d`; working tree clean before this wave.
- Deployment: production HTML reported `x-build-sha=d4c9501`; main asset
  `index-D-aHf_87.js`.
- Production login profiles: Rob Brasco = active admin; Ashley Terminello =
  active manager; Samantha Morgan = active manager. All three Auth users were
  confirmed and not banned/deleted.
- Correct replacement email: `samantha.morgan@priorityautomotive.com`.
- Work transfer: Ashley had zero active job references and zero open claims.
  Preserve her one resolved claim plus historical activity attribution.
- Auth residue before offboarding: Ashley had 33 session rows and 33 refresh
  token rows not marked revoked. Token usability was not tested.
- Open signup and caller-controlled role assignment were live before this wave.
- Production health probes falsely reported missing capabilities because the
  deployed Node 20 runtime was no longer supported by the current Supabase JS
  libraries.

## P0 — Auth and personnel

- [ ] Close public self-signup until a server-controlled invite flow exists.
- [ ] Make new-user profile role server-controlled; never trust
      `raw_user_meta_data.role`.
- [ ] Remove client fallback that recreates a missing profile as `manager`.
- [ ] Deny inactive or missing-profile sessions in both client routing and live
      RLS/helper functions.
- [ ] Make Admin login-user deactivation honest, authorized, and verified by
      returned row count.
- [ ] Rewrite or drop legacy cleanup functions that can delete Rob or historical
      attribution.
- [ ] Revoke or harden obsolete externally executable `SECURITY DEFINER` RPCs;
      retain RLS helpers only with fixed search paths and least-privilege grants.
- [ ] Globally revoke Ashley sessions and ban her Auth identity without deleting
      her historical public profile.
- [ ] Mark Ashley's retained profile inactive after cleanup safety is in place.
- [ ] Coordinate credential rotation for Rob and Samantha; never record new
      credentials in this repository or ledger.
- [ ] Verify exactly Rob + Samantha remain active, Ashley cannot authenticate,
      and historical claim/activity references remain intact.

## P1 — Personnel-facing product behavior

- [ ] Replace Ashley's public support contact with Samantha's correct email.
- [ ] Normalize the delivery-coordinator role/department predicate so Samantha's
      live `manager / Delivery Coordinators` profile is selectable everywhere.
- [ ] Correct admin-versus-manager role derivation and privileged-surface gates.
- [ ] Provide a working password-recovery landing route.
- [ ] Correct lifecycle help: Reversed is terminal; Completed can reopen.

## P1 — Runtime and customer truth

- [ ] Move the supported server runtime to Node 22 and restore truthful health
      probes without persisting false capability flags.
- [ ] Make guest claim-photo behavior truthful and secure under the live
      authenticated-only storage policy; do not widen anonymous storage access.
- [ ] Remove fabricated Analytics trend values.
- [ ] Remove the fixed ten-loaner availability assumption.
- [ ] Stop converting bounded Appointments/Analytics failures into false empty
      success states.

## P2 — Reliability and remaining-function review

- [ ] Replace multi-request deal deletion with an authorized, tenant-scoped,
      atomic database operation and failure-injection coverage.
- [ ] Keep atomic deal create/update as the next dedicated aggregate-write wave;
      it requires unifying the Deals and Calendar creation contracts and must not be
      improvised inside the personnel/offboarding patch.
- [ ] Reconcile committed migrations/types with live schema replayability.
- [ ] Repair the production migration workflow/history mismatch only from a
      reviewed live-schema receipt; never mark real live migrations reverted merely
      to silence version drift.
- [ ] Revalidate TODO/FIXME/backlog entries with an already-built check; do not
      promote stale historical queue items.
- [ ] Update `STATE.md` and current repo docs after production proof. Archives
      and applied historical migrations remain immutable evidence.
- [ ] Reconcile shared `HANDOFF.md` / `WHAT'S-LEFT.md` only after the other active
      Codex lane releases those files.
- [ ] Separately audit Ashley access in the legacy F&I Sheet/Apps Script and
      external systems; Rocket changes cannot prove those surfaces.

## Release gates

- [ ] Focused tests for every changed behavior.
- [ ] `pnpm lint` succeeds.
- [ ] `pnpm run typecheck` succeeds.
- [ ] `pnpm test` succeeds.
- [ ] `pnpm build` succeeds.
- [ ] Supabase security advisors reviewed after migration.
- [ ] Independent security/code review passes.
- [ ] Production SQL/Auth postchecks match the expected personnel/policy matrix.
- [ ] Live deploy SHA matches pushed HEAD.
- [ ] Thin final desktop/mobile acceptance pass covers login help, password
      recovery, coordinator selection, protected routes, and guest-claim copy.

## Standing process improvement requested by Rob

- [x] Use MCP/API/CLI and deterministic tests as the default evidence and
      execution lane when they can prove the result directly.
- [x] Reserve browser control for the smallest final set of genuinely visual or
      interactive behaviors that cannot be proven through MCP/API/CLI/tests.
- [x] Decompose bounded implementation and independent-review work into separate
      agents early when that prevents drift, repeated exploration, or self-grading.
- [ ] Promote this into the canonical cross-project operating rules after the
      active unknown-scope Codex session releases the shared rule/config lane.
- [ ] At the start of substantive work and when friction appears, check current
      product changelogs, official docs, installed MCP/CLI capabilities, and local
      skills for a newer, safer, or more efficient connection path.
- [ ] Adopt a newer path only when representative verification proves equal or
      better quality, the full worker/review/retry cost improves, and rollback is
      explicit. Discovery never bypasses the stack-freeze capability-intake gate.
