# STATE — rocket_aftermarket_tracker

> Canonical current project truth. Rewrite this file when live state changes;
> do not append session transcripts.

**Last verified:** 2026-08-03 ET · **Owner:** Codex / Rob Brasco

## Current live truth

- Application: LIVE at <https://rocket-aftermarket-tracker.vercel.app>.
- Application-code release: `7dd6fdd915959dd5564ac92c5b24fe9e353869c8`.
- Verified production deployment: `dpl_6Qk66XQi7FMCBcCk3TvEdnhQyiMd`.
- Verified production artifact: `assets/index-Sv4hJDEa.js` with
  `x-build-sha=7dd6fdd`.
- Release PR: <https://github.com/PriorityLexusVB/rocket_aftermarket_tracker/pull/361>.
- Supabase production project: `ogjtmtndgiqqdtwatsue`, ACTIVE_HEALTHY,
  Postgres `17.6.1.005`.
- Runtime: Node 22 for Vercel workflows and functions.
- Production feature flags: Deal Form V2 and unified Calendar shell are active.

## Personnel and Auth

- Samantha Morgan is the active Delivery Coordinators manager and public support
  contact: `samantha.morgan@priorityautomotive.com`.
- Rob Brasco remains the active administrator.
- Ashley Terminello is retained only for historical attribution:
  `user_profiles.is_active=false`, Auth banned, password replaced and discarded,
  session rows `0`, refresh-token rows `0`.
- Exactly two linked logins are active and unbanned: Rob and Samantha.
- Ashley had no jobs to transfer. Her one assigned historical claim and four
  activity rows remain unchanged.
- Hosted public signup is closed: `disable_signup=true`, and checked-in local
  Supabase Auth config also disables general and email signup. New login accounts
  use the trusted Admin server endpoint; browser self-provisioning is removed.
- Inactive or missing-profile sessions fail closed in client routing and RLS.

## Current user flow

1. Staff signs in. Missing/inactive profiles are signed out; role gates protect
   manager/admin surfaces.
2. A coordinator creates or edits a deal, adds products, and optionally schedules
   work or a loaner.
3. Board, Calendar, and List provide the scheduling loop; Overdue is the focused
   exception inbox; Appointments and Loaners expose operational follow-through.
4. Work progresses through pending, scheduled, in progress, and completed;
   Quality Check is an in-progress timestamp, not a separate status. Completed
   work can reopen; Reversed is terminal.
5. A customer can submit a claim without signing in. The form reads products and
   submits through narrow RPCs only; anonymous table access and public photo
   upload are disabled. Staff requests photos later when needed.

## Production controls now live

- Migrations:
  - `20260803044354 rocket_security_personnel_remediation`
  - `20260803044800 guest_claim_direct_access_cleanup`
- Twenty-two critical tables have a restrictive active-user RLS policy.
- Tenant helpers use database profile state, fixed empty search paths, and
  least-privilege grants.
- Caller-controlled signup roles, global manager tenant bypasses, unsafe cleanup
  functions, obsolete public RPCs, and anonymous claim/product table access are
  removed.
- Deal deletion is one authorized tenant-scoped database transaction.
- Health endpoints return truthful 200 responses under Node 22.
- Analytics no longer invents trend percentages; Appointments/Analytics expose
  failures; Loaners no longer assumes a ten-vehicle fleet.

## Verification receipt

- Exact `7dd6fdd` candidate passed build, test, CI, E2E Smoke, CodeQL,
  GitGuardian, Copilot review, and Vercel checks.
- Local full suite: 144 test files, 1,126 passed, 2 skipped; lint had zero errors
  and six pre-existing warnings; typecheck and build passed.
- Production health: `/api/health`, deals relationship, loaner assignment,
  profile capability, and index probes all returned HTTP 200.
- Guest boundary: anonymous direct table calls return HTTP 401; product RPC
  returns six bounded products; invalid claim input returns HTTP 400 and creates
  no claim.
- Supabase security advisors improved from 92 to 73 findings. The remaining 70
  warnings and three errors are tracked below; they are not silently closed.
- Browser: desktop and 375x667 verified Samantha support, recovery landing,
  protected-route redirect, guest products/copy, zero horizontal overflow,
  zero console errors, and no failed observed API request.
- Detailed evidence and remaining items: `docs/REMEDIATION_2026-08-02.md`.

## Remaining work — do not lose

1. **Owner credential rotation:** Rob and Samantha must rotate the formerly
   shared credential through a coordinated process that does not lock both live
   admins out. Never store replacement credentials in Git or continuity notes.
2. **Atomic aggregate writes:** deal create/update still spans multiple writes.
   Unify the Deals and Calendar contracts before replacing it with one RPC.
3. **Schema replayability:** reconcile the broader committed migration/type chain
   with the live schema. Ten MCP-applied files are being aligned to their exact
   hosted versions and one omitted hosted artifact is restored. Before the
   production push workflow is green, record the three independently verified
   already-live June migrations as applied through the one-time history-only gate;
   never replay Wave XXX-V against production.
4. **Security-advisor backlog:** classify the remaining four always-true policy,
   38 mutable-search-path, 8 anonymous definer, 19 authenticated definer, and
   leaked-password-protection warnings as a separate bounded wave. The three
   errors belong to shared non-Rocket tables `brand_rules`, `size_rules`, and
   `found_items`; do not mutate them from Rocket work.
5. **Dependency security:** nine Dependabot alerts remain: five active-graph
   runtime/tooling alerts require a separately tested React Router 7 and Babel
   toolchain upgrade; four high/medium alerts are confined to the historical
   `.vscode-snapshot` development manifest. Do not dismiss either set as fixed.
6. **Supabase key transition:** replace legacy JWT anon/service-role variables
   with the already-provisioned publishable/secret keys only through a tested,
   rollback-ready Auth-secret release before legacy retirement.
7. **External personnel surfaces:** separately audit Ashley in the legacy F&I
   Sheet/Apps Script and other vendor systems; Rocket cannot prove those systems.
8. **Shared continuity:** reconcile `HANDOFF.md` / `WHAT'S-LEFT.md` and promote
   the MCP/CLI-first rule into canonical shared rules after the active Sales
   Tracker lane releases the OneDrive scope.
9. **Public-form polish:** replace placeholder Privacy/Terms links and improve
   inline validation/required-field accessibility without changing claim policy.
10. **Older operator checks:** reverify Twilio Trust Hub registration status and
    coordinator-eyeball the ET-aware weekly/monthly Round-Up export; older notes
    are leads, not proof these remain open.

## Standing execution rule

Use MCP/API/CLI, SQL, builds, and deterministic tests as the primary lane.
Delegate bounded implementation and independent verification early. Use browser
control only for the smallest final set of user-visible behavior that those
lanes cannot prove. Check current official docs, changelogs, installed MCP/CLI
capabilities, and local skills when substantive work begins or friction appears;
adopt a new path only with representative proof, explicit rollback, and the
stack-freeze intake gate intact.
