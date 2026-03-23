#!/bin/bash
# 전체 서비스 로그 초기화 (logs/*.jsonl 일괄 truncate)
# Usage: ./scripts/common/reset-logs.sh

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/logs}"

if [ ! -d "$LOG_DIR" ]; then
  echo "  로그 디렉토리 없음: $LOG_DIR"
  exit 0
fi

echo ""
echo "  로그 초기화: $LOG_DIR"
echo "  ────────────────────────"

cleared=0
for f in "$LOG_DIR"/*.jsonl; do
  [ -f "$f" ] || continue
  name="$(basename "$f")"
  size=$(du -h "$f" | cut -f1)
  : > "$f"
  echo "  ✓ $name ($size → 0)"
  ((cleared++))
done

echo ""
echo "  완료: ${cleared}건 초기화"
echo ""
