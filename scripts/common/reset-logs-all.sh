#!/bin/bash
# 전체 서비스 로그 초기화 (S2 · S3 · S4)
# S1은 파일 로그 없음
# Usage: ./scripts/common/reset-logs-all.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 서비스별 스크립트 (파일명이 제각각이므로 명시)
SCRIPTS=(
  "reset-logs-s2.sh"
  "clean-s3-logs.sh"
  "clear-s4-logs.sh"
)

echo ""
echo "============================================"
echo "  전체 로그 초기화"
echo "============================================"

for name in "${SCRIPTS[@]}"; do
  script="$SCRIPT_DIR/$name"
  if [ -x "$script" ]; then
    bash "$script"
  else
    echo ""
    echo "  [$name] 스크립트 없음 — 스킵"
    echo ""
  fi
done

echo "============================================"
echo "  전체 로그 초기화 완료"
echo "============================================"
echo ""
