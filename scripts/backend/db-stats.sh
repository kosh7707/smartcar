#!/bin/bash
# Backend DB 현황 조회
# Usage: ./scripts/backend/db-stats.sh

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$ROOT_DIR/services/backend/.env"

if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
fi

DB_PATH="${DB_PATH:-$ROOT_DIR/services/backend/aegis.db}"
EXPECTED_TABLE_COUNT=30

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "  sqlite3 명령을 찾을 수 없습니다."
  exit 1
fi

if [ -z "$DB_PATH" ]; then
  echo "  DB 경로가 비어 있습니다."
  exit 1
fi

if [ -d "$DB_PATH" ]; then
  echo "  DB 경로가 파일이 아니라 디렉토리입니다: $DB_PATH"
  exit 1
fi

if [ ! -f "$DB_PATH" ]; then
  echo "  DB 파일이 없습니다."
  exit 1
fi

if [ ! -r "$DB_PATH" ]; then
  echo "  DB 파일을 읽을 수 없습니다: $DB_PATH"
  exit 1
fi

echo ""
echo "============================================"
echo "  Backend DB 현황 (핵심 21 테이블 + execution/persistence seam 9개)"
echo "============================================"
echo ""

if ! sqlite3 "$DB_PATH" <<'SQL'
.timeout 5000
.mode column
.headers on

SELECT
  'projects' AS "테이블", COUNT(*) AS "건수" FROM projects
UNION ALL SELECT
  'uploaded_files', COUNT(*) FROM uploaded_files
UNION ALL SELECT
  'analysis_results', COUNT(*) FROM analysis_results
UNION ALL SELECT
  'runs', COUNT(*) FROM runs
UNION ALL SELECT
  'findings', COUNT(*) FROM findings
UNION ALL SELECT
  'evidence_refs', COUNT(*) FROM evidence_refs
UNION ALL SELECT
  'gate_results', COUNT(*) FROM gate_results
UNION ALL SELECT
  'approvals', COUNT(*) FROM approvals
UNION ALL SELECT
  'audit_log', COUNT(*) FROM audit_log
UNION ALL SELECT
  'adapters', COUNT(*) FROM adapters
UNION ALL SELECT
  'project_settings', COUNT(*) FROM project_settings
UNION ALL SELECT
  'build_targets', COUNT(*) FROM build_targets
UNION ALL SELECT
  'notifications', COUNT(*) FROM notifications
UNION ALL SELECT
  'users', COUNT(*) FROM users
UNION ALL SELECT
  'sessions', COUNT(*) FROM sessions
UNION ALL SELECT
  'sdk_registry', COUNT(*) FROM sdk_registry
UNION ALL SELECT
  'target_libraries', COUNT(*) FROM target_libraries
UNION ALL SELECT
  'dynamic_analysis_sessions', COUNT(*) FROM dynamic_analysis_sessions
UNION ALL SELECT
  'dynamic_analysis_alerts', COUNT(*) FROM dynamic_analysis_alerts
UNION ALL SELECT
  'dynamic_analysis_messages', COUNT(*) FROM dynamic_analysis_messages
UNION ALL SELECT
  'dynamic_test_results', COUNT(*) FROM dynamic_test_results;
SQL
then
  echo "  DB 통계 조회 실패: 잠금 상태이거나 스키마가 초기화되지 않았을 수 있습니다."
  exit 1
fi

actual_table_count=$(sqlite3 "$DB_PATH" <<SQL
.timeout 5000
SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%';
SQL
)

echo ""
echo "  크기: $(du -h "$DB_PATH" | cut -f1)"
echo "  전체 테이블 수: ${actual_table_count:-unknown} (기대값: $EXPECTED_TABLE_COUNT)"
if [ -n "$actual_table_count" ] && [ "$actual_table_count" -ne "$EXPECTED_TABLE_COUNT" ]; then
  echo "  경고: 전체 스키마 테이블 수가 기대값과 다릅니다."
fi
echo "============================================"
