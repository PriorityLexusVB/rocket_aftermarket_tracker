Priority Automotive – AI Coding Instructions

Goal: Make AI helpers productive immediately in this codebase by explaining the real architecture, conventions, and gotchas.

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