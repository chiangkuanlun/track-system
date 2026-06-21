#!/usr/bin/env bash
set -euo pipefail

cd /workspaces/track-system
mkdir -p .codespaces

if [[ -f .codespaces/server.pid ]] && kill -0 "$(cat .codespaces/server.pid)" 2>/dev/null; then
  exit 0
fi

cd server
nohup node dist/app.js > ../.codespaces/server.log 2>&1 &
echo $! > ../.codespaces/server.pid
