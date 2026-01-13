#!/usr/bin/env bash
set -euo pipefail

ENV_NAME="${1:-}"
shift || true

if [[ "${1:-}" != "--" ]]; then
  echo "Usage: $0 {test|prod} -- <command...>" >&2
  exit 2
fi
shift

if [[ "$ENV_NAME" == "prod" && "${CONFIRM_PROD:-}" != "YES" ]]; then
  echo "Refusing to run against PROD without explicit confirmation." >&2
  echo "Set CONFIRM_PROD=YES to proceed." >&2
  exit 3
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cleanup() {
  "$SCRIPT_DIR/link-env.sh" test >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/link-env.sh" "$ENV_NAME" >/dev/null
"$@"
