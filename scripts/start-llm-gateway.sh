#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../services/llm-gateway"

# .env 로드 (pydantic-settings도 읽지만, 스크립트 레벨에서도 export)
if [ -f ".env" ]; then
  set -a; source ".env"; set +a
fi

if [ ! -d ".venv" ]; then
  echo "ERROR: .venv not found. Run: python3 -m venv .venv && pip install -r requirements.txt"
  exit 1
fi

exec .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
