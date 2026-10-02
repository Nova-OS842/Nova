#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$SCRIPT_DIR"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required."
  exit 1
fi
exec node "$SCRIPT_DIR/start-local.js"
