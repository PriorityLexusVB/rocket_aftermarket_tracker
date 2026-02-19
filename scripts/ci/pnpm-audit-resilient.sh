#!/usr/bin/env bash
set -euo pipefail

AUDIT_OUTPUT=""
AUDIT_EXIT=0
MAX_ATTEMPTS="${PNPM_AUDIT_MAX_ATTEMPTS:-3}"
AUDIT_LEVEL="${PNPM_AUDIT_LEVEL:-high}"

for ((i = 1; i <= MAX_ATTEMPTS; i++)); do
  echo "pnpm audit attempt $i/$MAX_ATTEMPTS..."

  set +e
  AUDIT_OUTPUT=$(pnpm -s audit --audit-level="$AUDIT_LEVEL" --json 2>&1)
  AUDIT_EXIT=$?
  set -e

  if [ "$AUDIT_EXIT" -eq 0 ]; then
    echo "$AUDIT_OUTPUT"
    exit 0
  fi

  if echo "$AUDIT_OUTPUT" | grep -q "ERR_PNPM_AUDIT_BAD_RESPONSE"; then
    echo "Audit endpoint returned a bad response; retrying..."
    sleep $((i * 5))
    continue
  fi

  echo "$AUDIT_OUTPUT"
  exit "$AUDIT_EXIT"
done

echo "$AUDIT_OUTPUT"
if echo "$AUDIT_OUTPUT" | grep -q "ERR_PNPM_AUDIT_BAD_RESPONSE"; then
  echo "::warning::pnpm audit skipped after repeated npm audit endpoint failures (ERR_PNPM_AUDIT_BAD_RESPONSE)."
  exit 0
fi

exit "$AUDIT_EXIT"
