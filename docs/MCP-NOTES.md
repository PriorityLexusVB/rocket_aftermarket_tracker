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
- “process exited with code 1”
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

This repo supports **two Supabase MCP styles**:

- **Wrapper-based** servers that auto-load config from `.env.local` / `.env.e2e.local` via `scripts/mcp/supabase-mcp.sh`.
- A **prompt-based** server (the “old-style” UX) that prompts for project ref + token when you start it.

- Add this to `.env.e2e.local` (gitignored):

```bash
SUPABASE_PROJECT_REF="<your_non_prod_project_ref>"
```

Optional (if you want quick switching without editing values):

```bash
# Choose one at runtime: e2e (default) | dev | staging
MCP_ENV="e2e"

SUPABASE_PROJECT_REF_E2E="<your_e2e_project_ref>"
SUPABASE_PROJECT_REF_DEV="<your_dev_project_ref>"
SUPABASE_PROJECT_REF_STAGING="<your_staging_project_ref>"
```

- Known production refs are **hard-blocked** by the script to prevent accidental prod access.

#### MCP options (pick your UX)

This repo defines multiple Supabase MCP servers in [.vscode/mcp.json](.vscode/mcp.json):

- `supabase` → **prompt-based** (prompts for `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF`)
- `supabase-e2e` → wrapper-based, loads `.env.e2e.local`
- `supabase-dev` → wrapper-based, loads `.env.local`
- `supabase-wrapper` → wrapper-based alias of `.env.e2e.local` (kept for convenience)

Pick the one you want in the MCP server list in VS Code.

#### Quick verification (don’t guess)

1. Ensure your local env files exist (both are gitignored):

- `.env.e2e.local` for `supabase-e2e`
- `.env.local` for `supabase-dev`

2. In whichever env file you’re using, set:

```bash
SUPABASE_ACCESS_TOKEN="PASTE_TOKEN_HERE"
SUPABASE_PROJECT_REF="your_non_prod_project_ref"
```

3. If you’re using a wrapper-based server (`supabase-e2e`, `supabase-dev`, `supabase-wrapper`), run the wrapper smoke-check:

```bash
bash scripts/mcp/supabase-mcp.sh .env.e2e.local --check
```

Expected: `OK: Supabase MCP env validated ...`

If you’re using the prompt-based server (`supabase`), start it in VS Code and enter:

- `SUPABASE_ACCESS_TOKEN` (non-prod token)
- `SUPABASE_PROJECT_REF` (NON-PROD ONLY)

4. In VS Code, select the matching MCP server (`supabase-e2e` or `supabase-dev`) and ask Copilot to run a harmless read-only call (examples):

- “List Supabase migrations”
- “Show Supabase security advisors”

If it fails:

- Re-run the `--check` command above.
- Confirm you are not accidentally pointing at production.
- Restart the MCP server after editing env vars.

#### Don’t mess this up again (rules of thumb)

- Do **not** hardcode project refs or tokens in `.vscode/mcp.json`.
- Do **not** change `.vscode/mcp.json` to switch environments; switch by choosing `supabase-e2e` vs `supabase-dev`, or by editing the gitignored env files.
- If you need to rotate tokens, rotate only in `.env.e2e.local` / `.env.local` or your shell env (never commit secrets).
- If you use the prompt-based server, do **not** paste production refs/tokens into the prompt.

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
- Typically used when chasing browser/runtime issues (4xx/5xx, auth, CORS, blank screens)

#### WSL Remote + Windows Chrome (recommended)

If VS Code is running with the **WSL Remote** extension and Chrome is on **Windows**, do **not** run Chrome MCP from the WSL workspace config.

- Put the `chrome-devtools` server in Windows user `mcp.json` so it starts from the **LocalProcess extension host**.
- Use Windows-local debugging URL: `--browser-url=http://127.0.0.1:9222`.

Fallback (only if you must): WSL can reach Windows Chrome via `netsh interface portproxy`, but this is more fragile and easy to misconfigure.

---

## Config schema notes

VS Code validates `.vscode/mcp.json` against its own schema.

- Prefer keeping the workspace config minimal: `type`, `url` (for http), and `command`/`args`/`env` (for stdio).
- If you see editor warnings about unknown fields in `.vscode/mcp.json` (for example, per-server `version` fields), remove those fields rather than duplicating config elsewhere.

---

## Supabase token setup (recommended)

The workspace Supabase MCP wrapper (`scripts/mcp/supabase-mcp.sh`) loads `SUPABASE_ACCESS_TOKEN`.

### Option A (recommended: no prompts)

Put your token in `.env.e2e.local` (gitignored):

```bash
SUPABASE_ACCESS_TOKEN="PASTE_TOKEN_HERE"
```

### Option B (no prompts; machine-global)

Set once per machine in WSL:

```bash
echo 'export SUPABASE_ACCESS_TOKEN="PASTE_TOKEN_HERE"' >> ~/.bashrc
source ~/.bashrc

### Option C (prompt-based)

Use the `supabase` MCP server and paste the token into the prompt when starting the server.
```
