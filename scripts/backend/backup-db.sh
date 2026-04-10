#!/bin/bash
# Backend DB 백업
# Usage: ./scripts/backend/backup-db.sh [backup-name]

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$ROOT_DIR/services/backend/.env"

if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
fi

DB_PATH="${DB_PATH:-$ROOT_DIR/services/backend/aegis.db}"
BACKUP_DIR="$ROOT_DIR/scripts/backend/.backups"

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

mkdir -p "$BACKUP_DIR"

NAME="${1:-$(date +%Y%m%d-%H%M%S)}"
DEST="$BACKUP_DIR/aegis-$NAME.db"

if [ -e "$DEST" ]; then
  echo "  백업 파일이 이미 존재합니다: $DEST"
  exit 1
fi

if ! sqlite3 "$DB_PATH" <<SQL
.timeout 5000
.backup '$DEST'
SQL
then
  echo "  백업 실패: sqlite3 .backup 실행 오류"
  rm -f "$DEST"
  exit 1
fi

echo "  백업 완료: $DEST ($(du -h "$DEST" | cut -f1))"
