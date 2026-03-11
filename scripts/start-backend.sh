#!/bin/bash
# Backend 단독 기동 (watch 모드)
# Usage: ./scripts/start-backend.sh

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "[Backend] 포트 3000 에서 기동 (watch 모드)..."
exec npx tsx watch "$ROOT_DIR/services/backend/src/index.ts"
