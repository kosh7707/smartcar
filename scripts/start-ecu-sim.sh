#!/bin/bash
# ECU Simulator 단독 기동
# Usage: ./scripts/start-ecu-sim.sh [--adapter=ws://localhost:4000/ws/ecu] [--scenario=mixed] [--speed=1] [--loop]

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/services/ecu-simulator/.env"

# .env 로드
if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
fi

# .env 기본값 적용 후 CLI 인수로 오버라이드
ADAPTER="${ADAPTER_URL:-ws://localhost:4000/ws/ecu}"
SCENARIO="${SCENARIO:-mixed}"
SPEED="${SPEED:-1}"
LOOP=""

for arg in "$@"; do
  case $arg in
    --adapter=*)  ADAPTER="${arg#*=}" ;;
    --scenario=*) SCENARIO="${arg#*=}" ;;
    --speed=*)    SPEED="${arg#*=}" ;;
    --loop)       LOOP="--loop" ;;
  esac
done

echo "[ECU Sim] 시나리오=$SCENARIO, 속도=${SPEED}x, 어댑터=$ADAPTER"
exec npx tsx "$ROOT_DIR/services/ecu-simulator/src/index.ts" \
  --adapter="$ADAPTER" \
  --scenario="$SCENARIO" \
  --speed="$SPEED" \
  $LOOP
