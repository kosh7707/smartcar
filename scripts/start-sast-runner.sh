#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../services/sast-runner"

# .env 로드 (pydantic-settings도 읽지만, 스크립트 레벨에서도 export)
if [ -f ".env" ]; then
  set -a; source ".env"; set +a
fi

if [ ! -d ".venv" ]; then
  echo "ERROR: .venv not found. Run: python3 -m venv .venv && pip install -r requirements.txt"
  exit 1
fi

export PATH="$(pwd)/.venv/bin:$PATH"

hot_reload="${SAST_HOT_RELOAD:-1}"
export SAST_HOT_RELOAD="${hot_reload}"

cmd=(
  .venv/bin/python -m uvicorn app.main:app
  --host 0.0.0.0
  --port "${SAST_PORT:-9000}"
)

case "${hot_reload,,}" in
  1|true|yes|on)
    cmd+=(--reload --reload-dir "$(pwd)/app")
    ;;
esac

if [[ "${AEGIS_PRINT_CMD:-0}" == "1" ]]; then
  printf '%q ' "${cmd[@]}"
  printf '\n'
  exit 0
fi

exec "${cmd[@]}"
