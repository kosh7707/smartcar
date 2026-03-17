#!/bin/bash
# S2 (Backend · Adapter · ECU-Simulator) 로그 초기화
# Usage: ./scripts/common/reset-logs-s2.sh

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/logs}"

S2_LOGS=(
  "s2-backend.jsonl"
  "adapter.jsonl"
  "ecu-simulator.jsonl"
)

echo ""
echo "  [S2] 로그 초기화: $LOG_DIR"

cleared=0
for log in "${S2_LOGS[@]}"; do
  target="$LOG_DIR/$log"
  if [ -f "$target" ]; then
    size=$(du -h "$target" | cut -f1)
    : > "$target"
    echo "  ✓ $log ($size → 0)"
    ((cleared++))
  else
    echo "  - $log (없음, 스킵)"
  fi
done

echo "  완료: ${cleared}/${#S2_LOGS[@]} 파일 초기화됨"
echo ""
