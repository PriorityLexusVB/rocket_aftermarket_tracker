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

  # pnpm audit --json exits 1 for ANY vulnerabilities regardless of --audit-level.
  # Parse the JSON metadata to enforce the stated threshold correctly.
  HIGH_CRIT=$(echo "$AUDIT_OUTPUT" | node -e "
let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>{
  try{const v=JSON.parse(d).metadata?.vulnerabilities||{};
    process.stdout.write(String((v.high||0)+(v.critical||0)));}
  catch{process.stdout.write('1');}
});" 2>/dev/null || echo "1")

  if [ "${HIGH_CRIT:-1}" = "0" ]; then
    echo "::notice::pnpm audit: 0 high/critical vulnerabilities (threshold: $AUDIT_LEVEL). Moderate-only findings present."
    echo "$AUDIT_OUTPUT"
    exit 0
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
