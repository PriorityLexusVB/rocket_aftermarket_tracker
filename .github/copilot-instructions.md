# Rocket Aftermarket Tracker — AI agent quickstart

Use these repo-specific rules so agents can contribute safely and fast.

## Stack and run

- React 18 + Vite + TailwindCSS + Supabase (Auth/Postgres/Storage). Charts: Recharts; motion: Framer Motion.
- Dev: pnpm start (http://localhost:5173) · Build: pnpm build → dist/ · Preview: pnpm serve · Unit: pnpm test · E2E: pnpm e2e.
- Vercel SPA: rewrites + CSP in `vercel.json`. Code-split in `vite.config.mjs` via manualChunks (`react`, `router`, `supabase`).

## Architecture and boundaries

- Routing: `src/App.jsx` + `src/Routes.jsx`; pages under `src/pages/**` (e.g., `deals`, `admin`, `calendar`).
- Data layer: all Supabase I/O in `src/services/**` using singleton client `src/lib/supabase.js` and `src/lib/supabase/safeSelect.js`. Never import Supabase in components.
- Auth/session: `src/contexts/AuthContext.jsx` loads `user_profiles` and exposes `{ user, userProfile, signIn, signOut }`.
- Multi-tenant: prefer `src/services/tenantService.js` with `orgId` from `useTenant()`; dropdowns default to unscoped with smart fallbacks.

## Dropdowns (performance and UX)

- Source: `src/services/dropdownService.js`. Options are `{ id, value, label }`; products also include `unit_price`.
- Caching: in‑memory TTL (~5 min) + prefetch on app mount (`prefetchDropdowns()` in `src/App.jsx`).
- Deal form synthesizes selected options so values render immediately before fetch completes; product change auto-fills `unit_price` via a `productMap`.

## Deal form contract (source of truth)

- File: `src/pages/deals/DealForm.jsx`. Fields include: job_number, stock_number, customer_mobile, vendor_id, assigned_to, finance_manager_id, delivery_coordinator_id, description.
- Line items: `product_id`, `quantity_used`, `unit_price`, `promised_date`, `requires_scheduling` (else require `no_schedule_reason`), `is_off_site`.
- Save flow: if `onSave` provided use it; otherwise call `dealService.createDeal/updateDeal`. Mapping lives in `src/services/dealService.js` (`mapFormToDb`, `toJobPartRows`, `mapDbDealToForm`).
- UI patterns: native inputs/selects; checkboxes use `accent-blue-600 appearance-auto`; On/Off‑Site is a radio‑tile pair with visible selection.

## Data model and service notes

- Tables: `jobs` (core deal fields incl. `finance_manager_id`, optional `org_id`) and `job_parts` (per‑line scheduling fields). Related: `products`, `vendors`, `user_profiles`, `loaner_assignments`.
- `dealService.deleteDeal` uses RPC `delete_job_cascade`; other reads/writes are standard table queries.
- `toJobPartRows` writes only columns that exist; `total_price` is computed server‑side (don’t send).

## Tests and selectors

- E2E: `e2e/*.spec.ts` (Playwright). Stable `data-testid` in `DealForm.jsx` (e.g., `vendor-select`, `product-select-0`, `requires-scheduling-0`, `save-deal-btn`).
- Playwright uses `e2e/storageState.json` by default; optional env login via `E2E_EMAIL`/`E2E_PASSWORD`.

## Environment and CI/CD

- Required env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. The old `VITE_ORG_SCOPED_DROPDOWNS` flag is ignored.
- Local DB flows: `pnpm run db:push` (migrations), `pnpm run db:seed-org` (seed). E2E seed: `pnpm run db:seed-e2e` with `DATABASE_URL`.
- Vercel auto‑deploys from `main`; CI workflow runs build, tests, and optional seeds (see `README.md`).

## Quick references

- Options helper: `src/lib/options.js` maps rows → `{ id, value, label }`.
- Tenant lists: `tenantService.listStaffByOrg(orgId)`; dropdowns fallback to global staff/product/vendor lists with safe filters.
- Code examples: see `DealForm.jsx` synthetic option seeding and `productMap` for unit_price auto‑fill.
