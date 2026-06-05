# Deal Lifecycle Redesign

**Status:** LOCKED (2026-06-05) — implementation shipped HEAD pending commit
**Author:** Lead orchestrator (WORK PC)
**Reviewers:** calendar-flow-specialist · site-researcher · adapter-engineer · Codex (3 rounds) · release-auditor · result-verifier
**Files touched (actual):** 1 new migration + 1 new utility (`jobStatusNormalize.js`) + 25 modified files (services, edge fn, UI consumers, dashboard, tests)
**Created:** 2026-06-05

---

## 1. Why this feature exists

Today the rocket_aftermarket_tracker `job_status` enum has **9 values** with a strict transition trigger that has caused 3 production incidents in the last 4 months. Rob (GSM) clarified the real mental model:

> Sell product → schedule if necessary → complete. Pending counts immediately. If something falls through, reverse it. That's it.

The current 9-value enum encodes a workflow nuance (`quality_check`, `delivered`, `no_show`, `draft`, `cancelled`) that nobody using the app actually needs at the data-model level — most of it is either cosmetic (`delivered` vs `completed`) or operationally redundant (`cancelled` vs `no_show` vs a future `reversed` all mean "the sale fell through, take it out of count").

The schema lies to itself. The mismatch:
- causes the strict transition trigger to block valid coordinator actions (Wave XXX-A/XXX-B/XXX-S incidents)
- forces a `jobsJobStatusSupportsDraft` capability-detection dance in `dealCRUD.js` (~80 LOC of dead-eligible code)
- creates drift between `calendarService.js` lines 160 / 466 / 542 (3 different exclusion lists with slightly different statuses)
- forces every UI consumer to maintain its own status-to-badge mapping

## 2. What the feature is FOR

Match the data model to how the dealership actually runs deals: **a deal counts the moment it's sold; if it falls through, reverse it with a documented reason.**

## 3. Candidate definitions / approaches

| Candidate | What it rewards | Failure mode | Cost |
|---|---|---|---|
| **A. Status quo (9 values)** | Granular workflow tracking | Schema drift, trigger incidents, dead code, UI maintenance burden | $0 to ship; ongoing cost to maintain |
| **B. Minimal collapse (8 values, drop `delivered`)** | Smallest change, less risk | Doesn't fix the underlying mismatch; `cancelled`/`no_show`/`quality_check`/`draft` all still confused | Low |
| **C. Rob's 5-state collapse + reversal audit (RECOMMENDED)** | Matches real mental model; eliminates 3 incident sources; clears dead code; clarifies accounting | Loses `quality_check` as distinct status (mitigated by timestamp); requires migration; touches ~48 files | Medium |
| **D. Two orthogonal fields (job_status + lifecycle_state)** | Cleanest architectural separation (Ashley's calendar workflow vs Rob's sales lens) | More columns, more code, harder migration | High |
| **E. Drop the enum entirely, use TEXT** | Max flexibility | Loses type safety, defeats the point of normalization | Low effort, high regret |

## 4. Behavior each candidate rewards

| Candidate | What the user learns to do |
|---|---|
| A | "Click through 6 statuses, hit transition errors, ask why" |
| B | "Same as A but slightly less" |
| **C** | "Sell it (counts), schedule it if needed, complete it. If it falls through, reverse it with a reason." |
| D | Same as C functionally, but coordinators see 4 fields where they only need to think about 2 |
| E | "Anything goes — and then nothing makes sense" |

## 5. Success metric

After Wave A (this doc) ships:
- Zero PostgREST 400 errors on status writes (today's strict trigger throws regularly)
- `jobsJobStatusSupportsDraft` capability dance + retry logic deleted (~80 LOC)
- Dashboard "today's units" KPI matches GSM's mental model in real time
- Monthly RoundUp export shows `gross / reversals / net` separately
- Zero `quality_check` / `delivered` / `cancelled` / `no_show` / `draft` enum values remain in DB

## 6. Schema reality check (what data we can trust today)

Verified via 4-agent recon at HEAD `630e8e9`:

| Data | Trustable? |
|---|---|
| `job_status` enum (9 values live in DB) | YES — but bloated |
| `validate_status_progression()` SQL fn (in `20260525000100`) | YES — but to be rewritten |
| `validate_job_status_change()` trigger | YES — to be DROPPED |
| `validate_vendor_job_scheduling()` trigger (XXX-S) | YES — to be UPDATED |
| `get_overdue_jobs()` RPC (XXX-U, ET-day boundary) | YES — exclusion list to be UPDATED |
| `check_vehicle_overlap()` (vehicle double-booking guard) | YES — status list to be UPDATED |
| Existing `deal_date` / `scheduled_start_time` / `completed_at` columns | YES — frozen-month math anchors here |
| `service_appointments.status` (separate enum!) | YES — DO NOT collapse this; it's a different table |
| `photos.stage` (uses `'quality_check'` as a value!) | YES — DO NOT migrate this; not job_status |
| Live row distribution by `job_status` | ❓ NEEDS LIVE QUERY (BLOCKER) |

## 7. Lead recommendation: **Candidate C — 5-state collapse with QC-as-timestamp**

### Final enum (5 values)

```
pending       ← SOLD. counts. default on creation
scheduled     ← on calendar. counts
in_progress   ← work happening. counts
completed     ← done. counts. terminal happy
reversed      ← sale fell through. subtracted. terminal. requires reason
```

### Migration map

| Retired | Becomes | Why |
|---|---|---|
| `delivered` | `completed` | Codex + calendar-flow-specialist confirm: purely cosmetic distinction in current code; both already in `TERMINAL_STATUSES`, both excluded from RoundUp, both labeled "Done" |
| `cancelled` | `reversed` | Same operational meaning: "the sale didn't stick" |
| `no_show` | `reversed` + `reversed_reason: 'No-Show'` | Preserves operational distinction in audit/reporting via reason field; QuickFilter chip recolors to filter on reason, not status |
| `quality_check` | `in_progress` + `quality_checked_at TIMESTAMPTZ` | Codex's insight: status collapse but PRESERVE QC as a timestamp event. DealDrawer's "Move to Quality Check" button writes the timestamp, not a status. Audit trail intact, no transition workflow lost |
| `draft` | `pending` | `calendarService.js` already treats them interchangeably; deletes the capability dance |

### Reversal audit (new columns on `jobs`)

```sql
reversed_at         TIMESTAMPTZ  NULL
reversed_by         UUID         NULL  REFERENCES auth.users(id) ON DELETE SET NULL
reversed_reason     TEXT         NULL
pre_reverse_status  job_status   NULL  -- captured automatically on transition into reversed
quality_checked_at  TIMESTAMPTZ  NULL  -- replaces quality_check status; preserves audit
```

### Reversal enforcement trigger

```sql
CREATE TRIGGER enforce_reversal_audit_trigger
  BEFORE UPDATE OF job_status ON jobs
  FOR EACH ROW EXECUTE FUNCTION enforce_reversal_audit();
```

Function raises if `reversed_at` / `reversed_by` not set on transition into `reversed`. Auto-captures `pre_reverse_status = OLD.job_status`.

### Frozen-month accounting (locked — option B)

A deal sold Oct 28, reversed Nov 3:
- **October frozen count = 1** (the deal `canonical_date` is in October)
- **November shows the −1 reversal** as a separate line item in monthly reporting
- Joe's October commission paystub stays intact; chargeback (if any) hits November

```sql
-- Units for month N (frozen-month semantics)
SELECT
  COUNT(*) FILTER (WHERE job_status != 'reversed') +
  COUNT(*) FILTER (
    WHERE job_status = 'reversed'
      AND DATE_TRUNC('month', reversed_at AT TIME ZONE 'America/New_York')
          != DATE_TRUNC('month', canonical_date AT TIME ZONE 'America/New_York')
  ) AS units_for_month
FROM jobs
WHERE DATE_TRUNC('month', canonical_date AT TIME ZONE 'America/New_York')
      = DATE_TRUNC('month', :month_start AT TIME ZONE 'America/New_York')
```

Reporting separates **gross / reversals / net** per month (Codex's insight — "managers and salespeople will never agree what October was" if it's retroactive):

```
Oct: gross 14 · reversals this month 0 · net 14
Nov: gross 12 · reversals this month 1 (from Oct sale) · net 11
```

### Drop the strict transition trigger

`validate_job_status_change()` trigger → **DROP**. Three production incidents in 4 months (XXX-A, XXX-B, XXX-S). Error message has no UI surface — appears as raw PostgREST 500. Trust the app.

Keep `validate_status_progression(text, text)` standalone function — app calls it client-side for UI gating. Rewrite for 5-state graph:

```sql
CREATE OR REPLACE FUNCTION validate_status_progression(current_status text, new_status text)
RETURNS boolean LANGUAGE sql STABLE AS $$
SELECT CASE
  WHEN new_status = 'reversed'    THEN true  -- reversed reachable from ANY state
  WHEN current_status = new_status THEN true
  WHEN current_status = 'pending'     AND new_status IN ('scheduled','in_progress') THEN true
  WHEN current_status = 'scheduled'   AND new_status IN ('in_progress','completed') THEN true
  WHEN current_status = 'in_progress' AND new_status IN ('completed','scheduled') THEN true
  ELSE false
END;
$$;
```

### `validate_vendor_job_scheduling()` trigger update

Remove `quality_check` and `delivered` from the hardcoded status list. Final list: `('scheduled','in_progress','completed')`. `reversed` should NOT be in this list — reversed jobs are terminal, vendor scheduling irrelevant.

### Stale-pending watchdog (Wave B, deferred)

Dashboard surface: "N deals pending >14 days, no calendar activity — review." Threshold defaulted to 14 days (calendar-flow-specialist STATE shows aftermarket jobs do go that long sometimes). Rob can confirm or push to 7. Defer to Wave B to keep enum collapse focused.

### Reverse RPC (with Rule-16 grant justification)

```sql
CREATE OR REPLACE FUNCTION reverse_deal(p_deal_id UUID, p_reason TEXT)
RETURNS jobs LANGUAGE plpgsql SECURITY DEFINER AS $$ ... $$;

REVOKE EXECUTE ON FUNCTION reverse_deal(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION reverse_deal(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION reverse_deal(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION reverse_deal(uuid, text) TO service_role;
```

**Rule 16 justification:**
> Sentence 1: Only the authenticated coordinator/manager UI calls this — the Reverse button is behind a protected route requiring a valid session JWT; no anon path exists.
> Sentence 2: The function writes `job_status = 'reversed'` + audit fields on a `jobs` row scoped to the caller's org — financial/operational data, must never be reachable by unauthenticated requests.

## 8. Open questions for Codex (resolved in §10)

A. Is `quality_check` load-bearing for Ashley/Sam's workflow?
B. `getReopenTargetStatus()` bug confirmation
C. Frozen-month vs retroactive
D. Twilio cancel SMS branch failure mode
E. Postgres ENUM cleanup path
F. RoundUp export `completed` vs `delivered` distinction
G. 2 failure modes the lead missed
H. Stale-pending watchdog threshold
I. Effort honesty
J. PR order

## 9. Codex adversarial pass (run logs `codex-20260605-094005.md` + `codex-20260605-094134.md`)

**Convergence with the agent lineup:**
- A — QC: collapse safe ONLY IF preserved as timestamp/event. **Adopted: `quality_checked_at` column added.**
- B — getReopenTargetStatus: CONFIRMED post-migration runtime bug. Single-line fix to `'in_progress'`. **Adopted.**
- C — Frozen-month: PROCEED, with separated `gross / reversals / net` reporting. **Adopted both halves.**
- D — Twilio SMS BLOCKER: customer SMS "cancel" reply writes raw `cancelled` today; under new model must write `reversed` + `reversed_at` + `reversed_reason: 'Customer replied cancel by SMS'` + null `reversed_by` (or system user UUID). **Adopted; explicit fix in build order.**
- E — ENUM cleanup: Option α (new enum, swap, drop old) — adapter-engineer + Codex converge. **Adopted.**
- F — RoundUp: `completed` vs `delivered` distinction is purely cosmetic in the exported CSV (no status column). Safe to collapse. **Confirmed.**
- G — **2 new failure modes Codex surfaced:**
  - **(NEW) Hardcoded write surfaces**: `BulkOperationsPanel.jsx:38/58` writes `quality_check`/`cancelled`; `JobScheduleModal.jsx:286` still offers retiring values; `DealDrawer.jsx:275` writes `no_show`. **If migration ships first, these are runtime 400/invalid enum.** Mitigation: site-researcher's `normalizeJobStatus()` utility covers READS; WRITES need explicit update in Phase 1.
  - **(NEW) kanbanService transition map stale**: `kanbanService.js:134` calls `validate_status_progression` RPC; lines 351-357 still expose old transitions. **If DB trigger dropped but JS validation stays strict, Kanban remains stale.** Mitigation: update both layers in same wave.
- H — Watchdog threshold: Codex didn't argue, defaults to 14d.
- I — Effort honesty: ~4-6 hrs Wave A (enum + audit + UI + math); Wave B (watchdog + monthly net display) ~3 hrs.
- J — PR order: site-researcher's `normalizeJobStatus()` pre-PR is OPTIONAL safety net; primary order is **schema migration FIRST** (adds `reversed`, audit columns, drops trigger), then **all code surfaces in one PR** (read normalization + write updates + Twilio fix + getReopenTargetStatus fix). Single Wave A PR.

**Final verdict (both Codex rounds + 3 agents):** PROCEED-WITH-MOD.

## 10. Rob's decision — LOCKED 2026-06-05

Rob's directive: "use the agents and codex to confirm - then execute." All 5 forks resolved with their adopted answers; build wave executed autonomously following confirmation.

### Fork 1 — QC-as-timestamp pattern — **ADOPTED ✓**
Collapsed `quality_check` status → `in_progress`. Added `quality_checked_at TIMESTAMPTZ` column on jobs. DealDrawer's "Move to Quality Check" button rewritten as `markQualityChecked` — writes timestamp + keeps `job_status='in_progress'`. Bulk QC button in `BulkOperationsPanel.jsx` rewritten same pattern via `bulkMarkQualityChecked` method on `appointmentsService`.

### Fork 2 — `cancelled` / `no_show` data mapping — **CONSERVATIVE BACKFILL ADOPTED ✓**
Live DB query was not available without interrupting build flow. Conservative path adopted: any retired-status row gets `reversed_at = COALESCE(updated_at, created_at)`, `reversed_reason = 'historical:cancelled'` or `'historical:no_show'`, `pre_reverse_status = <original value as TEXT>`. Safe at 0 rows OR N rows.

### Fork 3 — stale-pending watchdog threshold — **DEFERRED TO WAVE B**
14 days locked in design intent for Wave B (Rob can override at Wave B planning).

### Fork 4 — drop the strict transition trigger — **ADOPTED ✓**
`validate_job_status_change()` function and `validate_job_status_progression` trigger both DROPPED. `validate_status_progression(text, text)` standalone function REWRITTEN with 5-state graph for client-side use (kanbanService transitions map mirrors).

### Fork 5 — Wave A vs Wave A+B — **SPLIT ADOPTED ✓**
**Wave A SHIPPED** (this implementation): enum collapse + audit columns + frozen-month KPI math + Twilio fix + DealDrawer QC-timestamp + DealDrawer No-Show via reverse_deal + BulkOperationsPanel signals + dashboard org-scoped query.
**Wave B QUEUED**: stale-pending watchdog Dashboard surface + monthly gross/reversals/net detailed display + Kanban column reorg polish + QuickFilter reason-based sub-chips for reversed.

---

## 11. Build order — EXECUTED 2026-06-05

**Phase 1-7 SHIPPED.** Line refs below are pre-edit planning estimates — actual post-implementation locations may shift. Verify via `git log -p <commit>` for forensic detail.


**Phase 1 — Schema migration (1 file, careful)**
1. CREATE new enum `job_status_v2` with 5 values
2. Add columns: `reversed_at`, `reversed_by`, `reversed_reason`, `pre_reverse_status`, `quality_checked_at`
3. Data migration: UPDATE all rows mapping retired statuses → new (with historical reason backfill if Fork 2 needs it)
4. ALTER COLUMN type swap with USING cast
5. DROP TYPE old, RENAME new to `job_status`
6. DROP `validate_job_status_change()` trigger
7. CREATE `enforce_reversal_audit()` trigger
8. REWRITE `validate_status_progression()` function (5-state graph)
9. REWRITE `validate_vendor_job_scheduling()` function (remove `quality_check`/`delivered`)
10. REWRITE `get_overdue_jobs()` RPC (new exclusion list, preserve grants per pitfall #4)
11. REWRITE `check_vehicle_overlap()` function (remove `quality_check`)
12. CREATE `reverse_deal(uuid, text)` RPC with Rule-16 grant pattern
13. Self-verifying DO block (assert 5 enum values, 0 rows with retired statuses, all columns exist)

**Phase 2 — Edge functions (1 file)**
14. `supabase/functions/twilioInbound/index.ts:221-263` — customer SMS "cancel" branch writes `reversed` + audit fields (BLOCKER per Codex)

**Phase 3 — Service layer (8 files)**
15. `src/utils/jobStatusTimeRules.js:94-100` — `getReopenTargetStatus` returns `'in_progress'` for completed (BLOCKER)
16. `src/services/scheduleItemsService.js:15-23` — `TERMINAL_STATUSES` set updated
17. `src/services/calendarService.js:160,466,542` — exclusion lists unified
18. `src/services/kanbanService.js:87,265,306,351-362` — RPC call + transition map (BLOCKER per Codex)
19. `src/services/jobService.js:354` — `completed_at` auto-clear list
20. `src/services/appointmentsService.js:142,210` — active-status lists
21. `src/services/deal/dealCRUD.js:346-423` — delete `jobsJobStatusSupportsDraft` dance (~80 LOC)
22. `src/services/deal/dealHelpers.js:70-75` — delete capability cache

**Phase 4 — UI consumers (15 files)**
23. `src/utils/jobStatusNormalize.js` — NEW utility (site-researcher recommendation)
24. `src/lib/time.js:180-228` — badge map collapse
25. `src/utils/calendarColors.js:40-62` — STATUS_OVERLAYS collapse
26. `src/components/calendar/DealDrawer.jsx:53-71,160-180,275` — color map + primary-action + No-Show button writes `reversed` + auto-fill reason
27. `src/pages/deals/components/DealPresentational.jsx:24-30` — StatusPill
28. `src/pages/kanban-status-board/index.jsx:59-72,126,258` — Kanban column merge (delivered→completed, qc→in_progress)
29. `src/pages/kanban-status-board/components/StatusUpdateModal.jsx:17-36` — radio options
30. `src/pages/calendar-scheduling-center/components/JobScheduleModal.jsx:282-290` — dropdown
31. `src/components/common/AdvancedFilters.jsx:29-36` — filter options
32. `src/pages/calendar-flow-management-center/index.jsx:471,613,1815` — undo branches + count
33. `src/pages/calendar-flow-management-center/components/QuickFilters.jsx:36` — "No-Show" chip becomes "Reversed" with reason filter
34. `src/pages/currently-active-appointments/components/BulkOperationsPanel.jsx:38,58` — bulk buttons (BLOCKER per Codex)
35. `src/pages/currently-active-appointments/components/FilterControls.jsx:34` — option
36. `src/pages/overdue-inbox/index.jsx:9,17-25` — exclusion + labels
37. `src/pages/deals/index.jsx:297,620` — undo + Needs Schedule filter

**Phase 5 — Dashboard math (1 file)**
38. `src/pages/dashboard/index.jsx:160` — frozen-month math wired (gross + reversals_in_month split)

**Phase 6 — Tests (5 files)**
39-43. Update test fixtures + assertions for new enum + reopen target

**Phase 7 — Verification lineup**
44. release-auditor (TS/build/bundle/migration replayability/anon-grant scope)
45. result-verifier (every status reference touched matches spec)
46. browser-tester (Manager + Rep personas, deals page, calendar, board, agenda, KPI counts)
47. Codex post-diff adversarial review

## 12. Effort estimate

| Phase | Hours |
|---|---|
| 1. Schema migration | 1.5 |
| 2. Twilio edge fn | 0.25 |
| 3. Services (8 files) | 1.5 |
| 4. UI (15 files) | 2.0 |
| 5. Dashboard math | 0.5 |
| 6. Tests | 0.5 |
| 7. Verification + fixes | 1.5 |
| **Total Wave A** | **~7-8 hrs** |
| **Wave B (watchdog + monthly net)** | ~3 hrs |

## 13. Cross-references

- `STATE.md` (repo root) — current state, HEAD `630e8e9`
- Agent reports: this session, lead reconciled
- Codex run logs: `~/OneDrive/claude-sync/notes/codex-runs/codex-20260605-094005.md`, `codex-20260605-094134.md`
- `~/.claude/rules/feature-design-doc.md` — this doc's authoring rule
- `~/.claude/rules/me-decision-analysis-first.md` — analysis loop ran
- `~/.claude/rules/codex-cross-check.md` — Codex pass mandatory; ran
- `~/OneDrive/claude-sync/memory/feedback_drop_create_strips_grants.md` — pitfall #4 (grant preservation on function recreate)
- `~/OneDrive/claude-sync/memory/feedback_migration_smoke_probe.md` — self-verifying DO block pattern
- `~/.claude/rules/multi-agent-protocol.md` Rule 6, 14, 15, 16 — all fire on this wave

---

## 14. Post-lock hotfix log (added 2026-06-05)

Per `feature-design-doc.md`: design docs are never rewritten in place, but reality drift after the LOCK header must be appended so future-Claude reads the doc as the doc reads the world. Wave XXX-V locked at HEAD `0b535a2`; this section records what shipped AFTER that lock.

### Wave XXX-V post-lock hotfix chain (same-day, all autonomous):
- `2eda850` (initial XXX-V feature + migration applied LIVE)
- `3690b6f` — Codex post-diff caught 4 issues. Fixed: `roundUpExport.js:262` retired-statuses exclusion list updated to `(completed,reversed)`; `StatusUpdateModal.jsx` removed `reversed` from generic dropdown (audit trigger correctly rejects raw status write without reason); `dashboard/index.jsx` frozen-month KPI math rewrote OR-query + JS split for cross-month reversals; `dashboard/index.jsx` added orgId null guard.
- `0b535a2` — Kanban drag-to-Reversed prompts for reason via `reverse_deal` RPC (Codex post-hotfix re-verify caught raw status write was bypassing audit trigger).
- `d3d6450` + `910ad52` — STATE close-out commits, no code.

### Wave XXX-W (next session, calendar-flow-specialist + Codex mega-sweep):
- `2eda850` Wave XXX-W phase 1: F-1 BLOCKER (No-Show dialog falsely said "you can recover by rescheduling" for now-terminal state — replaced with "permanently reverses, action cannot be undone"); D-1 LIVE BUG (CalendarGrid.jsx color map still referenced retired statuses + missing `reversed` — replaced with canonical 5-state map); F-7 dashboard polish (zero-reversal case collapsed to single "Deals this month: N" label); 2 residual cleanups for `DealDrawer.jsx:189` (no_show in showReschedule list) + `calendar-agenda/index.jsx:485` (draft/cancelled in excluded set) — these had been silently failing edits in prior session.
- `a970610` Wave XXX-W security migration: `reverse_deal` SECURITY DEFINER had no org-scope check (Codex hostile probe). Added cross-org guard via `auth_dealer_id()` resolver. New migration `20260605130000_wave_xxx_w_reverse_deal_org_guard.sql` applied LIVE via Management API.
- `9f4e16b` Wave XXX-W phase 2: F-2 reversed audit trail display in DealDrawer (red-bordered section showing reason/when/pre_reverse_status); F-3 QC button feedback toast + `quality_checked_at` timestamp row in Schedule section; F-5 general "Reverse Deal" button next to No-Show (window.prompt for reason — proper modal Wave B).
- `5a8cac5` Wave XXX-X (Codex strategic): stale-pending watchdog Dashboard tile (14d threshold from Fork 3, amber alert, renders only when count > 0) + Reversals KPI clickable deep-link.
- `eb03ec0` Wave XXX-W hotfix-3 (Codex final-sweep): 3 supabase error-swallowing bugs in DealDrawer (`.update()` and `.rpc()` don't throw — destructure `{ error }` and rethrow); migration TOCTOU defense (`AND dealer_id = v_caller_dealer` added to UPDATE WHERE).
- `e80c3de` Wave XXX-W hotfix-4 (frozen-month bug fix + regression test): extracted `calculateMtdFrozenKpi()` to `src/utils/frozenMonthKpi.js`. WRITING THE TEST EXPOSED A REAL BUG that all prior reviews missed — the Wave XXX-V dashboard math excluded reversed deals from earlier-month gross regardless of WHEN the reversal landed, breaking the frozen-month accounting model. Oct 28 sale reversed Nov 3 was showing Oct = 0 (wrong; should be frozen at 1). Fixed via cross-month preservation logic. 8/8 unit tests pass. Also tightened Reversals deep-link to `?createdMonth=YYYY-MM` so link semantics match the KPI label.
- `672af6d` Vitest 3.2.4 → 3.2.6 patch bump — clears 3 critical Dependabot CVEs (UI-server arbitrary file read/exec). Patch within 3.x, no 4.x major bump (separate dep-bump wave).

### Lessons:
1. **The cross-month frozen-month bug was a LATE catch.** 5 specialist + Codex rounds didn't surface it. The only way it became visible was extracting the math to a testable helper and writing the explicit "Oct sale reversed Nov, Oct view" test case. Lesson: financial-math regressions need explicit unit tests, not just adversarial code review.
2. **Silent edit failures from earlier session.** Two residual edits to `DealDrawer.jsx:189` (showReschedule list) and `calendar-agenda/index.jsx:485` (excluded set) reported successful from the Edit tool but didn't persist on disk. Both were re-applied as part of Wave XXX-W phase 1 with `sed` verification before commit. The lead-orchestrator should run `grep` verification AFTER `Edit` returns success but BEFORE commit, not trust the success message — this is in the standing multi-agent-protocol rule but bit me anyway.
3. **SECURITY DEFINER + RLS bypass.** Even with Rule 16 inline justification, the Wave XXX-V `reverse_deal` function lacked an explicit org check. The Codex hostile probe caught it; the 4 prior reviewers (calendar-flow-specialist + site-researcher + adapter-engineer + 3 Codex rounds) missed it because no review framing specifically asked "can this RPC be called cross-tenant?" Lesson: every new SECURITY DEFINER RPC needs an explicit "name your tenant guard" line in the design doc, not just "trusts auth context."
4. **Supabase JS client doesn't throw on error.** `.update()` and `.rpc()` return `{ data, error }` — must destructure or `if (error) throw`. I assumed throw on error 3 times in Wave XXX-W phase 2 + the Kanban path. Codex final-sweep caught all 3. Future builds touching supabase calls: always destructure error, always rethrow in try/catch. Standing rule worth promoting.
