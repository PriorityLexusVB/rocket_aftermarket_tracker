name: appcreation-supabase-rls-migrations
description: Safe Supabase schema + RLS workflow: additive migrations, explicit policy impacts, and verification to avoid breaking production.
---

# APP CREATION — Supabase RLS & Migrations Skill

## Non-negotiables
- No guessing: inspect existing migrations/policies first.
- Prefer additive migrations over destructive changes.
- Any RLS/policy change must list impacted tables + who can read/write.

## Output
- Migration plan (ordered steps)
- Policies impacted (table-by-table)
- Verification commands
- Rollback plan
