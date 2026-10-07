#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$SCRIPT_DIR"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required."
  exit 1
fi
PORT=""
for p in $(seq 8080 8099); do
  if ! (command -v ss >/dev/null 2>&1 && ss -ltn "sport = :$p" 2>/dev/null | grep -q LISTEN); then
    PORT="$p"
    break
  fi
done
if [ -z "$PORT" ]; then
  echo "Could not find a free Nova port from 8080-8099."
  exit 1
fi
echo "Starting Nova OS on port $PORT..."
PORT="$PORT" node "$SCRIPT_DIR/start-local.js" &
PID=$!
for i in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:$PORT/api/status" >/dev/null 2>&1; then
    if command -v xdg-open >/dev/null 2>&1; then xdg-open "http://127.0.0.1:$PORT/" >/dev/null 2>&1 || true; fi
    wait "$PID"
    exit $?
  fi
  sleep 0.25
done
wait "$PID"
