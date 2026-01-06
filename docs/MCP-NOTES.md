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

The workspace config references `SUPABASE_ACCESS_TOKEN`.

### Option A (prompt per machine)

If `.vscode/mcp.json` uses `${input:SUPABASE_ACCESS_TOKEN}`, VS Code will prompt you when the server starts.

### Option B (no prompts; easiest across multiple computers)

Switch `.vscode/mcp.json` to use env:

- `SUPABASE_ACCESS_TOKEN: "${env:SUPABASE_ACCESS_TOKEN}"`

Then set once per machine in WSL:

```bash
echo 'export SUPABASE_ACCESS_TOKEN="PASTE_TOKEN_HERE"' >> ~/.bashrc
source ~/.bashrc
```
