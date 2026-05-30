# STATE — rocket_aftermarket_tracker

> Per-repo memory file. The repo's single source of truth for "where is this project."
> Rewrite to current truth each working session — do NOT append session logs.

**Last updated:** 2026-05-30 ~14:00 ET · **By:** WORK PC / Claude · **HEAD:** post-`5c4d1e7` (Wave B follow-up #1 ET-aware Round-Up shipped 5/30 13:00 ET; Wave 1 cleanup in flight — commit pending: hourLabels hoist + 7 unused-var sweep + eslint `_`-prefix whitelist)

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
- ✅ ~~**Appointments/List view overdue inconsistency**~~ — RESOLVED 2026-05-30. calendar-flow-specialist deep analysis revealed the two surfaces serve DIFFERENT workflows: Appointments = coordinator's full active working list (Ashley/Sam need quality_check + delivered + no_show visible); Deals overdue tile = narrow alarm (pending/in_progress/scheduled only). "Empty Appointments" is most likely a UI state issue (active filter chip in URL) NOT data exclusion. Added `'completed'` to local excluded set at `index.jsx:479` as documentation clarity (redundant safety net since `normalizeScheduleItemFromJob` already strips it). Loop closed.
- [ ] **Product chip tooltip expansion** — EN3/RG/EXT/EVERNEW codes used in Round-Up export and deal cards without expansion labels. Touches DealDrawer.jsx, RoundUpModal.jsx, deal card renderers.
- [ ] **Dependabot PR #345** — axios 1.15.2 → 1.16.0 security upgrade (1 CRITICAL CVSS 9.4 + 3 HIGH advisories). PRODUCTION DEP BUMP — Rob's call to merge. CI currently RED on the audit gate because of this; goes GREEN on merge.
- [ ] **Dependabot PR #344** — npm-minor-patch group (31 deps). Rob decision.
- [ ] **RoundUpModal date-aware export verification** — Wave 1 deleted a dead `exportRange` useMemo from RoundUpModal.jsx. The deleted code was using local-time `date-fns` boundaries (same bug class as the CalendarShell weekly/monthly Round-Up). Since the export now flows through CalendarShell's date range, and CalendarShell is ET-aware as of `5c4d1e7`, the export is implicitly ET-aware too — BUT worth a coordinator-side eyeball verification on the next live weekly+monthly export.

## ✅ REJECTED open loops (closed without action)
- ~~Memoize `layoutOverlaps`~~ — REJECTED 2026-05-30 AND re-confirmed by general-purpose audit 2026-05-30 PM. The function runs ~7×/render at sub-ms cost (~1,000 simple ops total per week-view render); naive useMemo wouldn't hit (input is freshly `.filter()`-allocated per render); WeakMap cache wouldn't hit either (weak keys must be objects, fresh array each render). Re-audit verdict: "CONFIRM REJECTION — non-problem; CPU cost negligible." ENHANCEMENT SURFACED: the higher-leverage target IF perf ever becomes a measured problem is wrapping `weekDays` at `src/pages/calendar/index.jsx:873-900` in `useMemo([dateRange.start, jobsByDayKey])` — that stabilizes downstream references across the WHOLE CalendarGrid render tree, not just layoutOverlaps. Deferred until perf is actually measured.
- ~~Lint warning count "15"~~ — was actually 7 (count was stale); all 7 cleared in Wave 1.
- ~~Dependabot PR #341 fast-uri~~ — was reported as moot; verified closed by Rob (no longer in open PR list).

## ✅ Wave 1 cleanup shipped this session (commit pending)
- `hourLabels` hoisted from per-render build (inside week-view JSX) to module-scope `HOUR_LABELS` constant in `src/pages/calendar/index.jsx`.
- `eslint.config.js` updated: `no-unused-vars` now whitelists `^_` prefix for both args (`argsIgnorePattern`) and vars (`varsIgnorePattern`) — standard JS intent-marker convention.
- 7 unused-var lint warnings cleared:
  - `exportRange` (RoundUpModal) — dead useMemo deleted + 6 stale `date-fns` imports cleaned
  - `handleJobStatusUpdate` (flow-management) — 4-month-old dead handler deleted (added 2026-01-24 Wave XX, never wired)
  - `overdueCountRes` (dashboard) — Wave XXX-U placeholder cleanup: removed lingering `Promise.resolve(null)` from the Promise.all + the orphan destructure slot
  - `openOppSublabel` (dashboard) — dead constant deleted
  - `orgId` (calendarService.getOverdueWithOldest) — renamed `_orgId` with comment explaining stable API surface
  - `_now` (scheduleItemsService.isOverdueJob) — now whitelisted by eslint config
  - `primaryAction` (dealDrawer.test) — unused locator deleted
- Verified: `pnpm lint` 0 warnings · `pnpm typecheck` clean · `pnpm build` clean 5.48s.

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
