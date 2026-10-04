#!/bin/bash
set -euo pipefail

gunicorn --bind 127.0.0.1:5001 --workers 2 --access-logfile - --error-logfile - app:app &
api_pid=$!

NITRO_HOST=127.0.0.1 NITRO_PORT=3000 node /app/frontend/.output/server/index.mjs &
frontend_pid=$!

nginx -g 'daemon off;' &
nginx_pid=$!

cleanup() {
    kill "$nginx_pid" "$frontend_pid" "$api_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait -n "$nginx_pid" "$frontend_pid" "$api_pid"
