#!/bin/bash
# Backend runtime state 초기화 (DB + uploads 동시 삭제)
# Usage: ./scripts/backend/reset-runtime-state.sh [--yes]

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$ROOT_DIR/services/backend/.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

DB_PATH="${DB_PATH:-$ROOT_DIR/services/backend/aegis.db}"
UPLOADS_DIR="${UPLOADS_DIR:-$ROOT_DIR/uploads}"
DB_ARTIFACTS=("$DB_PATH" "$DB_PATH-wal" "$DB_PATH-shm")
CONFIRM=false

for arg in "$@"; do
  case "$arg" in
    --yes) CONFIRM=true ;;
    --help|-h)
      sed -n '2,3p' "$0" | sed 's/^# //'
      exit 0
      ;;
    *)
      echo "  알 수 없는 옵션: $arg"
      exit 1
      ;;
  esac
done

if ! command -v python3 >/dev/null 2>&1; then
  echo "  python3 명령을 찾을 수 없습니다."
  exit 1
fi

if [ -z "$DB_PATH" ] || [ -z "$UPLOADS_DIR" ]; then
  echo "  DB_PATH 또는 UPLOADS_DIR 가 비어 있습니다."
  exit 1
fi

if command -v lsof >/dev/null 2>&1; then
  listeners=$(lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | egrep ':(3000|4000|5173|8000|8001|8002|8003|9000) ' || true)
  if [ -n "$listeners" ]; then
    echo "  현재 AEGIS 서비스가 실행 중입니다. 먼저 ./scripts/stop.sh 로 종료하세요."
    echo "$listeners"
    exit 1
  fi

  holders=$(lsof "${DB_ARTIFACTS[@]}" 2>/dev/null | tail -n +2 || true)
  if [ -n "$holders" ]; then
    echo "  DB 파일을 사용 중인 프로세스가 있습니다. 먼저 서비스를 종료하세요."
    echo "$holders"
    exit 1
  fi
fi

echo ""
echo "  Runtime state 초기화"
echo "    DB:      $DB_PATH"
echo "    Uploads: $UPLOADS_DIR"

if [ "$CONFIRM" != "true" ]; then
  read -r -p "  DB와 uploads를 모두 삭제합니다. 계속할까요? (y/N) " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "  취소됨."
    exit 0
  fi
fi

export ROOT_DIR DB_PATH UPLOADS_DIR
python3 - <<'PY'
import os
import shutil

root = os.path.realpath(os.environ["ROOT_DIR"])
db_path = os.path.realpath(os.environ["DB_PATH"])
uploads_dir = os.path.realpath(os.environ["UPLOADS_DIR"])

def ensure_scoped(target: str, label: str) -> None:
    if not target.startswith(root + os.sep):
        raise SystemExit(f"Unsafe {label}: {target}")

ensure_scoped(db_path, "DB_PATH")
ensure_scoped(uploads_dir, "UPLOADS_DIR")

for suffix in ("", "-wal", "-shm"):
    artifact = db_path + suffix
    if os.path.lexists(artifact):
        if os.path.isdir(artifact):
            raise SystemExit(f"Refusing to delete directory masquerading as DB artifact: {artifact}")
        os.remove(artifact)

if os.path.isdir(uploads_dir):
    for name in os.listdir(uploads_dir):
        target = os.path.join(uploads_dir, name)
        if os.path.islink(target) or os.path.isfile(target):
            os.remove(target)
        else:
            shutil.rmtree(target)
else:
    os.makedirs(uploads_dir, exist_ok=True)

os.makedirs(uploads_dir, exist_ok=True)
print(f"  DB cleared: {db_path}")
print(f"  Uploads cleared: {uploads_dir}")
PY

echo "  완료. 서버 재시작 시 빈 DB와 빈 uploads 루트로 시작합니다."
