#!/bin/bash
# Backend DB 초기화 (전체 삭제 후 서버 재시작)
# Usage: ./scripts/backend/reset-db.sh

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
DB_PATH="$ROOT_DIR/services/backend/smartcar.db"

echo ""
echo "  DB 초기화: $DB_PATH"

if [ ! -f "$DB_PATH" ]; then
  echo "  DB 파일이 없습니다. 이미 초기 상태입니다."
  exit 0
fi

read -p "  정말 삭제하시겠습니까? (y/N) " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "  취소됨."
  exit 0
fi

rm -f "$DB_PATH" "$DB_PATH-wal" "$DB_PATH-shm"
echo "  삭제 완료. 서버 재시작 시 빈 DB로 생성됩니다."
