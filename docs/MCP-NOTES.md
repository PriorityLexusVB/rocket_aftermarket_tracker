# MCP Notes (VS Code)

This repo uses VS Code MCP (Model Context Protocol) servers to help Copilot/agents access GitHub and Supabase safely.

## Source of truth

- ✅ **Workspace MCP config (portable):** `.vscode/mcp.json`
  - This file is tracked in git and travels with the repo across machines.
  - Repo-specific servers belong here (Supabase, Playwright, etc.).

- ⚠️ **Global User MCP config (per machine):**
  - `C:\Users\<YOU>\AppData\Roaming\Code\User\mcp.json`
  - Keep this **empty** (or GitHub-only) to avoid duplicate server definitions across repos.
  - **Exception (WSL Remote):** If VS Code is connected to WSL but Chrome is running on Windows, configure the Chrome DevTools MCP server **here** so it runs on the _local_ (Windows) extension host.

### Why this matters

Defining the same server in multiple places (global + workspace) causes:

- duplicates in the MCP list
- servers fighting each other
- “process exited with code 1/2”
- connecting to the wrong Supabase project

**Rule:** Workspace `.vscode/mcp.json` is the single source of truth for this repo.

---

## Servers used in this repo

### GitHub MCP

- Purpose: repo search, PR/issue metadata, workflow inspection
- Safe to run always
- Configured in `.vscode/mcp.json`

### Supabase MCP

- Purpose: schema/RLS inspection, query explain, migration planning support
- Repo-specific: must not be configured globally (prevents wrong project connections)

#### Supabase project selection (dev/E2E only)

This repo uses a **single** Supabase MCP server in `.vscode/mcp.json` that runs the wrapper script:

- `scripts/mcp/supabase-mcp.sh`

That wrapper loads `SUPABASE_PROJECT_REF` and `SUPABASE_ACCESS_TOKEN` from a gitignored env file.

**Recommended:** use `.env.e2e.local` so you never point MCP at production.

Add these to `.env.e2e.local` (gitignored):

```bash
SUPABASE_PROJECT_REF="<your_non_prod_project_ref>"
SUPABASE_ACCESS_TOKEN="<your_supabase_personal_access_token>"
```

Known production project refs are hard-blocked by the wrapper.

#### Quick verification (don’t guess)

Run the wrapper smoke-check:

```bash
bash scripts/mcp/supabase-mcp.sh .env.e2e.local --check
```

Expected: `OK: Supabase MCP env validated ...`

If it fails:

- Confirm `.env.e2e.local` exists and includes `SUPABASE_PROJECT_REF` + `SUPABASE_ACCESS_TOKEN`.
- Confirm you don’t have a **global** Supabase MCP server configured.
- Restart the MCP server after editing env vars.

#### Canonical flow (how changes reach production)

- Use Supabase MCP against **non-production** (dev/e2e/staging) to inspect schema/RLS and to plan the smallest safe change.
- Implement code changes + any required **new** migration file under `supabase/migrations/`.
- Open PR → review → merge → your normal CI/deploy process applies migrations to production.

MCP is intentionally **not** the “push to prod” mechanism.

### Playwright MCP (optional)

- Purpose: E2E debugging, UI reproduction flows
- Only needed when actively working on E2E tests

### Chrome DevTools MCP (optional)

- Purpose: evidence-first runtime debugging (console + network)

#### WSL Remote + Windows Chrome (recommended)

If VS Code is running with the **WSL Remote** extension and Chrome is on **Windows**, do **not** run Chrome MCP from the WSL workspace config.

- Put the `chrome-devtools` server in Windows user `mcp.json` so it starts from the **LocalProcess extension host**.
- Use Windows-local debugging URL: `--browser-url=http://127.0.0.1:9222`.

---

## Config schema notes

VS Code validates `.vscode/mcp.json` against its own schema.

- Prefer keeping the workspace config minimal: `type`, `url` (for http), and `command`/`args`/`env` (for stdio).
- If you see editor warnings about unknown fields in `.vscode/mcp.json`, remove those fields rather than duplicating config elsewhere.
