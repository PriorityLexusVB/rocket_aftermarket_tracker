name: appcreation-ci-verify
description: Fix or improve verification: scripts + CI workflow alignment and faster, more reliable checks.

---

# APP CREATION — CI & Verification Skill

## Goals

- Deterministic local verification + CI alignment.
- No unnecessary CI bloat.

## Checklist

- Confirm scripts: lint/test/typecheck/build/dev (where applicable)
- Confirm Node/pnpm pins match repo
- CI runs the same commands as local
