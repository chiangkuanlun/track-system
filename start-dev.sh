#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$ROOT/server"
CLIENT_DIR="$ROOT/client"
ENV_FILE="$SERVER_DIR/.env"
LOG_DIR="$ROOT/.dev-logs"

API_PORT="${API_PORT:-3000}"
WEB_PORT="${WEB_PORT:-4200}"
HOST_NAME="${HOST_NAME:-0.0.0.0}"
INSTALL="${INSTALL:-auto}"

step() {
  printf '\n==> %s\n' "$1"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf '找不到 %s。%s\n' "$1" "$2" >&2
    exit 1
  fi
}

install_if_needed() {
  local dir="$1"
  if [ "$INSTALL" = "1" ] || [ "$INSTALL" = "true" ] || [ ! -d "$dir/node_modules" ]; then
    (
      cd "$dir"
      if [ -f package-lock.json ]; then
        npm ci
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
  printf '已建立 server/.env，預設連線 mongodb://127.0.0.1:27017/track-system\n'
}

check_port() {
  local port="$1"
  if command -v ss >/dev/null 2>&1 && ss -ltn "( sport = :$port )" | grep -q ":$port"; then
    printf '提醒：Port %s 目前已有程式監聽，若啟動失敗請先關閉該程式或改用環境變數覆寫。\n' "$port"
  fi
}

cleanup() {
  if [ -n "${SERVER_PID:-}" ] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
  if [ -n "${CLIENT_PID:-}" ] && kill -0 "$CLIENT_PID" >/dev/null 2>&1; then
    kill "$CLIENT_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

require_command node "請先安裝 Node.js 20 以上版本。"
require_command npm "請確認 npm 已加入 PATH。"

step "準備環境設定"
ensure_env
mkdir -p "$LOG_DIR"
check_port "$API_PORT"
check_port "$WEB_PORT"

step "確認後端套件"
install_if_needed "$SERVER_DIR"

step "確認前端套件"
install_if_needed "$CLIENT_DIR"

step "啟動後端 API"
(
  cd "$SERVER_DIR"
  PORT="$API_PORT" CORS_ORIGINS="http://localhost:$WEB_PORT,http://127.0.0.1:$WEB_PORT" npm run dev
) > "$LOG_DIR/server.log" 2>&1 &
SERVER_PID="$!"

step "啟動前端 Angular"
(
  cd "$CLIENT_DIR"
  npm run start -- --host "$HOST_NAME" --port "$WEB_PORT" --proxy-config proxy.conf.json
) > "$LOG_DIR/client.log" 2>&1 &
CLIENT_PID="$!"

printf '\n一鍵啟動完成。\n'
printf '前端測試網址：http://localhost:%s\n' "$WEB_PORT"
printf 'API 健康檢查：http://localhost:%s/api/health\n' "$API_PORT"
printf '後端紀錄：%s/server.log\n' "$LOG_DIR"
printf '前端紀錄：%s/client.log\n' "$LOG_DIR"
printf '如果資料庫連線失敗，請確認 MongoDB 已啟動。\n'
printf '按 Ctrl+C 可一起關閉前後端。\n\n'

wait
