# Development Setup

This app uses Vite + React and Supabase. To run locally, configure your environment once and the error "Missing VITE_SUPABASE_URL environment variable" will go away for good.

> Style note: Use "Supabase" (capital S) for the brand in prose/logs. Use lowercase identifiers like `supabase` only for variables, import names, and shell commands (e.g., `supabase db push`).

## 1) Environment variables (one-time)

Create a file named `.env.local` at the repo root (same level as `package.json`). Copy from `.env.example` and fill in your Supabase values:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=ey...YOUR-ANON-KEY
```

Notes:

- Do NOT commit `.env.local` (git-ignored). Never commit real keys.
- Only these two client-side vars are required.

### Windows PowerShell (temporary env for one session)

If you prefer to test without creating the file:

```powershell
$env:VITE_SUPABASE_URL = "https://YOUR-PROJECT.supabase.co"
$env:VITE_SUPABASE_ANON_KEY = "ey...YOUR-ANON-KEY"
```

## 2) Install and run

```powershell
pnpm install
pnpm run start   # http://localhost:5173
```

## 3) Build and Preview

```powershell
pnpm run build
pnpm run serve   # preview build output
```

## 4) E2E tests (optional)

- Without auth env, only the smoke test runs.
- With auth env, all tests run.

```powershell
# Optional env for auth flows
$env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:5174"
$env:E2E_EMAIL = "tester@example.com"
$env:E2E_PASSWORD = "your-password"

pnpm run e2e
```

## 5) Debug Auth page

In development, `/debug-auth` is available after signing in and shows session, org, and counts used to finalize RLS policies.

If you see permission errors in the console while navigating (e.g., vehicles/photos/calendar), copy them verbatim so we can propose minimal SQL policies.

## 6) Copilot tools and MCP (Playwright)

Short answer: partly.

- `.vscode/extensions.json` only tells VS Code which extensions to recommend/install. It does not by itself make Copilot “use” those extensions.
- Copilot can actively use tools that are exposed to it via MCP (Model Context Protocol) or a dedicated Copilot integration. In this repo, Playwright is exposed to Copilot because we added `.vscode/mcp.json` pointing at `npx @playwright/mcp`. That’s the bit that actually “tells” Copilot about a tool it can invoke.

What this means:

- ESLint/Prettier/Tailwind/Error Lens/Supabase extensions → improve editor DX, diagnostics, code actions. Copilot benefits indirectly (better code, fewer errors), but it doesn’t “drive” them.
- Playwright MCP → Copilot can drive a real browser, click through the app, and verify flows. This is the tool Copilot can actually “use” programmatically.

How to make sure Copilot knows and can use it

1. Install the recommendations
   - Open the Extensions panel → “Workspace Recommendations” → Install All.

2. Start the Playwright MCP server
   - We added `.vscode/mcp.json` with a Playwright server. In Copilot Chat, ask:
     - “Start the Playwright MCP server and confirm it’s connected. List all available MCP tools.”

3. Verify Copilot can actually use it
   - In Copilot Chat, ask:
     - “Using the Playwright MCP tool, open <http://localhost:5173/debug-auth> and report the session and org counts. Then create a new Deal and confirm we’re redirected to /deals/:id/edit. If selectors are missing, patch the app to add data-testids and retry.”

If Copilot replies with tool names including Playwright, you’re all set. If not, it means the server didn’t start—have it run `npx @playwright/mcp` (it may prompt) or start it from the ▶️ next to the server entry in `.vscode/mcp.json`.

TL;DR

- Yes for Playwright: our MCP config does “tell” Copilot about Playwright so it can use a browser.
- No for the rest: `.vscode/extensions.json` is just recommendations; Copilot doesn’t automatically “use” ESLint/Prettier/Tailwind/Supabase extensions.
