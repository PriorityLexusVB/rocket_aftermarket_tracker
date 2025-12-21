name: appcreation-repo-audit
description: Audit this repo and produce safe, PR-sized recommendations that reduce drift and improve reliability without breaking existing behavior.
---

# APP CREATION — Repo Audit Skill

## Non-negotiables
- Small diffs only.
- No framework upgrades unless explicitly requested.
- Do not break existing behavior.
- Always include verification commands and rollback notes.

## Phase 1 — Orientation (read-only)
1) Identify repo type:
   - Next.js / Supabase / Mixed
2) Inventory:
   - Node version expectations (.nvmrc, engines)
   - package manager + lockfile
   - package.json scripts (lint/test/typecheck/build/dev)
   - CI (.github/workflows/*)
   - existing instruction files (copilot-instructions, AGENTS, instructions, skills)
3) Red flags to call out:
   - Node/pnpm drift
   - missing scripts or broken scripts
   - secrets leakage / unsafe env usage
   - missing RLS (Supabase)
   - duplicated gamification logic

## Phase 2 — Baseline verification
Run repo-appropriate commands (do not invent new ones unless missing):
- install
- lint
- test
- typecheck
- build

If failures occur:
- Fix one failure at a time.
- Re-run the failed command after each change.

## Output format (required)
1) Audit Findings (Critical / High / Medium / Low)
2) Minimal Fix Plan (max 3–5 items)
3) Verification Commands (exact)
4) Rollback Plan (per item)
5) Optional Enhancements (clearly optional)
