# Priority Automotive — AI Coding Instructions

## Stack & Commands
- React 18 + Vite, TailwindCSS, Supabase (Auth/Postgres/Storage), Recharts, Framer Motion.
- Dev: `npm run start` (http://localhost:5173) · Build: `npm run build` → `dist/` · Preview: `npm run serve`.
- Vercel: SPA rewrites via `vercel.json` (`rewrites: [{ "source": "/(.*)", "destination": "/" }]`).
- Bundle split in `vite.config.mjs` (`manualChunks`: `react`, `router`, `supabase`).

## Layout (key paths)
- `src/pages/**` feature pages (e.g., `deals`, `admin`, `calendar`).
- `src/services/**` Supabase I/O (use only `src/lib/supabase.js` client).
- `src/contexts/AuthContext.jsx` = auth/session source of truth.
- Global CSS: `src/styles/tailwind.css` + `src/styles/index.css`.
	- **Rule:** All `@import` lines must be the first lines in `src/styles/index.css`.

## Data Model (core)
- `jobs` ("deals"): `job_number`, `vehicle_id`, `vendor_id`, `assigned_to`, `finance_manager_id`,
	`delivery_coordinator_id`, `customer_needs_loaner`, dates, notes.
- `job_parts`: line items for a job (`product_id`, `quantity_used`, `unit_price`, `promised_date`,
	`requires_scheduling`, `no_schedule_reason`, `is_off_site`).
- `products`, `vendors`, `user_profiles` (RBAC via `department`/`role`), `loaner_assignments`.

## Service-Layer Pattern (do this)
- **All DB I/O happens in services.** Components must not import Supabase directly.
- `src/services/dropdownService.js` = single source of truth:
	- `getSalesConsultants()`, `getFinanceManagers()`, `getDeliveryCoordinators()` → from `user_profiles` by `department`.
	- `getVendors({ activeOnly })`, `getProducts({ activeOnly })` → return `{ id, value, label }`; products include `unit_price`.

## Deal Form — correct behavior
- File: `src/pages/deals/DealForm.jsx`.
- Present & persist: Deal/Job #, Stock #, Customer Mobile, Vendor, Sales, Finance, Delivery, Description.
- Line items: add/remove; selecting a product **auto-fills `unit_price`**; fields include `promised_date`,
	`requires_scheduling` (or `no_schedule_reason`), and `is_off_site`.
- Native inputs/selects/checkboxes only (mobile pickers). Use `accent-*` so ticks are visible.
- On-Site vs Off-Site uses radio tiles with a visible highlight.
- Submit payload mirrors phone into **both** `customer_phone` and `customerPhone`.
- Line items use **snake_case** for DB fields.
- If `onSave` prop exists: call it; otherwise call `dealService.createDeal/updateDeal`.

## Auth & Roles
- `AuthContext` wires Supabase Auth; `user_profiles` holds `department`/`role`.
- Staff dropdowns filter by department; prefer exact match, fuzzy fallback if empty.

## Gotchas
- Keep `@import` at the very top of `src/styles/index.css` (Vite CSS will error if not).
- Do not add Supabase calls in components; use services.
- Keep native form controls for mobile UX.

## Quick Checks (manual)
1) Dropdowns populate vendors/products/staff (options use `{ value, label }`).
2) Selecting a product auto-fills `unit_price`.
3) Checkboxes show ticks (`accent-blue-600 appearance-auto`).
4) On-Site/Off-Site tiles highlight selected.
5) Save a new deal → reopen in Edit → values persist (including line-items).

Tech & Build

Stack: React 18 + Vite, TailwindCSS, Supabase (Auth/Postgres/Storage), Recharts, Framer Motion.

Run: npm run start (5173), Build: npm run build → dist/, Preview: npm run serve.

Vercel: SPA rewrites via vercel.json (rewrites: [{ source: "/(.*)", destination: "/" }]), chunking in vite.config.mjs (manual chunks for react, router, supabase).

Project Layout (key paths)

src/pages/** feature modules (e.g., deals, admin, calendar).

src/services/** service-layer calls to Supabase (use only src/lib/supabase.js client).

src/contexts/AuthContext.jsx auth/session source of truth.

src/styles/tailwind.css + src/styles/index.css are global CSS.
Rule: in index.css, all @import lines MUST come first (avoids Vite CSS errors).

Data Model (core tables)

jobs (aka “deals”): job_number, vehicle_id, vendor_id, assigned_to, finance_manager_id, delivery_coordinator_id, customer_needs_loaner, dates, notes.

job_parts: line items for a job (product_id, quantity_used, unit_price, promised_date, requires_scheduling, no_schedule_reason, is_off_site).

products, vendors, user_profiles (RBAC via department/role), loaner_assignments (optional when loaner needed).

Service-Layer Patterns

Use the service layer for DB I/O. Example fetchers:

src/services/dropdownService.js (single source of truth):

getSalesConsultants(), getFinanceManagers(), getDeliveryCoordinators() → from user_profiles by department.

getVendors({ activeOnly }), getProducts({ activeOnly }) → mapped for <select> value/label.

Do not import Supabase ad-hoc in components—go through services to keep queries consistent and swappable.

Deal Form (what “correct” looks like)

File: src/pages/deals/DealForm.jsx

Inputs present & persisted: Deal/Job #, Stock #, Customer Mobile, Vendor, Sales, Finance, Delivery, Description.

Line items: add/remove; product → auto-fills unit price; Qty/Price editable; Promised Date; Requires Scheduling (or No Schedule Reason); On-Site vs Off-Site uses radio tiles with a visible highlight.

Checkboxes: native with accent-* so ticks are obvious on iOS/Android.

Submit path: preferred prop onSave(payload). Fallback calls dealService.createDeal / updateDeal.

Auth & Roles

Auth via AuthContext + Supabase Auth. User metadata/role/department live in user_profiles.

Staff dropdowns filter by department (e.g., “Sales”, “Finance”, “Delivery”). Prefer exact text; fallback fuzzy if no results.

UI/Styling Conventions

Keep native <select> and native inputs for mobile pickers.

Tailwind classes + small design tokens in index.css. Avoid heavy custom form UI.

Gotcha: CSS @import must be first lines in src/styles/index.css (Vite will error otherwise).

Workflows & Tests

Dev: npm run start → verify dropdowns populate, loaner checkbox ticks, line-item scheduling toggles, and save succeeds.

Optional Vitest setup lives under src/tests/**. Use data-testid attributes already present in DealForm.jsx.

When adding code

Put new DB calls in src/services/*. Keep parameters typed/validated at the boundary.

Reuse dropdownService for any staff/vendor/product lists.

If you add job fields, update both the DealForm payload mapping and the service-layer create/update so DB stays in sync.

Keep routing simple: pages live in src/pages/* and are registered in the app router (check src/App.jsx / routes file).
