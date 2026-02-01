# Environments & Promotion

This repo uses explicit environment switching for Supabase and clear UI indicators to prevent accidental production changes.

## Environments

- **Test / Non-Prod**
  - Supabase project ref: `ntpoblmjxfivomcwmjrj`
- **Production**
  - Supabase project ref: `ogjtmtndgiqqdtwatsue`
- **Local (stub)**
  - If `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are missing, the UI runs against an in-memory stub and data screens may look empty.

## UI Environment Indicator

The app displays an EnvChip that derives its label from `VITE_SUPABASE_URL` and shows only the **ref suffix**:

- Example: `ENV TEST …cwmjrj`
- Example: `ENV PROD …atsue`

This is designed to be visible without leaking full project refs.

## Switching Supabase CLI Environments

Use the repo scripts instead of manual `supabase link`:

- Link test:
  - `scripts/supabase/link-env.sh test`
- Link production (requires confirmation):
  - `CONFIRM_PROD=YES scripts/supabase/link-env.sh prod`

For one-off commands that must run against a target environment, use `with-env.sh`:

- `scripts/supabase/with-env.sh test -- <command...>`
- `CONFIRM_PROD=YES scripts/supabase/with-env.sh prod -- <command...>`

`with-env.sh` temporarily links the CLI to the requested environment and restores to test on exit.

## Environment Files

- **.env.e2e.local**: local E2E / DB scripts (never commit secrets).
- **.env.local**: Vite dev settings (client-side `VITE_*` only).

Minimum client vars:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

E2E / DB scripts typically require:

- `E2E_DATABASE_URL` (preferred)
- `E2E_EMAIL`
- `E2E_ORG_ID` (for scoped cleanup)

## Seed / Cleanup Guardrails

Scripts that **write** data enforce production guardrails. If the DB URL appears to be production, they will **hard-abort** unless both variables are set:

- `CONFIRM_PROD=YES`
- `ALLOW_SEED_PROD=YES`

This applies to:

- `scripts/seedE2E.js`
- `scripts/cleanupE2E.js`
- `scripts/bootstrapE2EDb.mjs`
- `scripts/attachOrg.js`
- `scripts/fixE2EPolicyConflicts.mjs`

## Promotion Flow (Test → Production)

1. **Apply migrations in test** and verify there is no drift.
2. **Run verification** locally: `pnpm -s verify`.
3. **Promote migrations to prod**:
   - `CONFIRM_PROD=YES scripts/supabase/with-env.sh prod -- pnpm -s db:push`
4. **Verify health endpoints** and smoke critical flows.
5. **Monitor** logs and metrics for any regressions.

If a production operation is required, always double-check the EnvChip and confirm the project ref suffix matches the intended target.
