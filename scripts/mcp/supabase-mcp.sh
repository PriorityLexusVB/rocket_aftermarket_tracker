#!/usr/bin/env bash
set -euo pipefail

# Loads SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN from .env.e2e.local (recommended)
# or from the current environment.
# Hard-blocks known production refs to prevent accidental prod access.

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

check_only="false"
# Defaults to .env.e2e.local unless a different env file is passed.
env_file_arg=".env.e2e.local"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check)
      check_only="true"
      shift
      ;;
    -h|--help)
      echo "Usage: scripts/mcp/supabase-mcp.sh [path-to-env-file] [--check]" >&2
      echo "  Defaults to: .env.e2e.local" >&2
      echo "  --check: validates env + safety guards, then exits 0" >&2
      exit 0
      ;;
    *)
      env_file_arg="$1"
      shift
      ;;
  esac
done

# Load local env file if present (gitignored)
# Usage:
#   scripts/mcp/supabase-mcp.sh [path-to-env-file]
# Defaults to .env.e2e.local
if [[ "$env_file_arg" = /* ]]; then
  env_file="$env_file_arg"
else
  env_file="$repo_root/$env_file_arg"
fi
if [[ -f "$env_file" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a
fi

selected_env="${MCP_ENV:-e2e}"
selected_env="${selected_env,,}"

project_ref="${SUPABASE_PROJECT_REF:-}"
if [[ -z "$project_ref" ]]; then
  case "$selected_env" in
    e2e)
      project_ref="${SUPABASE_PROJECT_REF_E2E:-}"
      ;;
    dev)
      project_ref="${SUPABASE_PROJECT_REF_DEV:-}"
      ;;
    staging)
      project_ref="${SUPABASE_PROJECT_REF_STAGING:-}"
      ;;
    *)
      echo "ERROR: MCP_ENV must be one of: e2e | dev | staging (got: '$selected_env')." >&2
      exit 2
      ;;
  esac
fi

if [[ -z "$project_ref" ]]; then
  echo "ERROR: Supabase project ref is not set." >&2
  echo "Set SUPABASE_PROJECT_REF=... (recommended) in .env.e2e.local, OR set MCP_ENV and one of:" >&2
  echo "  - SUPABASE_PROJECT_REF_E2E=... (for MCP_ENV=e2e)" >&2
  echo "  - SUPABASE_PROJECT_REF_DEV=... (for MCP_ENV=dev)" >&2
  echo "  - SUPABASE_PROJECT_REF_STAGING=... (for MCP_ENV=staging)" >&2
  exit 2
fi

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "ERROR: SUPABASE_ACCESS_TOKEN is not set." >&2
  echo "Add SUPABASE_ACCESS_TOKEN=... to .env.e2e.local (recommended) or export it in your shell." >&2
  exit 2
fi

# Block known production project ref(s)
case "$project_ref" in
  ogjtmtndgiqqdtwatsue)
    echo "ERROR: Refusing to start Supabase MCP against the known production project ref ($project_ref)." >&2
    echo "Use a dedicated E2E/staging Supabase project ref instead." >&2
    exit 3
    ;;
esac

if [[ "$check_only" = "true" ]]; then
  echo "OK: Supabase MCP env validated (project_ref=$project_ref)" >&2
  exit 0
fi

exec npx @supabase/mcp-server-supabase@0.5.10 \
  --project-ref "$project_ref" \
  --features account,docs,database,debugging,development,functions,storage,branching \
  --api-url https://api.supabase.com
