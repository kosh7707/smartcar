#!/bin/bash
# Frontend 개발 서버 기동 (Vite)
# Usage: ./scripts/start-frontend.sh

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/services/frontend/.env"

# .env 로드 (Vite도 자체적으로 읽지만, 스크립트 레벨에서도 export)
if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
fi

echo "[Frontend] 개발 서버 기동..."
cd "$ROOT_DIR/services/frontend" && exec npm run dev:renderer
