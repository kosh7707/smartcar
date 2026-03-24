#!/bin/bash
# AEGIS 전체 서비스 종료
# Usage: ./scripts/stop.sh

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_DIR="$ROOT_DIR/scripts/.pids"

# 서비스 이름 → 포트 매핑 (PID 파일이 없을 때 포트로 fallback)
declare -A SERVICE_PORTS=(
  [llm-gateway]=8000
  [sast-runner]=9000
  [adapter]=4000
  [backend]=3000
  [knowledge-base]=8002
  [build-agent]=8003
  [analysis-agent]=8001
  [ecu-simulator]=""
  [frontend]=5173
)

# 색상
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

stopped=0
skipped=0
failed=0

# 프로세스 트리 전체 종료 (자식 프로세스 포함)
kill_tree() {
  local pid=$1
  local sig=${2:-TERM}
  local children
  children=$(pgrep -P "$pid" 2>/dev/null)
  for child in $children; do
    kill_tree "$child" "$sig"
  done
  kill -"$sig" "$pid" 2>/dev/null
}

# PID 또는 포트로 프로세스 종료
stop_service() {
  local name=$1
  local pid=""
  local source=""
  local pidfile="$PID_DIR/$name.pid"
  local port="${SERVICE_PORTS[$name]}"

  # 1순위: PID 파일
  if [ -f "$pidfile" ]; then
    pid=$(cat "$pidfile")
    source="pid=$pid"
    rm -f "$pidfile"
  fi

  # 2순위: PID 파일이 없거나 프로세스가 이미 죽었으면 포트로 탐색
  if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
    if [ -n "$port" ]; then
      pid=$(lsof -t -i :"$port" -sTCP:LISTEN 2>/dev/null | head -1)
      if [ -n "$pid" ]; then
        source="port=$port, pid=$pid"
      fi
    fi
  fi

  # 종료 대상 없음
  if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
    printf "  %-16s ${YELLOW}NOT RUNNING${NC}\n" "$name"
    ((skipped++))
    return 0
  fi

  # 종료 시도
  kill_tree "$pid"

  # 최대 3초 대기
  for i in 1 2 3; do
    kill -0 "$pid" 2>/dev/null || break
    sleep 1
  done

  # 아직 살아있으면 강제 종료
  if kill -0 "$pid" 2>/dev/null; then
    kill_tree "$pid" 9
    sleep 0.5
  fi

  if kill -0 "$pid" 2>/dev/null; then
    printf "  %-16s (%s) ${RED}FAILED${NC}\n" "$name" "$source"
    ((failed++))
  else
    printf "  %-16s (%s) ${GREEN}OK${NC}\n" "$name" "$source"
    ((stopped++))
  fi
}

# 포트 잔류 점검 및 정리
cleanup_ports() {
  local orphans=()

  for name in llm-gateway sast-runner knowledge-base build-agent analysis-agent adapter backend frontend; do
    local port="${SERVICE_PORTS[$name]}"
    local occupant
    occupant=$(lsof -t -i :"$port" -sTCP:LISTEN 2>/dev/null | head -1)
    if [ -n "$occupant" ]; then
      orphans+=("$name:$port:$occupant")
    fi
  done

  echo ""
  if [ ${#orphans[@]} -eq 0 ]; then
    printf "  ${GREEN}포트 정상${NC}  (3000, 4000, 5173, 8000, 8001, 8002, 9000 모두 해제됨)\n"
    return
  fi

  printf "  ${RED}포트 잔류 감지${NC} — 강제 정리\n"
  echo "  ----------------------------------------"

  for entry in "${orphans[@]}"; do
    IFS=':' read -r name port occupant <<< "$entry"
    local proc_name
    proc_name=$(ps -p "$occupant" -o comm= 2>/dev/null || echo "?")
    printf "  %-16s port=%-5s pid=%-8s (%s) ... " "$name" "$port" "$occupant" "$proc_name"

    kill -9 "$occupant" 2>/dev/null
    sleep 0.5

    if lsof -t -i :"$port" -sTCP:LISTEN &>/dev/null; then
      printf "${RED}FAILED${NC}\n"
      ((failed++))
    else
      printf "${GREEN}CLEANED${NC}\n"
    fi
  done
}

echo ""
echo "============================================"
echo "  AEGIS — 서비스 종료"
echo "============================================"
echo ""

# 역순으로 종료 (frontend → ecu → backend → adapter → knowledge-base → sast-runner → llm-gateway)
for name in frontend ecu-simulator backend adapter analysis-agent build-agent knowledge-base sast-runner llm-gateway; do
  stop_service "$name"
done

# 포트 잔류 점검
cleanup_ports

rm -rf "$PID_DIR" 2>/dev/null

echo ""
echo "============================================"
if [ $failed -gt 0 ]; then
  printf "  ${RED}종료 실패 ${failed}건${NC}  |  종료 ${stopped}건  |  미실행 ${skipped}건\n"
elif [ $stopped -eq 0 ]; then
  printf "  실행 중인 서비스가 없었습니다\n"
else
  printf "  ${GREEN}전체 종료 완료${NC}  (${stopped}건 종료"
  [ $skipped -gt 0 ] && printf ", ${skipped}건 미실행"
  printf ")\n"
fi
echo "============================================"
