#!/usr/bin/env bash
# S3 LLM Gateway — static-explain RAG 통합 테스트
# 서버 기동 → health 확인 → static-explain 요청 → 결과 검증 → 종료
set -euo pipefail

PORT=8199  # 충돌 방지용 임시 포트
BASE="http://localhost:${PORT}"
PID=""

cleanup() {
  if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
    echo -e "\n🔽 서버 종료 (PID=$PID)..."
    kill "$PID" 2>/dev/null
    wait "$PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

cd "$(dirname "$0")/.."

echo "═══════════════════════════════════════════"
echo " S3 Integration Test: static-explain + RAG"
echo "═══════════════════════════════════════════"

# 1. 서버 기동
echo -e "\n[1/4] 서버 기동 (port=$PORT)..."
.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --log-level warning &
PID=$!
echo "  PID=$PID"

# 2. Health 대기
echo -e "\n[2/4] Health check 대기..."
for i in $(seq 1 30); do
  if curl -sf "${BASE}/v1/health" > /dev/null 2>&1; then
    echo "  서버 준비 완료 (${i}초)"
    break
  fi
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "  ❌ 서버가 비정상 종료됨"
    exit 1
  fi
  sleep 1
done

# Health 응답 출력
echo -e "\n[2/4] Health 응답:"
HEALTH=$(curl -sf "${BASE}/v1/health" | python3 -m json.tool)
echo "$HEALTH"

RAG_STATUS=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('rag',{}).get('status','unknown'))")
echo -e "\n  ➜ RAG 상태: $RAG_STATUS"
if [[ "$RAG_STATUS" != "ok" ]]; then
  echo "  ⚠️  RAG가 비활성 상태입니다. Qdrant 데이터를 확인하세요."
fi

# 3. static-explain 요청
echo -e "\n[3/4] static-explain 요청 전송..."
RESPONSE=$(curl -sf -X POST "${BASE}/v1/tasks" \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: integ-test-rag-001" \
  -d '{
    "taskType": "static-explain",
    "taskId": "integ-test-rag-001",
    "context": {
      "trusted": {
        "finding": {
          "ruleId": "CWE-120",
          "title": "Buffer Copy without Checking Size of Input (Classic Buffer Overflow)",
          "severity": "critical",
          "description": "The product copies an input buffer to an output buffer without verifying that the size of the input buffer is less than the size of the output buffer, leading to a buffer overflow.",
          "location": "ecu_firmware/can_handler.c:142"
        }
      },
      "untrusted": {
        "sourceSnippet": "void process_can_msg(uint8_t *data, int len) {\n  char buf[64];\n  memcpy(buf, data, len);  // len not validated\n  parse_diagnostic_frame(buf);\n}"
      }
    },
    "evidenceRefs": [
      {
        "refId": "eref-001",
        "artifactId": "art-fw-001",
        "artifactType": "raw-source",
        "locatorType": "lineRange",
        "locator": {"file": "ecu_firmware/can_handler.c", "fromLine": 140, "toLine": 150}
      }
    ]
  }' 2>&1) || {
  echo "  ❌ 요청 실패"
  echo "$RESPONSE"
  exit 1
}

# 4. 결과 검증
echo -e "\n[4/4] 응답 검증:"
echo "$RESPONSE" | python3 -m json.tool

STATUS=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status', 'unknown'))")
RAG_HITS=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('audit',{}).get('ragHits', 0))")
MODEL=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('modelProfile', 'N/A'))")
LATENCY=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('audit',{}).get('latencyMs', 'N/A'))")

echo ""
echo "═══════════════════════════════════════════"
echo " 결과 요약"
echo "═══════════════════════════════════════════"
echo "  status:    $STATUS"
echo "  ragHits:   $RAG_HITS"
echo "  model:     $MODEL"
echo "  latency:   ${LATENCY}ms"

if [[ "$STATUS" == "completed" && "$RAG_HITS" -gt 0 ]]; then
  echo -e "\n  ✅ 통합 테스트 성공: RAG 증강 정상 작동"
elif [[ "$STATUS" == "completed" && "$RAG_HITS" == "0" ]]; then
  echo -e "\n  ⚠️  LLM 응답 성공이나 RAG 히트 없음"
else
  echo -e "\n  ❌ 테스트 실패 (status=$STATUS)"
fi
