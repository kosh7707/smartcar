#!/usr/bin/env bash
# AEGIS Knowledge Base — 위협 지식 ETL 파이프라인
# CWE + ATT&CK (ICS+Enterprise) + CAPEC → Qdrant 벡터 DB
#
# 사전 조건:
#   - KB 서비스(:8002)가 중지된 상태여야 함 (Qdrant 파일 락 충돌 방지)
#   - .venv 설치 완료
#
# Usage:
#   ./scripts/knowledge-base/etl-build.sh           # Qdrant 적재만
#   ./scripts/knowledge-base/etl-build.sh --seed     # Qdrant + Neo4j 시드
#   ./scripts/knowledge-base/etl-build.sh --include-nvd  # NVD CVE 사전 적재 (레거시)
set -euo pipefail

KB_DIR="$(cd "$(dirname "$0")/../../services/knowledge-base" && pwd)"
QDRANT_PATH="$KB_DIR/data/qdrant"
SEED=false

for arg in "$@"; do
  case $arg in
    --seed) SEED=true ;;
  esac
done

cd "$KB_DIR"

if [ ! -d ".venv" ]; then
  echo "ERROR: .venv not found. Run: python3 -m venv .venv && pip install -r requirements.txt"
  exit 1
fi

# Qdrant 파일 락 확인
if lsof "$QDRANT_PATH/.lock" &>/dev/null 2>&1; then
  echo "ERROR: Qdrant DB가 다른 프로세스에 의해 사용 중입니다."
  echo "       KB 서비스를 먼저 중지하세요: ./scripts/stop.sh"
  exit 1
fi

echo "=== AEGIS KB ETL Pipeline ==="
echo "  Qdrant: $QDRANT_PATH"
echo ""

# Phase 1~5: ETL 실행
.venv/bin/python scripts/threat-db/build.py --qdrant-path "$QDRANT_PATH" "$@"

# Neo4j 시드 (--seed 옵션)
if [ "$SEED" = true ]; then
  echo ""
  echo "=== Neo4j Seed ==="

  # Neo4j 실행 확인
  NEO4J_HOME="${NEO4J_HOME:-$HOME/neo4j-community-5.26.3}"
  if [ -x "$NEO4J_HOME/bin/neo4j" ]; then
    STATUS=$("$NEO4J_HOME/bin/neo4j" status 2>&1 || true)
    if echo "$STATUS" | grep -q "not running"; then
      echo "  Neo4j 기동 중..."
      "$NEO4J_HOME/bin/neo4j" start
      for i in $(seq 1 15); do
        if bash -c "echo > /dev/tcp/localhost/7687" 2>/dev/null; then
          echo "  Neo4j ready (${i}초)"
          break
        fi
        sleep 1
      done
    fi
  else
    echo "ERROR: Neo4j 미설치 ($NEO4J_HOME)"
    exit 1
  fi

  .venv/bin/python scripts/neo4j-seed.py --qdrant-path "$QDRANT_PATH" --clear
  echo ""
  echo "=== Neo4j Seed 완료 ==="
fi

echo ""
echo "=== ETL 완료 ==="
echo "  다음 단계: ./scripts/start-knowledge-base.sh 로 KB 서비스 기동"
