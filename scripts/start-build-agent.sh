#!/bin/bash
# Build Agent (:8003) 기동 스크립트
# 소유: S3 (Analysis Agent 겸임)
set -euo pipefail

cd "$(dirname "$0")/../services/build-agent"

if [ ! -d ".venv" ]; then
    echo "Build Agent .venv가 없습니다. 먼저 설치하세요:"
    echo "  cd services/build-agent && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
    exit 1
fi

cmd=(
    .venv/bin/python -m uvicorn app.main:app
    --host 0.0.0.0
    --port 8003
    --reload
    --reload-dir app
)

if [[ "${AEGIS_PRINT_CMD:-0}" == "1" ]]; then
    printf '%q ' "${cmd[@]}"
    printf '\n'
    exit 0
fi

exec "${cmd[@]}"
