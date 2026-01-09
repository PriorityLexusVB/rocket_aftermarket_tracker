name: appcreation-safe-changes
description: Implement changes safely: smallest diffs, no regressions, verification after each step, and clear rollback.

---

# APP CREATION — Safe Changes Skill

## Golden rules

- One change at a time.
- One logical commit at a time.
- Verify after each commit.
- If anything breaks: stop, fix, re-verify.

## Required workflow

1. Restate the plan: files touched, commands, risk.
2. Apply minimal diff (avoid refactors).
3. Run verification commands.
4. Provide rollback notes.
