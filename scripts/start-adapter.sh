#!/bin/bash
# Adapter 단독 기동
# Usage: ./scripts/start-adapter.sh [--port=4000]

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/services/adapter/.env"

# .env 로드
if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
fi

# CLI 인수가 .env보다 우선
for arg in "$@"; do
  case $arg in
    --port=*) PORT="${arg#*=}" ;;
  esac
done

echo "[Adapter] 포트 ${PORT:-4000} 에서 기동..."
exec npx tsx "$ROOT_DIR/services/adapter/src/index.ts" --port="${PORT:-4000}"
