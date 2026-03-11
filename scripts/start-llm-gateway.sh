#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../services/llm-gateway"

if [ ! -d ".venv" ]; then
  echo "ERROR: .venv not found. Run: python3 -m venv .venv && pip install -r requirements.txt"
  exit 1
fi

source .venv/bin/activate
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
