# Rocket Aftermarket Tracker

This project is a React 18 + Vite app using TailwindCSS and Supabase (Auth/Postgres/Storage).

## Scripts

- `pnpm start` – start Vite dev server
- `pnpm build` – build for production
- `pnpm serve` – preview the production build
- `pnpm test` – run unit tests (Vitest)
- `pnpm e2e` – run end-to-end tests (Playwright)

## Dev server

The app runs at <http://localhost:5173> in development.

## Environment

Create a `.env.local` with your Supabase config and any feature flags.

Optional feature flags:

- Deprecated: `VITE_ORG_SCOPED_DROPDOWNS` – previously scoped dropdowns via a database helper. This flag is now ignored and dropdowns are unscoped by default. Prefer tenant-aware lists via `tenantService` or Admin filters where applicable.

## Dropdown caching & prefetch

To speed up the first render of forms (like Deals), dropdowns are cached in-memory for a short period and prefetched on app start.

- Where: `src/services/dropdownService.js`
- What: A 5‑minute TTL cache covers staff lists, vendors, and products. Keys include request filters.
- Prefetch: `prefetchDropdowns()` is invoked in `src/App.jsx` on mount (fire‑and‑forget, non‑blocking).

Adjust TTL

- Update `CACHE_TTL_MS` near the top of `dropdownService.js`.

Clear cache (for tests/troubleshooting)

- Call `clearDropdownCache()` from `dropdownService.js` to reset the in‑memory cache.

The cache is per tab/session and never persisted. Server‑side changes will naturally be picked up after the TTL expires or when the cache is cleared.

## Admin UX

Admin → Staff Records and Admin → User Accounts both support:

- “Only my org” toggle to filter lists to your organization.
- A bulk “Assign Org …” action to set `org_id` for active records that are currently missing it.

These tools help keep tenant data clean without requiring additional logins for staff records.

## Testing

- Unit tests: `pnpm test`
- E2E tests: `pnpm e2e` (requires environment-based auth configured for the e2e user)

To view the last Playwright report:

```bash
pnpm exec playwright show-report
```

## Database and seed (local/CI)

Migrations

- Apply migrations to your local Supabase database:

```bash
pnpm run db:push
```

Seed org data (optional)

- Populate baseline org/vendor/product/staff data into your Supabase project:

```bash
pnpm run db:seed-org
```

E2E seed (Node-based)

- For deterministic E2E data (org, vendor, products, a scheduled job with a loaner), use the Node seed runner. It requires a Postgres connection string.

Environment variables accepted by the seed runner:

- `DATABASE_URL` or `SUPABASE_DB_URL` — a direct Postgres connection string with credentials that can create/insert into your Supabase database.

Run locally:

```bash
pnpm run db:seed-e2e
```

Run in CI (examples):

- GitHub Actions: set `DATABASE_URL` as an encrypted repository secret and call `pnpm run db:seed-e2e` in a step before E2E.
- Vercel/other: not required for deployments; this seed is only for test data.

E2E test auth

- Playwright’s global setup supports two modes:
  - Storage state present at `e2e/storageState.json`: tests reuse it.
  - Or environment-based login. Set:
    - `E2E_EMAIL`
    - `E2E_PASSWORD`

Optional Playwright settings:

- `PLAYWRIGHT_BASE_URL` — defaults to `http://localhost:5173`.

Notes:

- Dropdowns are cached briefly in-memory; tests use explicit testids to remain stable.
- Multi-tenant writes: services will include `org_id` (from the form or inferred from the signed-in user profile) to satisfy org-scoped RLS policies.

## Auto-deployment (Vercel)

We use Vercel's native Git integration for auto-deploys (recommended):

- Production: any push to `main` auto-deploys
- Preview: every PR targeting `main` gets a Preview URL

Ensure the Vercel project is linked to this GitHub repo and `main` is set as the Production Branch. Set environment variables in Vercel → Project Settings → Environment Variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Routing and CSP headers are defined in `vercel.json`.

Notes:

- A manual fallback GitHub Action exists at `.github/workflows/deploy-vercel.yml` (manual only) for emergencies. Normally, you won't need it, as Vercel Git integration handles auto-deploys.

## CI (GitHub Actions)

This repo includes a CI workflow at `.github/workflows/ci.yml` that runs:

- Typecheck (tsc) against `tsconfig.e2e.json`
- Build (Vite)
- Optional E2E seed (Node-based) if `DATABASE_URL` is provided
- Unit tests (Vitest)
- E2E tests (Playwright) with artifacts on failure

Required repository secrets:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Optional secrets:

- `DATABASE_URL` — Postgres connection string for the seed runner (`pnpm run db:seed-e2e`)
- `E2E_EMAIL`, `E2E_PASSWORD` — only used if you prefer env-based login instead of the bundled `e2e/storageState.json`

Notes:

- Playwright uses `webServer` to start the app via `npm run start` on port 5173.
- If you change the dev server port, update `PLAYWRIGHT_BASE_URL` in the workflow or `playwright.config.ts`.
