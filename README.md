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

## Auto-deployment (Vercel)

This repo includes GitHub Actions to automate deploys to Vercel.

- CI (`.github/workflows/ci.yml`) runs on PRs and pushes to `main` and performs unit tests and a production build.
- Deploy (`.github/workflows/deploy-vercel.yml`) runs on pushes to `main` and deploys to Vercel Production.

Required GitHub repository secrets (Settings → Secrets and variables → Actions):

- `VERCEL_TOKEN` – Vercel Personal Token with access to the project
- `VERCEL_ORG_ID` – Vercel Organization ID
- `VERCEL_PROJECT_ID` – Vercel Project ID

Environment variables (set in Vercel Project Settings → Environment Variables):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Routing and CSP headers are defined in `vercel.json`. Vercel’s Git integration can also be used directly (auto-deploy `main`); if you prefer that path, you may disable the GitHub Action deploy.
