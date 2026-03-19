#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../services/knowledge-base"

# .env 로드 (pydantic-settings도 읽지만, 스크립트 레벨에서도 export)
if [ -f ".env" ]; then
  set -a; source ".env"; set +a
fi

if [ ! -d ".venv" ]; then
  echo "ERROR: .venv not found. Run: python3 -m venv .venv && pip install -r requirements.txt"
  exit 1
fi

# Neo4j 기동 (KB 의존성)
NEO4J_HOME="${NEO4J_HOME:-$HOME/neo4j-community-5.26.3}"
if [ -x "$NEO4J_HOME/bin/neo4j" ]; then
  STATUS=$("$NEO4J_HOME/bin/neo4j" status 2>&1 || true)
  if echo "$STATUS" | grep -q "not running"; then
    echo "[KB] Neo4j 기동 중..."
    "$NEO4J_HOME/bin/neo4j" start
    echo "[KB] Neo4j 기동 완료 — 안정화 대기 5초"
    sleep 5
  else
    echo "[KB] Neo4j 이미 실행 중"
  fi
else
  echo "[KB] WARNING: Neo4j 미설치 ($NEO4J_HOME) — 그래프 기능 비활성화로 기동"
fi

exec .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port "${AEGIS_KB_PORT:-8002}"
