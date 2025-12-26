#!/usr/bin/env bash
set -euo pipefail

# Load env for scripts (bash-safe). Vite will also read .env.local on its own.
set -a
source .env.local
set +a

BASE_URL="${BASE_URL:-http://localhost:5173}"

echo "== verify-capabilities =="
BASE_URL="$BASE_URL" node scripts/verify-capabilities.js

echo
echo "== verify-schema-cache =="
bash scripts/verify-schema-cache.sh
