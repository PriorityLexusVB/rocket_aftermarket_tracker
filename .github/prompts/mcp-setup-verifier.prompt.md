---
name: mcp-setup-verifier
agent: 'agent'
description: Verify MCP servers + prompt discovery + instruction wiring for this repo. Output PASS/FAIL and exact fixes.
argument-hint: tabHint=<url-or-title>
tools:
  - 'chrome-devtools/*'
  - 'supabase/*'
  - 'github/github-mcp-server/*'
---

Goal: verify the repo is correctly wired for MCP + prompts + instructions.

A) Prompt discovery (repo files)

- Confirm `.github/prompts/*.prompt.md` exists and list the prompt names found.
- Confirm `AGENTS.md` exists at repo root.
- Confirm `.github/copilot-instructions.md` exists.

B) VS Code settings alignment (repo)

- Confirm `.vscode/settings.json` includes:
  - github.copilot.chat.codeGeneration.useInstructionFiles = true
  - chat.useAgentsMdFile = true
  - chat.promptFilesLocations has ".github/prompts": true
- If missing, tell me exactly what to add.

C) MCP server readiness (tool existence)
For each tool namespace below, attempt a harmless call. If tools are unavailable, mark FAIL and give the exact fix.

1. chrome-devtools:
   - list_pages
2. supabase:
   - run any safe read-only command (project info / list projects)
3. github:
   - run a repo search for "AGENTS.md"

Output a table:
Area | PASS/FAIL | Evidence | Fix steps (exact)

Finally: if Chrome fails, remind that Chrome MCP must run local on Windows and Chrome must be started with remote debugging on 9222.
