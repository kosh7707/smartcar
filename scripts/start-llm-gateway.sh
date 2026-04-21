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

export PATH="$(pwd)/.venv/bin:$PATH"

cmd=(
  .venv/bin/python -m uvicorn app.main:app
  --host 0.0.0.0
  --port "${AEGIS_LLM_GATEWAY_PORT:-8000}"
  --reload
  --reload-dir app
)

if [[ "${AEGIS_PRINT_CMD:-0}" == "1" ]]; then
  printf '%q ' "${cmd[@]}"
  printf '\n'
  exit 0
fi

exec "${cmd[@]}"
