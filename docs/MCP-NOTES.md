# MCP Notes (VS Code)

This repo uses VS Code MCP (Model Context Protocol) servers to help Copilot/agents access GitHub and Supabase safely.

## Source of truth

- ✅ **Workspace MCP config (portable):** `.vscode/mcp.json`
  - This file is tracked in git and travels with the repo across machines.
  - Repo-specific servers belong here (Supabase, Playwright, etc.).

- ⚠️ **Global User MCP config (per machine):**
  - `C:\Users\<YOU>\AppData\Roaming\Code\User\mcp.json`
  - Keep this **empty** (or GitHub-only) to avoid duplicate server definitions across repos.

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
