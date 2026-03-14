#!/bin/bash
# Smartcar 전체 서비스 백그라운드 기동
# Usage: ./scripts/start.sh [options]
#   --no-ecu          ECU Simulator 미기동
#   --no-frontend     Frontend 미기동
#   --scenario=NAME   ECU 시나리오 (기본: mixed)
#   --speed=N         ECU 트래픽 속도 (기본: 1)
#   --help            도움말

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_DIR="$ROOT_DIR/scripts/.pids"
LOG_DIR="$ROOT_DIR/scripts/.logs"

SCENARIO="mixed"
SPEED="1"
START_ECU=true
START_FRONTEND=true
HEALTH_TIMEOUT=10

# 색상
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
DIM='\033[2m'
NC='\033[0m'

started=0
failed=0
skipped=0
started_services=()

for arg in "$@"; do
  case $arg in
    --no-ecu)       START_ECU=false ;;
    --no-frontend)  START_FRONTEND=false ;;
    --scenario=*)   SCENARIO="${arg#*=}" ;;
    --speed=*)      SPEED="${arg#*=}" ;;
    --help)
      sed -n '2,8p' "$0" | sed 's/^# //'
      exit 0
      ;;
  esac
done

# 이미 실행 중이면 경고
if [ -d "$PID_DIR" ] && ls "$PID_DIR"/*.pid &>/dev/null; then
  printf "  ${YELLOW}이미 실행 중인 서비스가 있습니다.${NC} 먼저 ./scripts/stop.sh 를 실행하세요.\n"
  exit 1
fi

mkdir -p "$PID_DIR" "$LOG_DIR"

# 프로세스 트리 전체 종료 (롤백용)
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

start_service() {
  local name="$1"
  local port="$2"
  shift 2
  local cmd="$*"
  local t0=$SECONDS

  printf "  %-16s" "$name"

  # 포트 충돌 확인
  if [ -n "$port" ] && lsof -t -i :"$port" &>/dev/null; then
    printf " ${YELLOW}SKIP${NC}  포트 $port 이미 사용 중\n"
    ((skipped++))
    return 0
  fi

  # 프로세스 실행
  eval "$cmd" > "$LOG_DIR/$name.log" 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_DIR/$name.pid"

  # 헬스체크
  if [ -n "$port" ]; then
    # 포트 기반 서비스: LISTEN 상태까지 대기
    local deadline=$((SECONDS + HEALTH_TIMEOUT))
    while [ $SECONDS -lt $deadline ]; do
      if lsof -t -i :"$port" -sTCP:LISTEN &>/dev/null; then
        printf " ${GREEN}OK${NC}    pid=%-8s port=%-5s ${DIM}(%ss)${NC}\n" "$pid" "$port" "$((SECONDS - t0))"
        ((started++))
        started_services+=("$name")
        return 0
      fi
      if ! kill -0 "$pid" 2>/dev/null; then
        printf " ${RED}FAIL${NC}  프로세스 즉시 종료 ${DIM}(%ss, 로그: $LOG_DIR/$name.log)${NC}\n" "$((SECONDS - t0))"
        ((failed++))
        return 1
      fi
      sleep 0.5
    done
    # 타임아웃
    printf " ${RED}FAIL${NC}  포트 $port 타임아웃 ${DIM}(%ss, 로그: $LOG_DIR/$name.log)${NC}\n" "$((SECONDS - t0))"
    ((failed++))
    return 1
  else
    # 포트 없는 서비스 (ecu-simulator): PID 생존만 확인
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
      printf " ${GREEN}OK${NC}    pid=%-8s             ${DIM}(%ss)${NC}\n" "$pid" "$((SECONDS - t0))"
      ((started++))
      started_services+=("$name")
      return 0
    else
      printf " ${RED}FAIL${NC}  프로세스 즉시 종료 ${DIM}(%ss, 로그: $LOG_DIR/$name.log)${NC}\n" "$((SECONDS - t0))"
      ((failed++))
      return 1
    fi
  fi
}

# 롤백: 기동 성공한 서비스를 역순 종료
rollback() {
  echo ""
  printf "  ${RED}기동 실패 — 롤백${NC}\n"
  echo "  ----------------------------------------"

  for (( i=${#started_services[@]}-1; i>=0; i-- )); do
    local name="${started_services[$i]}"
    local pidfile="$PID_DIR/$name.pid"
    if [ -f "$pidfile" ]; then
      local pid
      pid=$(cat "$pidfile")
      printf "  %-16s" "$name"
      kill_tree "$pid"
      for j in 1 2 3; do
        kill -0 "$pid" 2>/dev/null || break
        sleep 1
      done
      if kill -0 "$pid" 2>/dev/null; then
        kill_tree "$pid" 9
        printf " ${YELLOW}KILLED${NC}\n"
      else
        printf " ${GREEN}stopped${NC}\n"
      fi
      rm -f "$pidfile"
    fi
  done

  rm -rf "$PID_DIR" 2>/dev/null
}

# .env 로드 헬퍼 — 서브쉘 커맨드 앞에 삽입
load_env() {
  local envfile="$1"
  if [ -f "$envfile" ]; then
    echo "set -a; source '$envfile'; set +a;"
  fi
}

# 순서대로 기동 — 하나라도 실패하면 즉시 중단
run_all() {
  start_service "llm-gateway" 8000 \
    "cd '$ROOT_DIR/services/llm-gateway' && $(load_env "$ROOT_DIR/services/llm-gateway/.env") source .venv/bin/activate && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload" || return 1

  start_service "adapter" 4000 \
    "$(load_env "$ROOT_DIR/services/adapter/.env") exec npx tsx watch '$ROOT_DIR/services/adapter/src/index.ts' --port=4000" || return 1

  start_service "backend" 3000 \
    "$(load_env "$ROOT_DIR/services/backend/.env") exec npx tsx watch '$ROOT_DIR/services/backend/src/index.ts'" || return 1

  if [ "$START_ECU" = true ]; then
    start_service "ecu-simulator" "" \
      "$(load_env "$ROOT_DIR/services/ecu-simulator/.env") exec npx tsx watch '$ROOT_DIR/services/ecu-simulator/src/index.ts' --adapter=ws://localhost:4000/ws/ecu --scenario=$SCENARIO --speed=$SPEED --loop" || return 1
  fi

  if [ "$START_FRONTEND" = true ]; then
    start_service "frontend" 5173 \
      "$(load_env "$ROOT_DIR/services/frontend/.env") cd '$ROOT_DIR/services/frontend' && exec npm run dev" || return 1
  fi
}

echo ""
echo "============================================"
echo "  Smartcar — 서비스 기동"
echo "============================================"
echo ""

if ! run_all; then
  rollback
  echo ""
  echo "============================================"
  printf "  ${RED}기동 중단${NC}  (성공 ${started}건, 실패 ${failed}건 — 전체 롤백 완료)\n"
  echo "============================================"
  exit 1
fi

echo ""
echo "============================================"
printf "  ${GREEN}기동 완료${NC}  (${started}건 시작"
[ $skipped -gt 0 ] && printf ", ${skipped}건 스킵"
printf ")\n"
echo "============================================"
echo "  LLM Gateway:   http://localhost:8000"
echo "  Adapter:        http://localhost:4000"
echo "  Backend:        http://localhost:3000"
[ "$START_ECU" = true ]      && echo "  ECU Simulator:  시나리오=$SCENARIO, 속도=${SPEED}x"
[ "$START_FRONTEND" = true ] && echo "  Frontend:       http://localhost:5173"
echo ""
echo "  로그:  $LOG_DIR/"
echo "  종료:  ./scripts/stop.sh"
echo "============================================"
