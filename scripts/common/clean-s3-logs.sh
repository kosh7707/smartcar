#!/usr/bin/env bash
# S3 LLM Gateway 로그 삭제
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
DIM='\033[2m'
NC='\033[0m'

targets=(
  "$ROOT_DIR/logs/s3-llm-gateway.jsonl"
  "$ROOT_DIR/logs/s4-exchange.jsonl"
  "$ROOT_DIR/scripts/.logs/llm-gateway.log"
)

deleted=0

echo ""
echo "  S3 LLM Gateway 로그 정리"
echo "  ────────────────────────"

for f in "${targets[@]}"; do
  name="${f#$ROOT_DIR/}"
  if [ -f "$f" ]; then
    size=$(du -sh "$f" 2>/dev/null | cut -f1)
    rm -f "$f"
    printf "  ${GREEN}삭제${NC}  %-40s ${DIM}(%s)${NC}\n" "$name" "$size"
    deleted=$((deleted + 1))
  else
    printf "  ${DIM}없음${NC}  %s\n" "$name"
  fi
done

echo ""
printf "  완료: %d건 삭제\n" "$deleted"
echo ""
