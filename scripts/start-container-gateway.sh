#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/services/container-gateway"
if [ -f ".env" ]; then
  set -a; source ".env"; set +a
fi
echo "[Container Gateway] watch 모드로 기동..."
exec npx tsx watch src/index.ts
