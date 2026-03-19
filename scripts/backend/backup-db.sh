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

if [ ! -f "$DB_PATH" ]; then
  echo "  DB 파일이 없습니다."
  exit 1
fi

mkdir -p "$BACKUP_DIR"

NAME="${1:-$(date +%Y%m%d-%H%M%S)}"
DEST="$BACKUP_DIR/aegis-$NAME.db"

sqlite3 "$DB_PATH" ".backup '$DEST'"
echo "  백업 완료: $DEST ($(du -h "$DEST" | cut -f1))"
