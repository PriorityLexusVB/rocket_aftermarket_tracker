#!/usr/bin/env bash
set -euo pipefail

REF_FILE="supabase/.temp/project-ref"

if [[ -f "$REF_FILE" ]]; then
  REF="$(tr -d '\r\n' < "$REF_FILE")"
  if [[ -n "$REF" ]]; then
    echo "linked project-ref: $REF"
    exit 0
  fi
fi

echo "linked project-ref: (unknown)" >&2
exit 1
