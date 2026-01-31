# DC OS Master TODO — Rocket Aftermarket Tracker

This file is the single checklist for completing the Delivery Coordinator OS workflow.
Audience: Delivery Coordinators only. All users same access. No role gating in UI.

## Definition rules

- “Agenda-first” means queue-first workflow:
  - `/calendar` redirects to agenda when `VITE_SIMPLE_CALENDAR=true`
  - navbar Calendar must link to `/calendar` (never directly `/calendar/grid`)
- “Unknown profit” must render as `—` and never as `$0`.
- Analytics + Deals + Dashboard must share KPI definitions for the same dataset.

---

## ✅ Must-do (blocking)

### 1) Navbar calendar link

- [ ] `src/components/ui/Navbar.jsx` calendar link points to `/calendar` (not `/calendar/grid`)
- [ ] Verified by clicking Calendar in nav with `VITE_SIMPLE_CALENDAR=true` lands on agenda

### 2) Dashboard Open Opp KPI

- [ ] `src/pages/dashboard/index.jsx` pulls Open Opp summary from `opportunitiesService.getOpenOpportunitySummary()`
- [ ] Shows Open Opp $ and count
- [ ] Graceful fallback if table missing (shows `—`, no crash)

### 3) Dashboard reschedule flow

- [ ] Reschedule from Today queue goes to:
  - `/calendar/agenda?focus=<jobId>` when agenda enabled
  - else flow center (optional focus)

### 4) Calendar grid empty-state overlay

- [ ] `src/pages/calendar/index.jsx` shows empty-state overlay when no jobs in week
- [ ] Overlay includes: Open Agenda / Open Flow / Today buttons

### 5) Opportunities panel styling sanity

- [ ] Opportunities panel inputs/buttons match app styling
- [ ] No missing CSS class names in production

---

## Recommended improvements (non-blocking)

### 6) Products Sold definition is explicit

- [ ] If using line-items count → label says “Line Items Sold”
- [ ] If using quantity sum → label says “Units Sold”

### 7) Opportunities surfaced in more places

- [ ] Deals list shows opp badge/count
- [ ] Dashboard queue row shows opp badge
- [ ] Analytics shows lost opp + close rate (next wave)

---

## Verification gates (required)

- [ ] `pnpm -s guard:client-env`
- [ ] `bash scripts/mcp/supabase-mcp.sh --check`
- [ ] `pnpm -s verify` (must pass)

## TEST DB audit

- [ ] Paste `pnpm -s sb:migration:list:test | tail -n 40` into PR notes
- [ ] Confirm NO PROD migrations applied without explicit approval
