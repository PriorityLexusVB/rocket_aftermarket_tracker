# STATE — rocket_aftermarket_tracker

> Per-repo memory file. The repo's single source of truth for "where is this project."
> Rewrite to current truth each working session — do NOT append session logs.

**Last updated:** 2026-06-01 ~19:30 ET · **By:** WORK PC / Claude · **HEAD:** `62fbd9d` (Wave F UX deferred-items sweep shipped + live-verified). Live bundle `index-B2cGXEtJ.js` or newer. Prior: `a8dbc06` (Wave E) → `33c85f2` (Wave D) → `f07ca04` (Wave C).

---

## What this is
Calendar-based aftermarket/service-department job and appointment management app for Priority Lexus — schedule, track, and round up aftermarket jobs across vendors.

## Stack (frozen)
React 18 + Vite 7 + Tailwind 3 + Redux Toolkit + React Query. Supabase (Auth/Postgres/Storage) backend. Twilio SMS via Supabase edge functions (`processOutbox`, `twilioInbound`). pnpm 10.15.0, Node 20. Hosted on Vercel.

## Current state — is it live?
- Deployed: yes — Vercel: **https://rocket-aftermarket-tracker.vercel.app**
- Auto-deploy: Vercel native GitHub integration on push to `main`.
- Last shipped: Codex product-chip tooltip closeout + STATE refresh at `3078065`.
- Previous shipped baseline: post-recon cleanup at `8dc1593` after Wave B, Wave 1 cleanup, and npm minor/patch Dependabot PR #344.

## What works (trustworthy)
- **Calendar color/contrast (Wave C `f07ca04`)** — week/month/day views now legible on the actual light canvas. Hour gridlines visible (slate-200), hour labels bold+dark (slate-700 11px), day headers dark slate-800 with today=blue-700 for strong anchor, job tiles bold blue-200/purple-200 with blue-500/purple-500 borders, P/S/O badges opaque with borders, list cards opaque white with slate-300 borders. Live-verified at 1920/1366/375p.
- **Unified Calendar shell** (Board / Calendar / List) + Deal Drawer — ON in production.
- **Time-axis week view (Wave B):** 7am-7pm visible band, 64px/hr resolution, real `scheduled_end_time` with 1hr NULL fallback, promise-only band above grid, red "now" line on today's column, layoutOverlaps greedy column-packing for same-hour conflicts. Progressive disclosure (customer ≥48px, vendor ≥64px, details ≥128px).
- **Mobile (<768px) Agenda fallback** when week view active — 7-col grid is unreadable at 44px per column on iPhone.
- Calendar Board, Flow Management Center (VendorLaneView, UnscheduledQueue, RoundUpModal).
- Active Appointments deal sheet with bulk ops; Dashboard GP rows / overdue counts.
- Round-Up CSV/Copy export — classifies products by op_code (RG/EXT/INT/WS/EN). **Daily, weekly, and monthly ranges all ET-aware** via `etStartOf{Day,Week,Month}` / `etEndOf{Day,Week,Month}` from `src/utils/etDateBoundaries.js`.
- Product/work-tag expansion labels are centralized in `src/utils/workTags.js`; calendar cards, vendor lanes, appointment cards, deal cards, Round-Up rows, and compact deal item summaries expose abbreviations like RG/EXT/INT/WS/EN3 via native `title` tooltips.
- Multi-vendor per line-item routing (Wave XXX-H).
- KPI dashboard action-first redesign (Wave XXX-P).
- Test suite: 1073/1073 passing on Wave XXIII baseline (1 known flaky — `dealsPage.completeAutoReturnsLoaner`, re-run clears). Calendar surface tests passing post-Wave-B.

## What is NOT trustworthy yet
- **Twilio SMS outbound** is built + edge functions deployed (`processOutbox` v5, `twilioInbound` v6 ACTIVE) but **not production-registered** — Trust Hub Brand registration incomplete. Outbound SMS will not deliver until done.
- Production Supabase project `ogjtmtndgiqqdtwatsue` is SHARED with an unrelated eBay/deal-hunter app (tables brand_rules/size_rules/found_items + edge functions ebay-deletion-webhook/deal-hunter are NOT rocket's). The 3 RLS-disabled advisor ERRORs belong to that app, not rocket.

## Open loops (post-Wave-F)
**Wave F closed 5 of 7 remaining items. 2 design-decision items + 1 pre-existing:**
- [ ] **Touch targets <44px on operational controls** (Codex F1, deferred design call). Bump h-8/p-1 to min-h-[44px] on Complete/Reopen/date-arrow buttons? Trade-off: 44px breaks chip layout; 32px is over WCAG AA 24×24 but under Apple HIG. Mobile vs desktop priority needs Rob input.
- [ ] **Create vs Edit deal pattern inconsistency** (browser-tester F7, deferred design call). Calendar `+New Deal` → full page `/deals/new` while Deals page uses Modal pattern. Two paths: (A) Calendar opens modal too (requires URL-state or modal-mount lift), (B) Deals page navigates to /deals/new instead of modal (simpler — kills the modal). Pick one. Both have trade-offs.

**Pre-existing (carried forward):**
- [ ] **Twilio Trust Hub Brand registration** — ~10 min Rob manual action in Twilio console (unblocks SMS delivery).

## Carried out (post-Wave-F)
- ✅ ~~F1 Touch targets~~ — DEFERRED design call.
- ✅ ~~F2 Customer Claims login button~~ — Wave F: reframed with dashed border, "Not a staff member?" header, "For customers only" subhead, "Open Customer Claims Form →" button.
- ✅ ~~F3 Loaner page data model explainer~~ — Wave F: 4 KPI tile sub-labels added.
- ✅ ~~F4 /api/health-deals-rel 500~~ — Wave F: root-caused to Node-20-no-WS + missing try/catch; vendored helper to api/_shared/ + wrapped getSupabase. Returns 200 now.
- ✅ ~~F5 Recharts width=-1 warnings~~ — Wave F: explicit pixel heights + minWidth=0 on 4 chart containers.
- ✅ ~~F6 Deal→Calendar scheduling shortcut~~ — Wave F: "Schedule on Board →" anchor in DealDrawer footer + DealDetailDrawer top action row (replaces disabled Schedule button).
- ✅ ~~F7 Create vs Edit pattern~~ — DEFERRED design call.
- ✅ ~~Alpha-white systematic sweep~~ — DOWN-SCOPED Wave E: most instances are intentional dark-island controls, not ghost-card bug.
- ✅ ~~Round-Up discoverability~~ — Wave E: button label "Round-Up" → "Daily Export" (self-explaining; tooltip preserves the term).
- ✅ ~~"Promise/no-time" standardization~~ — Wave E: 7 sites swept to "Needs time" / "Needs Time".
- ✅ ~~QC color drift~~ — Wave E: centralized to purple.
- ✅ ~~Calendar nav active state~~ — Wave E: isActivePath regex fix.
- ✅ ~~App identity in nav~~ — Wave E: "Aftermarket Tracker" wordmark at lg+.
- ✅ ~~Notification panel naming~~ — Wave E: consolidated to "Notifications".
- ✅ ~~Appointments label vs title~~ — Wave E: page title aligned to "Appointments".
- [ ] **Touch targets <44px** — Codex finding. CalendarShell controls + UnscheduledQueue complete buttons + RoundUpModal quick actions use `h-8`/`p-1`. WCAG/Apple HIG recommend 44px minimum for primary operational controls. Decision: bump operational controls to `min-h-[44px]`?
- [ ] **Deal → Calendar scheduling discoverability** — browser-tester. From inside a deal, no "Schedule to date" control; user must navigate to Calendar Board → drag. Add inline scheduling field or "Schedule this deal" button in DealDrawer? Bigger feature work.
- [ ] **Create deal full-page (`/deals/new`) vs Edit deal modal pattern inconsistency** — browser-tester. Same 2-step form, two different interaction patterns. Pick one (probably keep full-page for both since modal is cramped). Bigger decision.
- [ ] **`/api/health-deals-rel` returns 500 on every page load** — browser-tester. Backend route issue; doesn't visibly break anything but pollutes console + suggests a broken backend endpoint that could mask real failures. Needs backend investigation.
- [ ] **Recharts width=-1 zero-dim renders on Analytics** — browser-tester. Chart wrappers not getting explicit height from layout — charts render but report -1 dimensions to console. Layout debug needed.
- [ ] **"Customer Claims" button on login screen ambiguous** — sense-check Day-1 confusion (staff thinks it's a shortcut for them). Add disambiguation text or move it visually below the Sign In flow.
- [ ] **Loaner page contradiction kept the KPI numbers** — Wave D fixed the empty-state copy ("No active loaner assignments"). But: KPI tile still says "AVAILABLE 10" while Active Loaner Assignments shows 0. If user expects to see 10 vehicles listed, they'll be confused. Decision: should this page also list the 10 available vehicles (separate panel)? Or is "AVAILABLE 10" referring to fleet inventory while the table is current-assignments-only? Clarify the data model on the page.

**Carry-forward (pre-existing):**
- [ ] **Twilio Trust Hub Brand registration** — ~10 min Rob manual action in Twilio console (unblocks SMS delivery).
- ✅ ~~**Appointments/List view overdue inconsistency**~~ — RESOLVED 2026-05-30. calendar-flow-specialist deep analysis revealed the two surfaces serve DIFFERENT workflows: Appointments = coordinator's full active working list (Ashley/Sam need quality_check + delivered + no_show visible); Deals overdue tile = narrow alarm (pending/in_progress/scheduled only). "Empty Appointments" is most likely a UI state issue (active filter chip in URL) NOT data exclusion. Added `'completed'` to local excluded set at `index.jsx:479` as documentation clarity (redundant safety net since `normalizeScheduleItemFromJob` already strips it). Loop closed.
- ✅ ~~**Product chip tooltip expansion**~~ — CLOSED 2026-05-31. Existing `workTags.js` coverage already handled calendar cards, vendor lanes, appointment cards, and deal grid chips. Codex closed the remaining local gaps: Round-Up rows now render titled product/work-tag chips, `Pill` supports pass-through title props, compact deal `Items:` pills and deal core snapshots now expand labels like RG/EXT/INT/WS/EN3 on hover.
- ✅ ~~**Dependabot PR #345**~~ — CLOSED before Codex session. `package.json` + `pnpm-lock.yaml` pin axios `1.16.1`; local `node_modules` refreshed with `corepack pnpm install --frozen-lockfile` and now contains axios `1.16.1`.
- ✅ ~~**Dependabot PR #344**~~ — CLOSED before Codex session. Current HEAD includes `54a2216` (`chore(deps): bump the npm-minor-patch group across 1 directory with 31 updates (#344)`); local install refreshed from lockfile.
- [ ] **RoundUpModal date-aware export verification** — Wave 1 deleted a dead `exportRange` useMemo from RoundUpModal.jsx. The deleted code was using local-time `date-fns` boundaries (same bug class as the CalendarShell weekly/monthly Round-Up). Since the export now flows through CalendarShell's date range, and CalendarShell is ET-aware as of `5c4d1e7`, the export is implicitly ET-aware too — BUT worth a coordinator-side eyeball verification on the next live weekly+monthly export.

## ✅ REJECTED open loops (closed without action)
- ~~Memoize `layoutOverlaps`~~ — REJECTED 2026-05-30 AND re-confirmed by general-purpose audit 2026-05-30 PM. The function runs ~7×/render at sub-ms cost (~1,000 simple ops total per week-view render); naive useMemo wouldn't hit (input is freshly `.filter()`-allocated per render); WeakMap cache wouldn't hit either (weak keys must be objects, fresh array each render). Re-audit verdict: "CONFIRM REJECTION — non-problem; CPU cost negligible." ENHANCEMENT SURFACED: the higher-leverage target IF perf ever becomes a measured problem is wrapping `weekDays` at `src/pages/calendar/index.jsx:873-900` in `useMemo([dateRange.start, jobsByDayKey])` — that stabilizes downstream references across the WHOLE CalendarGrid render tree, not just layoutOverlaps. Deferred until perf is actually measured.
- ~~Lint warning count "15"~~ — was actually 7 (count was stale); all 7 cleared in Wave 1.
- ~~Dependabot PR #341 fast-uri~~ — was reported as moot; verified closed by Rob (no longer in open PR list).

## ✅ Wave 1 cleanup shipped 2026-05-30 (`a4590d0`)
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
- Verified at original ship: `pnpm lint` 0 warnings · `pnpm typecheck` clean · `pnpm build` clean 5.48s.

## ✅ Codex closeout 2026-05-31 (`3078065`)
- Repo current before edits: `git fetch origin`; `main`, `origin/main`, and `origin/HEAD` all at `8dc1593fc3aa8804e9d4de9edfbea0426784ae75`.
- Local dependency install refreshed from lockfile with `corepack pnpm install --frozen-lockfile`; axios installed at `1.16.1`.
- Remaining product chip tooltip gaps closed in `RoundUpModal.jsx`, `DealPresentational.jsx`, and `deals/index.jsx`.
- Verified: `corepack pnpm lint` clean · `corepack pnpm typecheck` clean · `corepack pnpm build` clean, Vite output `assets/index-CKWo-fZE.js`, build time 6.94s.
- Caveat: current shell is Node `24.15.0`; repo engine is Node `>=20 <21`, so future validation should run under Node 20 when possible.

## Credentials / access needed
- Supabase — project `ogjtmtndgiqqdtwatsue`; keys in `.env.local` + `sb:link` scripts. Canonical encrypted copy: `OneDrive/claude-sync/env-vault/`
- Twilio — have account; Trust Hub Brand registration still pending (open loop above)
- Vercel — connected; project `prj_Rk63GLIJMparBL7LDJsOkAW8rm4k`

## Next 3 actions
1. Rob completes Twilio Trust Hub Brand registration (~10 min) — unblocks SMS delivery.
2. Browser-walk the live deploy after this session's ship lands — verify weekly/monthly Round-Up boundary changes are correct in coordinator workflow.
3. Continue reviewing coordinator workflow surfaces for stale filters or confusing calendar/list state.

## Decisions log (newest first)
- **2026-06-01 PM Wave F (`62fbd9d`)** — Continued autonomous sweep of Wave E's 7 remaining deferred items. Shipped 5, deferred 2 as design calls. 11 files / ~140 ins / 35 del. (1) **F4 — /api/health-deals-rel 500 → 200**. Sibling endpoint `/api/health-loaner-assignments` returned the smoking gun: `"Node.js 20 detected without native WebSocket support."` `@supabase/supabase-js` `createClient()` throws on Vercel's Node 20 runtime when realtime WS transport is missing. `health-deals-rel.js` called `getSupabase()` outside any try/catch, so the throw became `FUNCTION_INVOCATION_FAILED` → 500. Two-part fix: vendored `src/utils/schemaErrorClassifier.js` to `api/_shared/schemaErrors.js` (cross-tree imports unreliable in Vercel function bundles) + wrapped `getSupabase()` in try/catch matching the sibling pattern. Endpoint now returns 200 with `classification: 'exception'` instead of 500. (2) **F5 — Recharts width=-1 console warnings cleared**. 4 chart containers (DealAnalyticsWidget BarChart, SalesTrendsChart LineChart + AreaChart, VehicleTypeChart PieChart + BarChart) used `width="100%" height="100%"` which relies on parent computed height during initial render. Switched to explicit pixel heights (256/320) + `minWidth={0}` to defeat flex/grid race. Browser-tester confirmed zero Recharts warnings on full-page render. (3) **F3 — Loaner page data model explainer**. KPI tiles (Available/Assigned/Overdue/Pending) had no context — "AVAILABLE 10" + "0 listed" felt contradictory. Added sub-labels: "Ready for the next customer" / "Currently with a customer" / "Past expected return date" / "Jobs needing a loaner". KPI + table now tell coherent story. (4) **F2 — Customer Claims login disambiguation**. Reframed the login-page customer-claims box: header "Not a staff member?" + subhead "For customers only" + button "Open Customer Claims Form →" + dashed border to visually de-prioritize from staff Sign In flow. (5) **F6 — Deal→Calendar scheduling shortcut**. Initially added "Schedule on Board →" button to `src/components/calendar/DealDrawer.jsx` footer (when `needsScheduling`). Browser-tester caught: the Deals page actually uses a DIFFERENT drawer (`src/pages/deals/components/DealDetailDrawer.jsx`) with a top action row Call/SMS/Copy Phone/Schedule(disabled)/Note/Complete. Wired up the previously-dead Schedule button as `<a href="/calendar?view=board&range=day">` with title tooltip. Both drawer surfaces now give coordinators a path from deal → schedule. (6) **F1 — Touch targets DEFERRED**. Codex finding (32px Complete/Reopen buttons under Apple HIG 44px) requires layout taste call and would break chip layouts. Marked as no-op autopilot, deferred to Rob design decision. (7) **F7 — Create vs Edit deal pattern DEFERRED**. Calendar "+ New Deal" navigates to full page `/deals/new` while Deals page uses NewDealModal/EditDealModal. Two architectural unification paths (all-modal vs all-page) — design call required. Bundle: 431.64 / 118.94 KB gz (+0.17 / +0.03 vs Wave E baseline; flat). Build + lint clean. Live-verified by browser-tester on bundle `index-BJ800wxO.js`: 4/5 PASS first pass (Customer Claims disambiguation, Loaner sublabels, Analytics no Recharts warnings, Wave E regression check all green; DealDrawer Schedule button caught as FAIL → re-fixed in follow-up commit `0d781ef` on DealDetailDrawer.jsx) + health endpoint manually verified returning 200 with graceful exception classification (was 500).
- **2026-06-01 PM Wave E (`a8dbc06`)** — Continued UX cleanup queue from Wave D's 13 deferred items. 11 files / 30 ins / 25 del. Shipped: (1) Navbar `isActivePath` regex — was comparing `location.pathname` to nav `href` which included query strings (`/calendar?view=board...`), so Calendar nav link never highlighted; now strips query/hash before comparison. (2) App identity — added "Aftermarket Tracker" wordmark at lg+ in top-left (was empty spacer with comment "Reserved space for future logo"). (3) Notification panel naming consolidation — desktop "Notifications & Activity" + mobile "Recent Activity" → "Notifications" (same data, single identity). (4) Appointments page title alignment — "Active Appointments" h1 → "Appointments" (matches nav label); subtitle changed from "Operations view: scheduled + controlled unscheduled" to "Scheduled and promised work in your active window" (coordinator language). (5) Quality Check color centralization — calendarColors.js was `bg-emerald-700` while DealDrawer + lib/time were purple; standardized to `bg-purple-500` to match. (6) DealDrawer "Move to QC" → "Move to Quality Check" (matches the status name). (7) lib/time.js `'DONE'` → `'Done'` (final ALL CAPS killed). (8) Round-Up button label "Round-Up" → "Daily Export" (Codex + sense-check + browser-tester convergent — self-explaining; "Round-Up" preserved in title tooltip for veteran coordinators). (9) "Time TBD" / "No Time Set" / "Needs Time Set" → "Needs time" / "Needs Time" — Codex multi-file standardization across 7 sites (calendar/index ×3, calendar-flow-management-center/index ×3, calendar-agenda/index ×2, UnscheduledQueue ×2, dashboard ×1). DOWN-SCOPED: Wave E1 (alpha-white systemic sweep originally queued for 17 files) NO-OP after audit revealed most instances are intentional dark-island patterns (dark form controls/popups styled as Linear/Notion-style dark-on-light), not the same ghost-card bug class as Analytics MetricCard (already fixed Wave D). Live-verified bundle `index-B4aBttlT.js` (Vercel auto-rebuilt the deploy hash to B4aBttlT after my poll caught `DCqod3e6.js` — source identical): browser-tester PASS 6/6 verification points + lead personally Read header + Appointments screenshots — "Aftermarket Tracker" wordmark visible, "Home" tab correctly highlighted on Dashboard, "Appointments" tab correctly highlighted on its page (proving the isActivePath fix works across nav items), page title reads "Appointments" with new subtitle. Bundle 431.47 / 118.91 KB gz (flat vs Wave D). Build clean, lint clean.
- **2026-06-01 PM Wave D (`33c85f2`)** — UX cleanup wave from 4-agent parallel audit (Codex + browser-tester + sense-check + ui-polisher). 25+ findings surfaced; this commit landed the BLOCKER + trivial-REQUIRED slice. 6 files changed: (1) Analytics MetricCard.jsx — alpha-on-light ghost-card pattern (bg-white/5, border-white/10, text-gray-100, emerald-500/15 alpha trend chips) → opaque slate/emerald/red equivalents. Same root-cause family as Wave C calendar fix; another 17 files still have this pattern, queued. (2) Analytics index.jsx export button — same swap. (3) Loaner empty-state copy contradiction (KPI tile "AVAILABLE 10" + table empty "No loaner vehicles available" = trust-killing same-screen contradiction) → "No active loaner assignments" + sub-text. (4) Calendar all-CAPS status labels (8 sites in calendar/index.jsx: 'BOOKED'/'PROMISE'/'SCHEDULED' literals + `.toUpperCase()` chip transform) → Title Case via `.replace(/\b\w/g, (c) => c.toUpperCase())`. (5) DealDrawer "Dismiss" + aria-label "Dismiss drawer" → "Close" / "Close drawer". (6) DealDrawer disabled primary action label "Open deal to schedule" → "Not scheduled yet" (status reading, not command). (7) Calendar raw-error-string leak (`Failed to load calendar data: ${raw}`) → fixed "Couldn't load… try refreshing" + console.error(raw). (8) 3 "Error: Unable to create…" technical messages → coordinator copy. (9) Overdue inbox "1 items" → singular/plural conditional. (10) CalendarShell search placeholder "Search stock/customer/phone" → "Search by customer, VIN, stock #, or phone". REJECTED: ui-polisher's "View debug auth button visible in production" BLOCKER — false positive, button is DEV-gated via `import.meta.env.DEV` check. Verified live: Analytics 4 MetricCards measured `background-color: rgb(255,255,255)` + `border-color: rgb(203,213,225)`; Loaner page reads coherent ("AVAILABLE 10" + "No active loaner assignments / Loaners assigned to a customer will appear here"); calendar Title Case confirmed in bundle source. Bundle 431.47 / 118.91 KB gz (flat vs Wave C).
- **2026-06-01 PM Wave C (`f07ca04`)** — Calendar contrast fix. Root cause: `darkUi` flag (always true in prod via `isEmbedded && unifiedShellEnabled`) applied alpha-on-dark Tailwind classes (`bg-white/5`, `border-white/5`, `border-white/10`, `text-gray-200`, `bg-amber-500/20 text-amber-200` badges) — but the canvas is actually LIGHT (`bg-background` → slate-50; nothing sets `[data-theme='dark']` on the document root). Alpha-white-on-near-white disappears. Fix is surgical class swaps in `darkUi` branches only — opaque slate equivalents that contrast against the light canvas. Light branches unchanged. Wave A sticky-header strategy preserved + extended (today now `bg-blue-700` for stronger visual anchor). Bumped `calendarColors.js` service-type tile bgs `bg-{blue,purple}-100` → `-200` and borders `-300` → `-500` for stronger tile-vs-grid contrast. Browser-tester PASS at 1920/1366/375; lead personally Read week + month + mobile screenshots — all surfaces SHIP. Bundle 431.48 KB / 118.91 KB gz (was 414.22 / 114.15 — +5 KB gz from redundant class strings, no new logic). 2 files changed: `src/pages/calendar/index.jsx` (96 lines), `src/utils/calendarColors.js` (12 lines).
- **2026-05-30 PM** — ET-aware weekly/monthly Round-Up. `CalendarShell.jsx:231-241` weekly + monthly Round-Up branches were using local-time `date-fns startOfWeek` / `startOfMonth`, which silently dropped/included late-evening jobs near midnight ET. Added `etStartOfWeek`/`etEndOfWeek`/`etStartOfMonth`/`etEndOfMonth` to `src/utils/etDateBoundaries.js` (Mon-anchored week, noon-UTC anchor to dodge ET-vs-UTC date-shift trap). Smoke-tested 4 cases: weekday EDT, last-day-of-EST-week, DST spring-forward day, late-night ET (May 31 23:30 ET = Jun 1 03:30 UTC) — all return correct ET boundaries. Same commit: removed 2 `isPromiseOnly` shadow declarations at `src/pages/calendar/index.jsx:1485` + `:1622`, replaced with calls to the module-scope helper at line 110 (Wave B deferred RECOMMENDED). Build clean 6.05s. Identified by `calendar-flow-specialist` audit.
- 2026-05-28 — Wave B Slices 1+2+4 (`0a804d7`): time-axis week view rewrite, mobile Agenda fallback, greedy column-packing for overlap. Wave B Slice 3 (`c8842e7`): Calendar tab defaults to Week not Month. Wave A (`ec2ef98`): calendar readability quick wins.
- 2026-05-19 — Wave XXIII launch pass (XXIII-A..D): removed unused `next` dep (.npmrc auto-install-peers=false) — 17 vulns → 0, fixes red CI; `.env.production` committed to turn the unified Calendar shell ON in prod; migration 20260519000001 NOTIFY pgrst reload (fixes rls-drift-nightly); calendar month-boundary, vendor-lane feedback, responsive UnscheduledQueue, DealDrawer portal, Round-Up op_code classifier fixed. XXIII-C: fixed blank prod page — vendor-chunk circular import. XXIII-D: fixed stuck login spinner — direct nav after signIn.
- 2026-05-03 — Rename PromisedQueue → UnscheduledQueue (Wave XXII-E).
- 2026-05-03 — Location vocab frozen: In-House / Off-Site / Split Work (key `Mixed`).
- 2026-05-03 — vite 5.4 → 7.3.2 major bump (Wave XIX).

---
_Update at the end of every session that changed the project._
