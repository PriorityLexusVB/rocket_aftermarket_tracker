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
- Auth residue before offboarding: Ashley had 33 session rows and 133 refresh
  token rows, of which 33 were not marked revoked. Token usability was not tested.
- Open signup and caller-controlled role assignment were live before this wave.
- Production health probes falsely reported missing capabilities because the
  deployed Node 20 runtime was no longer supported by the current Supabase JS
  libraries.

## P0 — Auth and personnel

- [x] Close public self-signup until a server-controlled invite flow exists.
- [x] Make new-user profile role server-controlled; never trust
      `raw_user_meta_data.role`.
- [x] Remove client fallback that recreates a missing profile as `manager`.
- [x] Deny inactive or missing-profile sessions in both client routing and live
      RLS/helper functions.
- [x] Make Admin login-user deactivation honest, authorized, and verified by
      returned row count.
- [x] Rewrite or drop legacy cleanup functions that can delete Rob or historical
      attribution.
- [x] Revoke or harden obsolete externally executable `SECURITY DEFINER` RPCs;
      retain RLS helpers only with fixed search paths and least-privilege grants.
- [x] Globally revoke Ashley sessions and ban her Auth identity without deleting
      her historical public profile.
- [x] Mark Ashley's retained profile inactive after cleanup safety is in place.
- [ ] Coordinate credential rotation for Rob and Samantha; never record new
      credentials in this repository or ledger.
- [x] Verify exactly Rob + Samantha remain active, Ashley cannot authenticate,
      and historical claim/activity references remain intact.

## P1 — Personnel-facing product behavior

- [x] Replace Ashley's public support contact with Samantha's correct email.
- [x] Normalize the delivery-coordinator role/department predicate so Samantha's
      live `manager / Delivery Coordinators` profile is selectable everywhere.
- [x] Correct admin-versus-manager role derivation and privileged-surface gates.
- [x] Provide a working password-recovery landing route.
- [x] Correct lifecycle help: Reversed is terminal; Completed can reopen.

## P1 — Runtime and customer truth

- [x] Move the supported server runtime to Node 22 and restore truthful health
      probes without persisting false capability flags.
- [x] Make guest claim-photo behavior truthful and secure under the live
      authenticated-only storage policy; do not widen anonymous storage access.
- [x] Remove fabricated Analytics trend values.
- [x] Remove the fixed ten-loaner availability assumption.
- [x] Stop converting bounded Appointments/Analytics failures into false empty
      success states.

## P2 — Reliability and remaining-function review

- [x] Replace multi-request deal deletion with an authorized, tenant-scoped,
      atomic database operation and failure-injection coverage.
- [ ] Keep atomic deal create/update as the next dedicated aggregate-write wave;
      it requires unifying the Deals and Calendar creation contracts and must not be
      improvised inside the personnel/offboarding patch.
- [ ] Reconcile committed migrations/types with live schema replayability.
- [ ] Complete the production migration workflow/history repair from the reviewed
      live receipt: ten unchanged local SQL files are aligned to hosted versions,
      the omitted `20260523170102` artifact is restored from the hosted ledger, and
      the three independently verified already-live June migrations must be marked
      applied through the one-time history-only gate. Never replay Wave XXX-V or
      mark a real hosted migration reverted merely to silence drift.
- [x] Revalidate TODO/FIXME/backlog entries with an already-built check; do not
      promote stale historical queue items.
- [ ] Plan and verify a separate transition from the legacy JWT `anon` /
      `service_role` variables to the already-provisioned Supabase publishable /
      secret keys before the legacy-key retirement window. Treat this as an
      Auth-secret rollout with representative tests and an explicit rollback;
      do not fold it into the personnel release.
- [ ] Resolve the nine open Dependabot alerts in a separate dependency wave: test
      the React Router 7 and Babel/toolchain changes against the full app, and
      refresh or retire the `.vscode-snapshot` manifest rather than dismissing its
      four development-only alerts as fixed.
- [x] Update `STATE.md` and current repo docs after production proof. Archives
      and applied historical migrations remain immutable evidence.
- [ ] Reconcile shared `HANDOFF.md` / `WHAT'S-LEFT.md` only after the other active
      Codex lane releases those files.
- [ ] Separately audit Ashley access in the legacy F&I Sheet/Apps Script and
      external systems; Rocket changes cannot prove those surfaces.

## Release gates

- [x] Focused tests for every changed behavior.
- [x] `pnpm lint` succeeds.
- [x] `pnpm run typecheck` succeeds.
- [x] `pnpm test` succeeds.
- [x] `pnpm build` succeeds.
- [x] Supabase security advisors reviewed after migration.
- [x] Independent security/code review passes.
- [x] Production SQL/Auth postchecks match the expected personnel/policy matrix.
- [x] Live deploy SHA matches pushed HEAD.
- [x] Thin final desktop/mobile acceptance covers login help, password recovery,
      protected routes, and guest-claim copy. Coordinator selection is covered by
      the live profile receipt plus focused tests; no production credential was used.

## Standing process improvement requested by Rob

- [x] Use MCP/API/CLI and deterministic tests as the default evidence and
      execution lane when they can prove the result directly.
- [x] Reserve browser control for the smallest final set of genuinely visual or
      interactive behaviors that cannot be proven through MCP/API/CLI/tests.
- [x] Decompose bounded implementation and independent-review work into separate
      agents early when that prevents drift, repeated exploration, or self-grading.
- [ ] Promote this into the canonical cross-project operating rules after the
      active unknown-scope Codex session releases the shared rule/config lane.
- [x] At the start of substantive work and when friction appears, check current
      product changelogs, official docs, installed MCP/CLI capabilities, and local
      skills for a newer, safer, or more efficient connection path.
- [x] Adopt a newer path only when representative verification proves equal or
      better quality, the full worker/review/retry cost improves, and rollback is
      explicit. Discovery never bypasses the stack-freeze capability-intake gate.

## Production closeout receipt — 2026-08-03

- Release candidate: `7dd6fdd915959dd5564ac92c5b24fe9e353869c8`.
- GitHub PR: `#361`; build, test, CI, E2E Smoke, CodeQL, GitGuardian, Copilot
  review, and Vercel checks all passed for the exact release candidate.
- Production deployment: `dpl_6Qk66XQi7FMCBcCk3TvEdnhQyiMd`; canonical HTML
  reported `x-build-sha=7dd6fdd`; main asset `assets/index-Sv4hJDEa.js`.
- Supabase migrations: `20260803044354 rocket_security_personnel_remediation`
  and `20260803044800 guest_claim_direct_access_cleanup`.
- Hosted Auth: `disable_signup=true` in both Management API and public settings.
- Personnel: Ashley retained for attribution with `is_active=false`, Auth banned,
  sessions `33 -> 0`, refresh-token rows `133 total / 33 unrevoked -> 0`; exactly
  Rob and Samantha remain active and unbanned. Ashley history remains one assigned
  claim and four activity rows.
- Guest claims: direct anonymous `claims`, `claim_attachments`, and `products`
  access returns 401; the public product RPC returns six products and the claim
  RPC rejects invalid input without creating a row.
- Security advisors: `92 -> 73` total findings (`89 -> 70` warnings). The three
  unchanged errors are on shared non-Rocket tables `brand_rules`, `size_rules`,
  and `found_items`; this release deliberately did not mutate them.
- Browser receipt: desktop plus 375x667 verified Samantha support, reset route,
  protected redirect, six guest products, truthful photo copy, no horizontal
  overflow, zero console errors, and all observed API requests at HTTP 200.
