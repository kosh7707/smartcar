#!/bin/bash
# Backend DB 현황 조회
# Usage: ./scripts/backend/db-stats.sh

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$ROOT_DIR/services/backend/.env"

if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
fi

DB_PATH="${DB_PATH:-$ROOT_DIR/services/backend/aegis.db}"

if [ ! -f "$DB_PATH" ]; then
  echo "  DB 파일이 없습니다."
  exit 1
fi

echo ""
echo "============================================"
echo "  Backend DB 현황"
echo "============================================"
echo ""

sqlite3 "$DB_PATH" <<'SQL'
.mode column
.headers on

SELECT
  'projects' AS "테이블", COUNT(*) AS "건수" FROM projects
UNION ALL SELECT
  'uploaded_files', COUNT(*) FROM uploaded_files
UNION ALL SELECT
  'analysis_results', COUNT(*) FROM analysis_results
UNION ALL SELECT
  'rules', COUNT(*) FROM rules
UNION ALL SELECT
  'adapters', COUNT(*) FROM adapters
UNION ALL SELECT
  'dynamic_sessions', COUNT(*) FROM dynamic_analysis_sessions
UNION ALL SELECT
  'dynamic_alerts', COUNT(*) FROM dynamic_analysis_alerts
UNION ALL SELECT
  'dynamic_messages', COUNT(*) FROM dynamic_analysis_messages
UNION ALL SELECT
  'dynamic_tests', COUNT(*) FROM dynamic_test_results;
SQL

echo ""
echo "  크기: $(du -h "$DB_PATH" | cut -f1)"
echo "============================================"
