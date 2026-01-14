# Agent Preflight Checklist (Local)

Use this checklist whenever you (or Copilot) are about to do multi-step work, especially anything involving Supabase.

## 1) Guardrails (required)

- Node + pnpm:
  - Node: `node -v` should be 20.x
  - pnpm: `pnpm -v` should match `package.json#packageManager`

- Client env guard (NO `process` under `src/**`):

```bash
pnpm -s guard:client-env
```

## 2) Supabase MCP safety (required)

Validate that the wrapper loads the right env file and **refuses production**:

```bash
bash scripts/mcp/supabase-mcp.sh --check
```

Expected:
- `OK: Supabase MCP env validated (project_ref=..., env_file=...)`

If MCP tool calls report the server stopped (or VS Code shows the server restarting), run the smoke check to ensure the wrapper can start the MCP server without crashing:

```bash
bash scripts/mcp/supabase-mcp.sh --check --smoke
```

Expected:
- `OK: Supabase MCP env validated ...`
- `OK: Supabase MCP smoke start succeeded ...`

This catches wrapper regressions like malformed CLI args (where the MCP server exits immediately).

If it fails:
- Ensure `.env.e2e.local` includes `SUPABASE_PROJECT_REF` + `SUPABASE_ACCESS_TOKEN`.
- Ensure `SUPABASE_PROJECT_REF` matches `VITE_SUPABASE_URL`.
- Remove any **global** Supabase MCP server definitions from your VS Code user `mcp.json`.

## 3) Repo health (required)

```bash
pnpm -s lint
pnpm -s test
```

## 4) Optional: Typecheck / build

```bash
pnpm -s typecheck
pnpm -s build
```

## 5) VS Code MCP sanity

- Workspace config is the source of truth: `.vscode/mcp.json`.
- Start the single `supabase` MCP server.
- Ask Copilot: “List Supabase tables” to confirm MCP wiring.
