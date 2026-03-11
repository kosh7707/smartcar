#!/bin/bash
# ECU Simulator 단독 기동
# Usage: ./scripts/start-ecu-sim.sh [--adapter=ws://localhost:4000/ws/ecu] [--scenario=mixed] [--speed=1] [--loop]

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

ADAPTER="ws://localhost:4000/ws/ecu"
SCENARIO="mixed"
SPEED="1"
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
