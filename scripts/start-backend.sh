#!/bin/bash
# Backend 단독 기동 (watch 모드)
# Usage: ./scripts/start-backend.sh

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/services/backend/.env"

# .env 로드
if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
fi

echo "[Backend] 포트 ${PORT:-3000} 에서 기동 (watch 모드)..."
exec npx tsx watch "$ROOT_DIR/services/backend/src/index.ts"
