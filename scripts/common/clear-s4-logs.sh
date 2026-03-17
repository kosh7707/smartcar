#!/bin/bash
# S4 (vLLM Engine) 로그 삭제
# Usage: ./scripts/common/clear-s4-logs.sh

DGX_HOST="accslab@10.126.37.19"
DGX_KEY="$HOME/.ssh/dgx_spark"
VLLM_LOG="/tmp/vllm-launch.log"

echo ""
echo "  S4 vLLM 로그 삭제: $DGX_HOST:$VLLM_LOG"

if [ ! -f "$DGX_KEY" ]; then
  echo "  SSH 키가 없습니다: $DGX_KEY"
  exit 1
fi

read -p "  정말 삭제하시겠습니까? (y/N) " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "  취소됨."
  exit 0
fi

ssh -i "$DGX_KEY" "$DGX_HOST" "truncate -s 0 $VLLM_LOG 2>/dev/null && echo '  삭제 완료.' || echo '  로그 파일이 없습니다.'"
