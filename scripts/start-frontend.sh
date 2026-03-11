#!/bin/bash
# Frontend 개발 서버 기동 (Vite)
# Usage: ./scripts/start-frontend.sh

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "[Frontend] 개발 서버 기동..."
cd "$ROOT_DIR/services/frontend" && npm run dev
