# Quick Start — Aftermarket Tracker Development

**Last Updated**: November 11, 2025

---

## Setup (First Time)

```bash
# 1. Install Node 20 (see .nvmrc)
nvm use

# 2. Install pnpm
npm install -g pnpm

# 3. Install dependencies
pnpm install

# 4. Start development server
pnpm dev
```

---

## Daily Workflow

```bash
# Start dev server
pnpm dev

# Run tests (do this BEFORE and AFTER changes)
pnpm test

# Lint code
pnpm lint

# Type check
pnpm typecheck

# Build for production
pnpm build
```

---

## Key Documents to Read First

1. **MASTER_EXECUTION_PROMPT.md** — Complete development guide with phased execution plan
2. **.github/copilot-instructions.md** — Workspace guardrails (must follow)
3. **docs/MCP-NOTES.md** — How to use Supabase MCP for schema introspection
4. **PERFORMANCE_INDEXES.md** — Index optimization guidelines

---

## Critical Rules (Never Violate)

### Stack Lock
- ✅ Vite 5 + React 18 + TailwindCSS + Supabase
- ❌ Do NOT change stack or remove `rocketCritical` dependencies

### Data Access
- ✅ Import Supabase ONLY in service/lib modules
- ❌ NEVER import Supabase directly in React components
- ✅ All queries MUST include tenant scoping (orgId/profile context)

### Forms & UI
- ✅ All form inputs are controlled (`value` + `onChange`)
- ❌ Do NOT use `defaultValue`
- ✅ Keep debounced autosave at ~600ms
- ✅ Dropdown cache TTL = 5 minutes

### Schema Changes
- ✅ Create NEW timestamped migration files
- ❌ NEVER edit historical migration files
- ✅ Include `NOTIFY pgrst, 'reload schema';` for relationship changes
- ✅ Document BEFORE/AFTER EXPLAIN for performance work

---

## Troubleshooting

### "Could not find a relationship" Error
```sql
-- Run in Supabase SQL editor:
NOTIFY pgrst, 'reload schema';
-- Wait 5 seconds, then retry your query
```

### Tests Failing After Your Changes
```bash
# 1. Run tests to see failures
pnpm test

# 2. Fix up to 3 targeted attempts
# 3. If still failing, ask for help with the error output
```

### Lint Errors
```bash
# Check what's wrong
pnpm lint

# Auto-fix what's possible
pnpm lint --fix
```

---

## Phase Status (See MASTER_EXECUTION_PROMPT.md)

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ DONE | Permission error mapping |
| 2 | ✅ DONE | Time normalization |
| 3 | ✅ DONE | UI-safe date display |
| 4 | 🔄 READY | Appointments simplification |
| 5 | 🔄 READY | Drawer streamlining |
| 6 | 🔄 READY | Calendar UX lane clarity |
| 7 | 🔄 READY | Performance health polish |
| 8 | 🔄 READY | Prune demo jobs script |
| 9 | 🔄 READY | Final checks and docs |
| 10 | 🔄 READY | PR and rollback notes |

---

## Current Test Status

```
✅ 515 tests passing
⊘ 2 tests skipped
❌ 0 tests failing
```

**Lint**: 0 errors, 334 warnings (acceptable)

---

## Getting Help

1. **Read the Master Execution Prompt**: `MASTER_EXECUTION_PROMPT.md`
2. **Check Existing Documentation**:
   - Error handling: `ERROR_HANDLING_GUIDE.md`
   - Deployment: `docs/DEPLOY_CHECKLIST.md`
   - MCP usage: `docs/MCP-NOTES.md`
3. **Search for Similar Code**: Use GitHub MCP or `grep`
4. **Ask for Guidance**: If uncertain, STOP and ask rather than guessing

---

## Remember

**Principle**: Prefer READ + PLAN over MODIFY

When in doubt:
1. ✅ Stop and analyze
2. ✅ Document what you found
3. ✅ Propose a plan
4. ✅ Wait for approval
5. ✅ Then implement

**Never**:
- ❌ Make breaking changes without approval
- ❌ Remove existing functionality
- ❌ Skip testing after changes
- ❌ Touch migration history

---

**For comprehensive details, see**: `MASTER_EXECUTION_PROMPT.md`
