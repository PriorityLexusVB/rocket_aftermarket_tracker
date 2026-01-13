#!/usr/bin/env bash
set -euo pipefail

ENV_NAME="${1:-}"

case "$ENV_NAME" in
  test)
    PROJECT_REF="ntpoblmjxfivomcwmjrj"
    ;;
  prod)
    PROJECT_REF="ogjtmtndgiqqdtwatsue"
    ;;
  *)
    echo "Usage: $0 {test|prod}" >&2
    exit 2
    ;;
esac

if [[ "$ENV_NAME" == "prod" && "${CONFIRM_PROD:-}" != "YES" ]]; then
  echo "Refusing to link to PROD without explicit confirmation." >&2
  echo "Set CONFIRM_PROD=YES to proceed." >&2
  exit 3
fi

npx -y supabase@latest link --project-ref "$PROJECT_REF" --password ""

echo "Linked Supabase CLI to $ENV_NAME ($PROJECT_REF)"
