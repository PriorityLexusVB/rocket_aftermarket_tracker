2. Add the prompt file that forces Supabase MCP usage

Create this file:

## .github/prompts/supabase-access-audit.prompt.md

name: supabase-access-audit
agent: 'agent'
description: Audit all DB access (tables/RPCs) used by src/\*\* and verify RLS/policies for SELECT/INSERT/UPDATE/DELETE using Supabase MCP.
tools:

- 'github/github-mcp-server/\*'
- 'supabase/\*'

---

Goal: Find every DB access path used by the app and verify RLS/policies match intent (org-scoped, “everyone full access” within org).

Step A — Identify what the app hits (repo scan)

1. Search src/\*\* for:
   - `.from('TABLE')`
   - `.rpc('RPC')`
   - `/rest/v1/`
2. Output a deduped list:
   - Tables: [...]
   - RPCs: [...]

Step B — Supabase MCP introspection (authoritative)
For each TABLE:

1. Confirm table exists in public schema.
2. Confirm RLS enabled.
3. List policies for SELECT/INSERT/UPDATE/DELETE.
4. Flag:
   - RLS disabled
   - missing policy for any operation
   - policies not org-scoped (if table has org_id)
   - “admin delete user/member” blockers (missing DELETE)

For each RPC:

1. Confirm function exists.
2. Check grants / security definer usage (if available) and whether it’s callable by authenticated users.

Step C — Output as a matrix
Return a table:
Object | Type | RLS | SELECT | INSERT | UPDATE | DELETE | Notes/Risks

Step D — Smallest fix plan (no destructive edits)
If gaps exist:

- Propose a NEW timestamped migration under supabase/migrations/ with only the needed policy additions/changes.
- No historical migration edits.
- Keep scope minimal.

Step E — Verification checklist

- After applying migration: run `NOTIFY pgrst, 'reload schema';`
- Re-test: admin delete person + one CRUD action per core table.

Run it

VS Code → Copilot Chat → Agent mode → Chat: Run Prompt → supabase-access-audit

This guarantees it uses Supabase MCP, not “guesswork.”

3. Make VS Code “default to Supabase MCP” when you mention access issues

Append this to AGENTS.md (small, permanent):

## Supabase Access/RLS Rule (default)

When the user mentions permissions, access, admin delete, RLS, or “can’t do X”:

- First use Supabase MCP to inspect the target table/function and its RLS/policies before proposing code changes.
- Output a policy matrix and the smallest migration needed (if any).

Optionally also append a similar short section to .github/copilot-instructions.md.

4. Make it show up as a recommended prompt

In .vscode/settings.json, add:

"supabase-access-audit": true

inside chat.promptFilesRecommendations.
