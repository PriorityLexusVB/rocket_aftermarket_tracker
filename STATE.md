# STATE — rocket_aftermarket_tracker

> Per-repo memory file. The repo's single source of truth for "where is this project."
> Rewrite to current truth each working session — do NOT append session logs.

**Last updated:** 2026-05-19 · **By:** WORK PC / Claude · **HEAD:** `7166183`

---

## What this is
Calendar-based aftermarket/service-department job and appointment management app for
Priority Lexus — schedule, track, and round up aftermarket jobs across vendors.

## Stack (frozen)
React 18 + Vite 7 + Tailwind 3 + Redux Toolkit + React Query. Supabase (Auth/Postgres/
Storage) backend. Twilio SMS via Supabase edge functions (`processOutbox`, `twilioInbound`).
pnpm 10.15.0, Node 20. Hosted on Vercel.

## Current state — is it live?
- Deployed: yes — Vercel: **https://rocket-aftermarket-tracker.vercel.app**
- Last shipped: Wave XXIII — launch-readiness pass (2026-05-19)
- Build/CI: green on HEAD `7166183`. ALL workflows green incl. supabase-migrate
  (migration history reconciled). Build ~7s. Dependency audit: 0 vulnerabilities.
- Live-verified 2026-05-19: app mounts, login works, unified Calendar shell renders,
  Board shows scheduled jobs, DealDrawer opens, month/week views work, zero console
  errors at https://rocket-aftermarket-tracker.vercel.app
- Auto-deploy: Vercel native GitHub integration on push to `main`.

## What works (trustworthy)
- Unified Calendar shell (Board / Calendar / List) + Deal Drawer — now ON in
  production via committed `.env.production` feature flags.
- Calendar Board, Flow Management Center (VendorLaneView, UnscheduledQueue, RoundUpModal)
- Active Appointments deal sheet with bulk ops; Dashboard GP rows / overdue counts
- Round-Up CSV/Copy export — classifies products by op_code (RG/EXT/INT/WS/EN)
- Test suite: 1073/1073 passing (1 known flaky — `dealsPage.completeAutoReturnsLoaner`,
  re-run clears)

## What is NOT trustworthy yet
- Twilio SMS outbound is built + edge functions deployed (`processOutbox` v5,
  `twilioInbound` v6 ACTIVE) but **not production-registered** — Trust Hub Brand
  registration incomplete. Outbound SMS will not deliver until done.
- Production Supabase project `ogjtmtndgiqqdtwatsue` is SHARED with an unrelated
  eBay/deal-hunter app (tables brand_rules/size_rules/found_items + edge functions
  ebay-deletion-webhook/deal-hunter are NOT rocket's). The 3 RLS-disabled advisor
  ERRORs belong to that app, not rocket.

## RECOMMENDED polish (verified live, NOT launch blockers)
- Day Board grid renders 7AM-6PM only — a job scheduled before 7AM (seed job 80158
  @ 5AM) is returned by the RPC but not shown on the day grid (IS visible on Month).
  Consider an out-of-grid-hours indicator. Pre-existing.
- Env/build badge ("ENV PROD …watsue / build <sha>") floats clipped at the right
  viewport edge — consider hiding in production or repositioning.
- Vendor-lane drop shows a "Time TBD" badge but no toast (badge communicates it).
- Round-Up overlay covers its own header toggle button (close via the modal's X).
- 7 pre-existing eslint unused-var warnings in untouched files (don't fail CI).

## Open loops (close or kill before new builds)
- [ ] **Twilio Trust Hub Brand registration** — ~10 min Rob manual action in Twilio console
- [ ] Lint: 15 unused-var warnings (dealCRUD.js, jobService.js) — leftover from the
      P1-2 auto-upgrade neutralization. Cosmetic; does not fail CI.
- [ ] Dependabot PRs #341 (fast-uri) / #342 (npm-minor group) — #341 now moot
      (fast-uri overridden directly); review/close.

## Credentials / access needed
- Supabase — project `ogjtmtndgiqqdtwatsue`; keys in `.env.local` + `sb:link` scripts.
  Canonical encrypted copy: `OneDrive/claude-sync/env-vault/`
- Twilio — have account; Trust Hub Brand registration still pending (open loop above)
- Vercel — connected; project `prj_Rk63GLIJMparBL7LDJsOkAW8rm4k`

## Next 3 actions
1. Rob completes Twilio Trust Hub Brand registration (~10 min) — unblocks SMS delivery
2. Optional: clear the 15 lint warnings + close Dependabot PRs
3. Browser-walk the live deploy as a coordinator once Vercel updates

## Decisions log (newest first)
- 2026-05-19 — Wave XXIII launch pass (XXIII-A..D): removed unused `next` dep
  (.npmrc auto-install-peers=false) — 17 vulns -> 0, fixes red CI;
  `.env.production` committed to turn the unified Calendar shell ON in prod;
  migration 20260519000001 NOTIFY pgrst reload (fixes rls-drift-nightly);
  calendar month-boundary, vendor-lane feedback, responsive UnscheduledQueue,
  DealDrawer portal, Round-Up op_code classifier fixed.
  XXIII-C: fixed blank prod page — vendor-chunk circular import (React core
  was split across vendor-react/router/redux; now one chunk).
  XXIII-D: fixed stuck login spinner — signIn() sets user internally, so the
  effect-based navigation never re-fired; now navigates directly after signIn.
- 2026-05-03 — Rename PromisedQueue → UnscheduledQueue (Wave XXII-E)
- 2026-05-03 — Location vocab frozen: In-House / Off-Site / Split Work (key `Mixed`)
- 2026-05-03 — vite 5.4 → 7.3.2 major bump (Wave XIX)

---
_Update at the end of every session that changed the project._
