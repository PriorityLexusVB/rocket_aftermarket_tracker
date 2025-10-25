# Priority Automotive — AI coding instructions

Use these project-specific rules to move fast without breaking conventions.

## Stack and run

- React 18 + Vite + TailwindCSS + Supabase (Auth/Postgres/Storage); charts via Recharts; motion via Framer Motion.
- Dev: pnpm start (http://localhost:5173) · Build: pnpm build → dist/ · Preview: pnpm serve · Tests: pnpm test · E2E: pnpm e2e.
- Vercel is configured as SPA: see `vercel.json` rewrites; CSP headers are defined there.
- Code split is defined in `vite.config.mjs` manualChunks: `react`, `router`, `supabase`.

## Architecture and boundaries

- Pages live under `src/pages/**` (e.g., `deals`, `admin`, `calendar`). Router in `src/App.jsx`/`src/Routes.jsx`.
- All DB I/O stays in `src/services/**` using the singleton client in `src/lib/supabase.js`. Do not import Supabase in components.
- Auth/session: `src/contexts/AuthContext.jsx` loads `user_profiles` and exposes `{ user, userProfile, signIn, signOut }`.
- Dropdowns pattern: `src/services/dropdownService.js` returns option-shaped arrays `{ id, value, label }` (products include `unit_price`). Fuzzy fallback if exact department filter is empty. Dropdowns are unscoped by default.
- Multi-tenant scoping: prefer `src/services/tenantService.js` with `orgId` from `useTenant()`; avoid DB helper functions for scoping.

## Deal Form contract (source of truth)

- File: `src/pages/deals/DealForm.jsx`.
- Fields: Deal/Job number, Stock number, Customer Mobile, Vendor, Sales, Finance, Delivery, Description.
- Line items: add/remove; product selection auto-fills `unit_price`; per-line fields: `promised_date`, `requires_scheduling` (or `no_schedule_reason`), `is_off_site`.
- Native inputs/selects/checkboxes only (mobile UX); checkboxes use `accent-blue-600 appearance-auto`. On/Off-Site are radio tiles with visible highlight.
- Submit payload mirrors phone into both `customer_phone` and `customerPhone`; line items use snake_case to match `job_parts`.
- Save flow: if `onSave` is passed, call it; otherwise use `dealService.createDeal/updateDeal`. Mapping lives in `src/services/dealService.js` (`mapFormToDb`, `mapDbDealToForm`).

## Data model and joins (used by services)

- `jobs` (aka deals): `job_number`, `vendor_id`, `assigned_to`, `finance_manager_id`, `delivery_coordinator_id`, `customer_needs_loaner`, scheduling/cost fields, optional `org_id`.
- `job_parts`: `product_id`, `quantity_used`, `unit_price`, `promised_date`, `requires_scheduling`, `no_schedule_reason`, `is_off_site`.
- Related: `products`, `vendors`, `user_profiles`, `loaner_assignments`, `transactions` (customer + total).
- `dealService.deleteDeal` uses RPC `delete_job_cascade`; reads/writes are standard table queries (no RPC dependency).

## Testing and selectors

- E2E tests live in `e2e/*.spec.ts` (Playwright). Components expose stable `data-testid` (see `DealForm.jsx`) used by specs like `deal-form-dropdowns.spec.ts`.

## Styling and other gotchas

- Keep all CSS `@import` statements at the top of `src/styles/tailwind.css` (Vite CSS requires imports first). Global tokens live in `src/styles/index.css`.
- Options helpers: `src/lib/options.js` maps rows to `{ id,value,label }`. Safe querying via `src/lib/supabase/safeSelect.js`.
- Supabase env vars are required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Note: `VITE_ORG_SCOPED_DROPDOWNS` is deprecated/ignored.

Quick self-checks before you ship:

1. Dropdowns populate staff/vendors/products; products include `unit_price` for auto-fill.
2. Line items enforce: if `requires_scheduling` is false, `no_schedule_reason` is required.
3. On/Off-Site radio tiles visibly highlight; checkboxes show ticks.
4. New deal save → reopen edit: values (incl. line items) persist via `dealService` mapping.

If anything here feels off or incomplete (e.g., additional fields you see in `jobs`/`job_parts`, or new tenant flags), tell me what to clarify and I’ll tighten these rules.

## Dev tasks (VS Code)

- Provision DB + Seed + Start (local): runs migrations, seeds org data, then starts the app.
- DB: Push migrations → `pnpm run db:push`.
- DB: Seed org data → `pnpm run db:seed-org`.
- App: Start → `pnpm start` (http://localhost:5173).

Optional quick commands:

- `pnpm test` (Vitest), `pnpm e2e` (Playwright), `pnpm serve` (preview build).

## Examples (quick reference)

- Dropdown option shape: products → `{ id, value, label, unit_price }` (see `dropdownService.getProducts`).
- Common test ids: `vendor-select`, `product-select-0`, `requires-scheduling-0`, `save-deal-btn` (see `DealForm.jsx`).
- Tenant lists: prefer `listStaffByOrg(orgId)`; `dropdownService` provides unscoped lists (see `useDropdownData`/`DealForm`).
