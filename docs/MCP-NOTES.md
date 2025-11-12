# MCP Notes — Aftermarket Tracker

Purpose: Document how to use Model Context Protocol (MCP) servers in this workspace to accelerate Supabase + GitHub operations while keeping production code untouched.

## Servers

- Supabase MCP (HTTP): Provides schema inspection, querying, migration introspection.
- GitHub MCP (HTTP): Enables PR / issue metadata access and code search.

## Usage Principles

1. Read-only first: Prefer non-mutating operations (schema list, policy read) before generating migrations.
2. Guardrails: Never write production migrations from agent tasks without an explicit approval step.
3. Stale cache remediation: If relationship queries fail ("Could not find a relationship"), run NOTIFY pgrst, 'reload schema'; wait 5s, retry.
4. Evidence collection: For performance tuning, gather BEFORE and AFTER EXPLAIN ANALYZE output and index presence.

## Common Supabase MCP Tasks

| Task                       | MCP Action      | Notes                                            |
| -------------------------- | --------------- | ------------------------------------------------ |
| List tables                | list_tables     | Use to confirm presence before building queries. |
| Inspect RLS policies       | list_policies   | Ensure each table has tenant scoping.            |
| Verify extension (pg_trgm) | list_extensions | Must contain pg_trgm before trigram INDEX usage. |
| Explain query              | explain         | Capture buffer hits + row counts (attach to PR). |

## Performance Verification Checklist

- Covering indexes present (see `PERFORMANCE_INDEXES.md`).
- pg_trgm enabled for fuzzy search columns.
- Optional MV created & refreshed (document refresh cadence).
- Slow queries reduced (< 50ms target for common list endpoints under test dataset size).

## Coding Agent Prompt Integration

Embed this checklist in agent prompts so every performance change yields artifacts: index DDL, EXPLAIN BEFORE, EXPLAIN AFTER, elapsed time.

## Failure Patterns & Remedies

| Symptom                             | Likely Cause                        | Remedy                                             |
| ----------------------------------- | ----------------------------------- | -------------------------------------------------- |
| 400/403 on REST relationship select | Stale schema cache                  | NOTIFY pgrst, 'reload schema'; wait and retry.     |
| Missing FK expansion                | FK not created or named incorrectly | Verify constraint naming; re-run migration.        |
| Slow COUNT(\*)                      | Missing WHERE + index               | Add selective index or approximate count strategy. |

## Do / Don't

- DO isolate workspace guardrail changes on dedicated branches.
- DO capture artifacts in `.artifacts/` when running performance tests.
- DON'T modify application runtime code while setting up MCP.
- DON'T assume cache reload worked; verify by re-running the failing query.

## Next Steps

If expanding MCP usage: add custom server for local analysis (e.g., `localhost:PORT/mcp`) and extend instructions with authentication tokens management.
