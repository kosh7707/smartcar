#!/usr/bin/env bash
# LLM Engine (DGX Spark vLLM) 헬스 모니터링 스크립트
# 상태 변경 시에만 로그를 남긴다 (노이즈 최소화).
#
# 사용법:
#   nohup scripts/llm-engine-health.sh &
#   scripts/llm-engine-health.sh          # 포그라운드 실행
#
# 로그: logs/llm-engine-health.log

set -euo pipefail

ENDPOINT="${AEGIS_LLM_ENDPOINT:-http://10.126.37.19:8000}"
INTERVAL="${AEGIS_HEALTH_INTERVAL:-30}"
LOG_DIR="$(cd "$(dirname "$0")/.." && pwd)/logs"
LOG_FILE="$LOG_DIR/llm-engine-health.log"

mkdir -p "$LOG_DIR"

prev_status="unknown"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "LLM Engine 헬스 모니터링 시작 (endpoint=$ENDPOINT, interval=${INTERVAL}s)"

while true; do
    http_code=$(curl -sf -o /dev/null -w "%{http_code}" "$ENDPOINT/health" 2>/dev/null || echo "000")

    if [ "$http_code" = "200" ]; then
        status="ok"
    else
        status="down (HTTP $http_code)"
    fi

    if [ "$status" != "$prev_status" ]; then
        if [ "$status" = "ok" ]; then
            log "ENGINE UP — $ENDPOINT 정상 응답"
        else
            log "ENGINE DOWN — $ENDPOINT 응답 없음 ($status)"
        fi
        prev_status="$status"
    fi

    sleep "$INTERVAL"
done
