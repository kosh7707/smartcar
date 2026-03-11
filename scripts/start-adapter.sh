#!/bin/bash
# Adapter 단독 기동
# Usage: ./scripts/start-adapter.sh [--port=4000]

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="4000"

for arg in "$@"; do
  case $arg in
    --port=*) PORT="${arg#*=}" ;;
  esac
done

echo "[Adapter] 포트 $PORT 에서 기동..."
exec npx tsx "$ROOT_DIR/services/adapter/src/index.ts" --port="$PORT"
