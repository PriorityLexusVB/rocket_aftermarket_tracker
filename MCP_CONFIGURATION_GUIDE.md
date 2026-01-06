# MCP Server Configuration Guide

This document provides comprehensive information about the Model Context Protocol (MCP) servers used in the Rocket Aftermarket Tracker project and how to configure them in your coding agent settings.

## Overview

The project uses two primary MCP servers (and a couple of optional ones):

1. **Supabase MCP Server** - For database operations, schema inspection, and migration management
2. **GitHub MCP Server** - For repository operations, PR/issue management, and code search

Optional (used for UI/E2E debugging):

3. **Playwright MCP Server** - For browser automation / reproduction flows
4. **Chrome DevTools MCP Server** - For evidence-first runtime debugging (console/network)

## Quick Start

### VS Code Integration

Repo-scoped MCP servers are pre-configured in `.vscode/mcp.json`.

```json
{
  "servers": {
    "github/github-mcp-server": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp"
    },
    "supabase": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "@supabase/mcp-server-supabase@0.5.10",
        "--project-ref",
        "<project-ref>",
        "--features",
        "account,docs,database,debugging,development,functions,storage,branching",
        "--api-url",
        "https://api.supabase.com"
      ]
    },
    "microsoft/playwright-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

Notes:

- The repo uses `stdio` (`npx ...`) for Supabase/Playwright.
- **Chrome DevTools MCP is often machine-specific.** If VS Code is connected via WSL Remote and Chrome is running on Windows, configure Chrome MCP in Windows user `mcp.json` so it runs on the LocalProcess extension host.
- If VS Code shows a schema warning for extra fields in `.vscode/mcp.json`, prefer removing non-standard fields rather than fighting the schema.

### Coding Agent Configuration

For GitHub Copilot coding agents, refer to the comprehensive configuration in `mcp-servers-config.json`. This file contains:

- Complete MCP server definitions with capabilities
- Workspace configuration and guardrails
- Common workflows and use cases
- Error handling patterns
- Security considerations
- Migration strategies

## MCP Server Details

### Supabase MCP Server

**Purpose**: Database schema inspection, query optimization, and RLS policy verification

**Key Capabilities**:

- `list_tables` - List all database tables
- `list_policies` - Inspect RLS policies
- `list_extensions` - Verify installed extensions (e.g., pg_trgm)
- `explain_query` - Analyze query performance
- `get_table_schema` - Get detailed table structure
- `list_functions` - List database functions
- `list_triggers` - List database triggers

**Common Use Cases**:

1. **Schema Verification**: Verify database schema before making changes
2. **RLS Audit**: Check that all tables have proper tenant isolation
3. **Performance Analysis**: Use EXPLAIN ANALYZE to optimize slow queries
4. **Migration Planning**: Inspect current state before creating migrations

**Best Practices**:

- Always use read-only operations first
- Run `NOTIFY pgrst, 'reload schema'` if relationship queries fail
- Capture EXPLAIN output for performance tuning (store in `.artifacts/explain/`)
- Verify tenant scoping with `org_id` in all policies

### Playwright MCP Server (Optional)

**Purpose**: E2E debugging and UI reproduction flows.

**Notes**:

- Only enable/use when actively debugging UI or Playwright tests.

### Chrome DevTools MCP Server (Optional)

**Purpose**: Evidence-first runtime debugging (console + network).

**Notes**:

- Requires Chrome/Chromium launched with remote debugging enabled.
- If VS Code is running in WSL Remote, prefer running the Chrome MCP server on Windows (LocalProcess host) using `--browser-url=http://127.0.0.1:9222`.
- If you must connect from WSL to Windows Chrome, you may need a reachable host/port (for example via Windows `netsh interface portproxy`).

### GitHub MCP Server

**Purpose**: Repository operations, CI/CD analysis, and code search

**Key Capabilities**:

- `list_pull_requests` - List and filter PRs
- `list_issues` - List and search issues
- `search_code` - Search code across repositories
- `get_file_contents` - Read file contents
- `list_commits` - View commit history
- `list_workflow_runs` - Check CI/CD status
- `summarize_job_log_failures` - Analyze failed workflows

**Common Use Cases**:

1. **CI/CD Debugging**: Analyze failed workflow runs efficiently
2. **Code Refactoring**: Search for all usages before making changes
3. **PR Analysis**: Get PR metadata and review status
4. **Workflow Optimization**: Identify patterns in workflow failures

**Best Practices**:

- Use `summarize_job_log_failures` instead of manually reading logs
- Search code before refactors to identify all usages
- Check workflow status before merging PRs
- Use pagination for large result sets

## Common Workflows

### 1. Schema Verification Workflow

```bash
# Using Supabase MCP
1. list_tables → Get all tables
2. list_policies → Check RLS policies for each table
3. Verify: Each table has org_id scoping
4. list_extensions → Confirm pg_trgm is installed
5. Check: Foreign key relationships exist
```

### 2. Performance Analysis Workflow

```bash
# Using Supabase MCP
1. explain_query → Run EXPLAIN ANALYZE on slow query
2. Check: Missing indexes or table scans
3. Verify: Covering indexes from PERFORMANCE_INDEXES.md
4. Store: BEFORE/AFTER results in .artifacts/explain/
5. Document: Include metrics in PR description
```

### 3. CI Workflow Debugging

```bash
# Using GitHub MCP
1. list_workflow_runs → Get recent runs for workflow
2. summarize_run_log_failures → Analyze failed run
3. Identify: Common failure patterns
4. Check: Missing secrets or environment variables
5. Fix: Update workflow configuration
```

### 4. Code Refactoring Workflow

```bash
# Using GitHub MCP
1. search_code → Find all usages of symbol/function
2. Check: Indirect dependencies
3. Plan: Minimal change strategy
4. Implement: Make targeted changes
5. Verify: Run linter and tests
```

## Error Handling Patterns

### Stale Schema Cache

**Symptom**:

- 400/403 errors on REST relationship select
- "Could not find a relationship" errors

**Remedy**:

```sql
NOTIFY pgrst, 'reload schema';
-- Wait 5 seconds
-- Retry the query
```

### Missing Foreign Key

**Symptom**:

- Foreign keys not expanded in query results
- Relationship errors in Supabase queries

**Remedy**:

1. Verify FK constraint exists: `list_tables` with FK details
2. Check naming convention matches Supabase expectations
3. Re-run migration if needed
4. Reload schema cache

### Slow Queries

**Symptom**:

- Queries taking > 50ms for common operations
- High database load

**Remedy**:

1. Run `explain_query` to identify bottleneck
2. Add selective indexes for WHERE clauses
3. Verify covering indexes exist
4. Consider materialized views for complex aggregations
5. Use approximate count strategies for COUNT(\*)

### RLS Violations

**Symptom**:

- Row-level security errors
- Empty result sets when data should exist
- Permission denied errors

**Remedy**:

1. Verify `org_id` is passed in all queries
2. Check RLS policies allow the operation
3. Ensure user has proper role/permissions
4. Review tenant service implementation

### pnpm Cache Issues

**Symptom**:

- GitHub Actions failing with "pnpm not found"
- Cache-related errors in CI

**Remedy**:

1. Ensure corepack enable runs BEFORE setup-node
2. Set cache: 'pnpm' in setup-node action
3. Use `--frozen-lockfile` for reproducible builds
4. Check pnpm version matches packageManager field

## Artifact Storage

Store analysis artifacts in designated locations:

- **Performance Metrics**: `.artifacts/explain/`
- **MCP Introspection**: `.artifacts/mcp-introspect/`
- **Test Results**: `playwright-report/`
- **Build Output**: `dist/`

**Retention Policy**:

- Commit performance evidence to PR
- Clean up test artifacts after merge
- Keep historical performance data for trending

## Security Considerations

### Required Secrets

GitHub Actions workflows require these secrets:

- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `E2E_EMAIL` - Test user email for E2E tests
- `E2E_PASSWORD` - Test user password for E2E tests
- `GEMINI_API_KEY` - Gemini API key for code review

### Best Practices

1. **Never commit credentials** to repository
2. **Use GitHub secrets** for CI/CD workflows
3. **Rotate API keys** regularly
4. **Audit RLS policies** for tenant isolation
5. **Verify org_id scoping** in all queries
6. **Use anon key** for client-side operations only
7. **Protect service role key** (never expose to client)

## Migration Strategy

### Planning Workflow

1. **Inspect Current State**: Use `list_tables`, `list_policies`, `list_extensions`
2. **Plan Changes**: Document desired schema modifications
3. **Create Migration**: Generate new timestamped migration file
4. **Test Locally**: Apply migration to local/dev environment
5. **Verify RLS**: Check policies still enforce tenant isolation
6. **Reload Schema**: Run `NOTIFY pgrst, 'reload schema'`
7. **Test Endpoints**: Verify all affected API endpoints work
8. **Document**: Include verification steps in PR

### Guardrails

- ✅ **DO**: Create new timestamped migration for changes
- ✅ **DO**: Include reversible DDL when possible
- ✅ **DO**: Provide verification SQL and expected results
- ✅ **DO**: Store EXPLAIN output for performance changes
- ✅ **DO**: Test migration on dev before production
- ❌ **DON'T**: Edit historical migration files
- ❌ **DON'T**: Modify production schema without migration
- ❌ **DON'T**: Skip RLS policy verification
- ❌ **DON'T**: Forget to reload schema cache after changes

## Troubleshooting

### MCP Server Connection Issues

**Problem**: Cannot connect to MCP server

**Solutions**:

1. Check network connectivity
2. Verify server URL is correct
3. Check authentication credentials
4. Review VS Code MCP extension logs
5. Try restarting VS Code/Copilot

### Schema Cache Issues

**Problem**: Stale schema cache causing query failures

**Solutions**:

1. Run `NOTIFY pgrst, 'reload schema'` in SQL editor
2. Wait 5-10 seconds for cache to refresh
3. Retry the failing operation
4. Check Supabase logs for cache refresh confirmation

### Performance Degradation

**Problem**: Queries becoming slower over time

**Solutions**:

1. Use `explain_query` to identify bottlenecks
2. Check if indexes still exist and are being used
3. Review query plan for table scans
4. Verify statistics are up to date (ANALYZE)
5. Check for missing covering indexes

## Additional Resources

- **Documentation**: See `docs/MCP-NOTES.md` for operational notes
- **Performance**: Review `PERFORMANCE_INDEXES.md` for index strategy
- **Error Handling**: Check `ERROR_HANDLING_GUIDE.md` for error patterns
- **Deployment**: Review `DEPLOYMENT_GUIDE.md` for production deployment

## Support

For issues or questions:

1. Check this documentation first
2. Review error handling patterns above
3. Search GitHub issues for similar problems
4. Create new issue with reproduction steps
5. Include MCP introspection results if applicable

---

**Last Updated**: 2025-11-18  
**Version**: 1.0.0
