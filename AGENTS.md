# AGENTS.md — APP CREATION

These instructions apply to all agents working in this repo.

## Operating mode (never skip)
1) Read-only audit first: identify drift, risks, and quick wins.
2) Plan: list files to touch + exact verification commands.
3) Implement smallest diff possible (PR-sized).
4) Verify after every change; stop and fix if any command fails.

## Non-breaking rules
- Do not rename public APIs/routes without compatibility.
- Do not change database/RLS behavior without explicitly listing impacts.
- Prefer additive migrations; avoid destructive schema changes.

## Verification defaults (use repo scripts if they exist)
- pnpm install
- pnpm lint (if present)
- pnpm test (if present)
- pnpm run typecheck (if present)
- pnpm build (if present)
