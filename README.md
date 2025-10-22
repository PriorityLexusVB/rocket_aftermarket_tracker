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

- `VITE_ORG_SCOPED_DROPDOWNS=true` – scopes dropdowns (staff, vendors, products) and global search to the current user’s organization using the `auth_user_org()` helper. When omitted or set to false, dropdowns are unscoped (default).

## Admin UX

Admin → Staff Records and Admin → User Accounts both support:

- “Only my org” toggle to filter lists to your organization.
- A bulk “Assign Org …” action to set `org_id` for active records that are currently missing it.

These tools help keep tenant data clean without requiring additional logins for staff records.

## Testing

- Unit tests: `pnpm test`
- E2E tests: `pnpm e2e` (requires environment-based auth configured for the e2e user)

To view the last Playwright report:

```
pnpm exec playwright show-report
```
