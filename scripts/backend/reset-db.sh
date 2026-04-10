#!/bin/bash
# Backend DB 초기화 (전체 삭제 후 서버 재시작)
# Usage: ./scripts/backend/reset-db.sh

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$ROOT_DIR/services/backend/.env"

if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
fi

DB_PATH="${DB_PATH:-$ROOT_DIR/services/backend/aegis.db}"
DB_DIR="$(dirname "$DB_PATH")"
DB_ARTIFACTS=("$DB_PATH" "$DB_PATH-wal" "$DB_PATH-shm")

if [ -z "$DB_PATH" ]; then
  echo "  DB 경로가 비어 있습니다."
  exit 1
fi

if [ ! -d "$DB_DIR" ]; then
  echo "  DB 디렉토리가 없습니다: $DB_DIR"
  exit 1
fi

echo ""
echo "  DB 초기화: $DB_PATH"

if [ -d "$DB_PATH" ]; then
  echo "  DB 경로가 파일이 아니라 디렉토리입니다: $DB_PATH"
  exit 1
fi

if command -v lsof >/dev/null 2>&1; then
  holders=$(lsof "${DB_ARTIFACTS[@]}" 2>/dev/null | tail -n +2)
  if [ -n "$holders" ]; then
    echo "  DB 파일을 사용 중인 프로세스가 있습니다. 먼저 서버를 종료하세요."
    echo "$holders"
    exit 1
  fi
fi

if [ ! -f "$DB_PATH" ] && [ ! -f "$DB_PATH-wal" ] && [ ! -f "$DB_PATH-shm" ]; then
  echo "  DB 파일이 없습니다. 이미 초기 상태입니다."
  exit 0
fi

read -p "  정말 삭제하시겠습니까? (y/N) " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "  취소됨."
  exit 0
fi

rm -f "${DB_ARTIFACTS[@]}"
echo "  삭제 완료. 서버 재시작 시 빈 DB로 생성됩니다."
