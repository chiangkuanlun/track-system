#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$ROOT/server"
CLIENT_DIR="$ROOT/client"
ENV_FILE="$SERVER_DIR/.env"
LOG_DIR="$ROOT/.dev-logs"
PROXY_FILE="$LOG_DIR/proxy.conf.json"

API_PORT="${API_PORT:-3100}"
WEB_PORT="${WEB_PORT:-4200}"
HOST_NAME="${HOST_NAME:-0.0.0.0}"
INSTALL="${INSTALL:-auto}"

SERVER_PID=""
CLIENT_PID=""
STARTED_SERVER=0

step() {
  printf '\n==> %s\n' "$1"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing command: %s. %s\n' "$1" "$2" >&2
    exit 1
  fi
}

port_in_use() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "( sport = :$port )" | grep -q ":$port"
    return
  fi
  return 1
}

api_healthy() {
  local port="$1"
  curl -fsS -m 3 "http://127.0.0.1:$port/api/health" >/dev/null 2>&1
}

install_if_needed() {
  local dir="$1"
  local marker="$2"
  if [ "$INSTALL" = "1" ] || [ "$INSTALL" = "true" ] || [ ! -e "$dir/$marker" ]; then
    (
      cd "$dir"
      if [ -f package-lock.json ]; then
        npm ci --include=dev
      else
        npm install
      fi
    )
  fi
}

ensure_env() {
  if [ -f "$ENV_FILE" ]; then
    return
  fi

  local secret
  secret="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
  cat > "$ENV_FILE" <<EOF
PORT=$API_PORT
MONGO_URI=mongodb://127.0.0.1:27017/track-system
JWT_SECRET=$secret
CORS_ORIGINS=http://localhost:$WEB_PORT,http://127.0.0.1:$WEB_PORT
EOF
  printf 'Created server/.env with local MongoDB defaults.\n'
}

write_proxy_config() {
  cat > "$PROXY_FILE" <<EOF
{
  "/api": {
    "target": "http://127.0.0.1:$API_PORT",
    "secure": false,
    "changeOrigin": true
  }
}
EOF
}

wait_for_api() {
  local port="$1"
  local attempt
  for attempt in $(seq 1 40); do
    if api_healthy "$port"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

cleanup() {
  if [ -n "$CLIENT_PID" ] && kill -0 "$CLIENT_PID" >/dev/null 2>&1; then
    kill "$CLIENT_PID" >/dev/null 2>&1 || true
  fi
  if [ "$STARTED_SERVER" = "1" ] && [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

require_command node "Install Node.js 20 or newer."
require_command npm "Make sure npm is available in PATH."
require_command curl "Install curl or run the backend health check manually."

step "Prepare settings"
mkdir -p "$LOG_DIR"
ensure_env

if api_healthy "$API_PORT"; then
  printf 'API is already healthy on port %s. Reusing it.\n' "$API_PORT"
else
  if port_in_use "$API_PORT"; then
    printf 'Port %s is already in use, but /api/health is not healthy.\n' "$API_PORT" >&2
    printf 'Choose another API_PORT or stop the process using this port.\n' >&2
    exit 1
  fi

  step "Install backend packages"
  install_if_needed "$SERVER_DIR" "node_modules/.bin/nodemon"

  step "Start backend API"
  (
    cd "$SERVER_DIR"
    PORT="$API_PORT" CORS_ORIGINS="http://localhost:$WEB_PORT,http://127.0.0.1:$WEB_PORT" npm run dev
  ) > "$LOG_DIR/server.log" 2>&1 &
  SERVER_PID="$!"
  STARTED_SERVER=1

  if ! wait_for_api "$API_PORT"; then
    printf 'Backend did not become healthy. Last server log lines:\n' >&2
    tail -n 80 "$LOG_DIR/server.log" >&2 || true
    exit 1
  fi
fi

if port_in_use "$WEB_PORT"; then
  printf 'Port %s is already in use. Stop the existing frontend or set WEB_PORT=4201.\n' "$WEB_PORT" >&2
  exit 1
fi

step "Install frontend packages"
install_if_needed "$CLIENT_DIR" "node_modules/.bin/ng"
write_proxy_config

step "Start Angular frontend"
(
  cd "$CLIENT_DIR"
  npm run start -- --host "$HOST_NAME" --port "$WEB_PORT" --proxy-config "$PROXY_FILE"
) > "$LOG_DIR/client.log" 2>&1 &
CLIENT_PID="$!"

printf '\nDevelopment startup is ready.\n'
printf 'Frontend: http://localhost:%s\n' "$WEB_PORT"
printf 'Network frontend: http://172.238.19.47:%s\n' "$WEB_PORT"
printf 'API health: http://localhost:%s/api/health\n' "$API_PORT"
printf 'Server log: %s/server.log\n' "$LOG_DIR"
printf 'Client log: %s/client.log\n' "$LOG_DIR"
printf 'Press Ctrl+C to stop processes started by this script.\n\n'

wait
