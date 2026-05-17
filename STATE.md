# STATE — rocket_aftermarket_tracker

> Per-repo memory file. The repo's single source of truth for "where is this project."
> Rewrite to current truth each working session — do NOT append session logs.

**Last updated:** 2026-05-16 · **By:** HOME PC / Claude · **HEAD:** `7ca074a`

---

## What this is
Calendar-based aftermarket/service-department job and appointment management app for
Priority Lexus — schedule, track, and round up aftermarket jobs across vendors.

## Stack (frozen)
React 18 + Vite 7 + Tailwind 3 + Redux Toolkit + React Query. Supabase (Auth/Postgres/
Storage) backend. Twilio SMS via Supabase edge functions (`processOutbox`, `twilioInbound`).
pnpm 10.15.0, Node 20. Hosted on Vercel.

## Current state — is it live?
- Deployed: yes — Vercel (production URL `<unknown — confirm Vercel project URL>`)
- Last shipped: Wave XXII-G — clarity-auditor RECOMMENDEDs cleared (2026-05-03)
- Build/CI: green on HEAD `7ca074a`. Build ~6s, vendor-icons 22.00 kB.
- Auto-deploy: Vercel native GitHub integration on push to `main`. (Note: the
  `deploy-vercel.yml` workflow is `workflow_dispatch`/manual — the auto path is
  Vercel's own git integration, not that workflow.)

## What works (trustworthy)
- Calendar Board (week/month, job cards, overdue ring, location pills)
- Flow Management Center — VendorLaneView lanes, UnscheduledQueue, RoundUpModal
- Active Appointments deal sheet with bulk ops
- Dashboard — GP profit rows, overdue counts
- Round-Up CSV/Copy export (matches BDC tracking workbook format)
- Test suite: 1073/1073 passing (1 known flaky — `dealsPage.completeAutoReturnsLoaner`,
  re-run clears)

## What is NOT trustworthy yet
- Twilio SMS outbound is built but **not production-registered** — Trust Hub Brand
  registration is incomplete (see open loops). Outbound SMS may not deliver until done.
- 1 flaky test masks no known bug but is not a clean signal — treat as noise, monitor.
- Production Vercel URL not recorded here — confirm before relying on it.

## Open loops (close or kill before new builds)
- [ ] **Twilio Trust Hub Brand registration** — ~10 min Rob manual action in Twilio console
- [ ] **PR #340** (Dependabot 26-bump, tar CVE) — recommend close
- [ ] **2 stale Dependabot alerts** (postcss + vite) — dismiss as Already Fixed
- [ ] Deferred sense-check items (advisory, not blockers): dual calendar nav conflict
      (shell bar + in-page arrows); legacy-mode gradient header on Active Appointments;
      unlabeled "RG" column in Sheet View

## Credentials / access needed
- Supabase — have it; project keys in `.env` (test + prod via `sb:link` scripts).
  Canonical encrypted copy: `OneDrive/claude-sync/env-vault/`
- Twilio — have account; Trust Hub Brand registration still pending (open loop above)
- Vercel — connected; deploy uses `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID`
  GitHub secrets for the manual workflow

## Next 3 actions
1. Rob completes Twilio Trust Hub Brand registration (~10 min) — unblocks SMS delivery
2. Close PR #340 and dismiss the 2 stale Dependabot alerts (postcss + vite)
3. Record the production Vercel URL into this file (replace `<unknown — confirm>`)

## Decisions log (newest first)
- 2026-05-03 — Rename PromisedQueue → UnscheduledQueue (Wave XXII-E) — canonical vocab
- 2026-05-03 — Location vocab frozen: In-House / Off-Site / Split Work (internal key `Mixed`)
- 2026-05-03 — vite 5.4 → 7.3.2 major bump (Wave XIX) — closes last moderate vuln
- 2026-05-02 — Revoke baseline anon writes on 6 internal tables (Wave XVIII-A) — RLS hardening

---
_Update at the end of every session that changed the project._
