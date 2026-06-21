#!/usr/bin/env bash
set -euo pipefail

cd /workspaces/track-system/client
npm ci
npm run build

cd /workspaces/track-system/server
npm ci
npm run build
