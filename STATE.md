# STATE — rocket_aftermarket_tracker

> Per-repo memory file. The repo's single source of truth for "where is this project."
> Rewrite to current truth each working session — do NOT append session logs.

**Last updated:** 2026-05-30 PM · **By:** WORK PC / Claude · **HEAD:** post-`0a804d7` (Wave B Slices 1+2+4 shipped 5/28; ET-aware Round-Up + isPromiseOnly cleanup in flight this session — commit pending)

---

## What this is
Calendar-based aftermarket/service-department job and appointment management app for Priority Lexus — schedule, track, and round up aftermarket jobs across vendors.

## Stack (frozen)
React 18 + Vite 7 + Tailwind 3 + Redux Toolkit + React Query. Supabase (Auth/Postgres/Storage) backend. Twilio SMS via Supabase edge functions (`processOutbox`, `twilioInbound`). pnpm 10.15.0, Node 20. Hosted on Vercel.

## Current state — is it live?
- Deployed: yes — Vercel: **https://rocket-aftermarket-tracker.vercel.app**
- Auto-deploy: Vercel native GitHub integration on push to `main`.
- Last shipped: Wave B Slices 1+2+4 — time-axis week view + mobile Agenda (HEAD `0a804d7`, 2026-05-28).
- Pending ship this session: ET-aware weekly/monthly Round-Up + isPromiseOnly shadow cleanup (commit pending; auto-deploys on push).

## What works (trustworthy)
- **Unified Calendar shell** (Board / Calendar / List) + Deal Drawer — ON in production.
- **Time-axis week view (Wave B):** 7am-7pm visible band, 64px/hr resolution, real `scheduled_end_time` with 1hr NULL fallback, promise-only band above grid, red "now" line on today's column, layoutOverlaps greedy column-packing for same-hour conflicts. Progressive disclosure (customer ≥48px, vendor ≥64px, details ≥128px).
- **Mobile (<768px) Agenda fallback** when week view active — 7-col grid is unreadable at 44px per column on iPhone.
- Calendar Board, Flow Management Center (VendorLaneView, UnscheduledQueue, RoundUpModal).
- Active Appointments deal sheet with bulk ops; Dashboard GP rows / overdue counts.
- Round-Up CSV/Copy export — classifies products by op_code (RG/EXT/INT/WS/EN). **Daily, weekly, and monthly ranges all ET-aware** as of this session's ship (`etStartOf{Day,Week,Month}` / `etEndOf{Day,Week,Month}` from `src/utils/etDateBoundaries.js`).
- Multi-vendor per line-item routing (Wave XXX-H).
- KPI dashboard action-first redesign (Wave XXX-P).
- Test suite: 1073/1073 passing on Wave XXIII baseline (1 known flaky — `dealsPage.completeAutoReturnsLoaner`, re-run clears). Calendar surface tests passing post-Wave-B.

## What is NOT trustworthy yet
- **Twilio SMS outbound** is built + edge functions deployed (`processOutbox` v5, `twilioInbound` v6 ACTIVE) but **not production-registered** — Trust Hub Brand registration incomplete. Outbound SMS will not deliver until done.
- Production Supabase project `ogjtmtndgiqqdtwatsue` is SHARED with an unrelated eBay/deal-hunter app (tables brand_rules/size_rules/found_items + edge functions ebay-deletion-webhook/deal-hunter are NOT rocket's). The 3 RLS-disabled advisor ERRORs belong to that app, not rocket.

## Open loops (post-Wave-B)
- [ ] **Twilio Trust Hub Brand registration** — ~10 min Rob manual action in Twilio console (unblocks SMS delivery).
- [ ] **Appointments/List view overdue inconsistency** — calendar-flow-specialist sense-check found: Appointments page shows empty while Deals reports 3 overdue. `src/pages/calendar-agenda/index.jsx:479` excluded set is `['draft','canceled','cancelled']` — does NOT filter completed/delivered. Needs Rob decision: should Appointments match Deals overdue count (filter alignment) or is it intended-scope-difference?
- [ ] **Product chip tooltip expansion** — EN3/RG/EXT/EVERNEW codes used in Round-Up export and deal cards without expansion labels. Touches DealDrawer.jsx, RoundUpModal.jsx, deal card renderers.
- [ ] **Memoize `layoutOverlaps`** in `src/pages/calendar/index.jsx` — release-auditor flagged in Wave B as RECOMMENDED deferred. Currently recomputed on every render.
- [ ] **Hoist `hourLabels`** to module scope — same Wave B deferred RECOMMENDED. Currently built per render.
- [ ] Lint: 15 unused-var warnings (dealCRUD.js, jobService.js) — leftover from P1-2 auto-upgrade neutralization. Cosmetic; does not fail CI.
- [ ] Dependabot PRs #341 (fast-uri) / #342 (npm-minor group) — #341 now moot (fast-uri overridden directly); review/close.

## Credentials / access needed
- Supabase — project `ogjtmtndgiqqdtwatsue`; keys in `.env.local` + `sb:link` scripts. Canonical encrypted copy: `OneDrive/claude-sync/env-vault/`
- Twilio — have account; Trust Hub Brand registration still pending (open loop above)
- Vercel — connected; project `prj_Rk63GLIJMparBL7LDJsOkAW8rm4k`

## Next 3 actions
1. Rob completes Twilio Trust Hub Brand registration (~10 min) — unblocks SMS delivery.
2. Resolve Appointments/List vs Deals overdue discrepancy (decide intended scope, then align).
3. Browser-walk the live deploy after this session's ship lands — verify weekly/monthly Round-Up boundary changes are correct in coordinator workflow.

## Decisions log (newest first)
- **2026-05-30 PM** — ET-aware weekly/monthly Round-Up. `CalendarShell.jsx:231-241` weekly + monthly Round-Up branches were using local-time `date-fns startOfWeek` / `startOfMonth`, which silently dropped/included late-evening jobs near midnight ET. Added `etStartOfWeek`/`etEndOfWeek`/`etStartOfMonth`/`etEndOfMonth` to `src/utils/etDateBoundaries.js` (Mon-anchored week, noon-UTC anchor to dodge ET-vs-UTC date-shift trap). Smoke-tested 4 cases: weekday EDT, last-day-of-EST-week, DST spring-forward day, late-night ET (May 31 23:30 ET = Jun 1 03:30 UTC) — all return correct ET boundaries. Same commit: removed 2 `isPromiseOnly` shadow declarations at `src/pages/calendar/index.jsx:1485` + `:1622`, replaced with calls to the module-scope helper at line 110 (Wave B deferred RECOMMENDED). Build clean 6.05s. Identified by `calendar-flow-specialist` audit.
- 2026-05-28 — Wave B Slices 1+2+4 (`0a804d7`): time-axis week view rewrite, mobile Agenda fallback, greedy column-packing for overlap. Wave B Slice 3 (`c8842e7`): Calendar tab defaults to Week not Month. Wave A (`ec2ef98`): calendar readability quick wins.
- 2026-05-19 — Wave XXIII launch pass (XXIII-A..D): removed unused `next` dep (.npmrc auto-install-peers=false) — 17 vulns → 0, fixes red CI; `.env.production` committed to turn the unified Calendar shell ON in prod; migration 20260519000001 NOTIFY pgrst reload (fixes rls-drift-nightly); calendar month-boundary, vendor-lane feedback, responsive UnscheduledQueue, DealDrawer portal, Round-Up op_code classifier fixed. XXIII-C: fixed blank prod page — vendor-chunk circular import. XXIII-D: fixed stuck login spinner — direct nav after signIn.
- 2026-05-03 — Rename PromisedQueue → UnscheduledQueue (Wave XXII-E).
- 2026-05-03 — Location vocab frozen: In-House / Off-Site / Split Work (key `Mixed`).
- 2026-05-03 — vite 5.4 → 7.3.2 major bump (Wave XIX).

---
_Update at the end of every session that changed the project._
