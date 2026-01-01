# RLS Canon (Authoritative)

This repository’s canonical tenancy model is:

- **`dealer_id`** on tenant-scoped rows
- `public.auth_dealer_id()` as the single source of the current tenant

## Authoritative migration

The single authoritative migration is:

- [supabase/migrations/20260101000001_dealer_id_canon_enforcer.sql](../../supabase/migrations/20260101000001_dealer_id_canon_enforcer.sql)

It:

- Ensures `dealer_id` exists + is `NOT NULL` on core tables
- Adds/validates `dealer_id → organizations(id)` FKs
- Enables RLS and recreates the canonical policy allowlist
- Drops legacy `org_id` columns on canonical tables (if present)

## Guardrails

Run the guardrail check against a database connection:

- `DATABASE_URL=... pnpm db:rls-check`

This executes:

- [scripts/db/rls_guardrail.sql](../../scripts/db/rls_guardrail.sql)

## Notes

- Client code should not depend on `org_id` columns.
- Prefer relying on RLS for scoping; only pass explicit tenant IDs when required for UX (e.g., cross-tenant admin tooling).
