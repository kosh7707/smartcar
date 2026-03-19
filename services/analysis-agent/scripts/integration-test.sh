#!/bin/bash
# Analysis Agent 통합 테스트 — S4 SAST Runner + S7 Gateway
# 사전 조건: S7 Gateway(:8000), S4 SAST Runner(:9000) 가동 중
# 사용법: ./scripts/integration-test.sh

set -euo pipefail

AGENT_URL="http://localhost:8001"
SAST_URL="http://localhost:9000"
GATEWAY_URL="http://localhost:8000"

echo "=== Analysis Agent 통합 테스트 ==="
echo ""

# 0. 서비스 상태 확인
echo "[0] 서비스 상태 확인..."
echo -n "  SAST Runner: "
curl -sf "$SAST_URL/v1/health" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{d[\"status\"]} (v{d[\"version\"]})')" || echo "UNREACHABLE"

echo -n "  S7 Gateway:  "
curl -sf "$GATEWAY_URL/v1/health" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{d[\"status\"]} (mode: {d[\"llmMode\"]})')" 2>/dev/null || echo "UNREACHABLE"

echo -n "  Agent:       "
curl -sf "$AGENT_URL/v1/health" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{d[\"status\"]} (mode: {d[\"llmMode\"]})')" || echo "UNREACHABLE"
echo ""

# 1. RE100 http_client.cpp 읽기
RE100_FILE="$HOME/RE100/RE100/gateway/apps/central/src/http_client.cpp"
RE100_HEADER="$HOME/RE100/RE100/gateway/apps/central/include/http_client.hpp"

if [ ! -f "$RE100_FILE" ]; then
    echo "[ERROR] RE100 테스트 파일을 찾을 수 없습니다: $RE100_FILE"
    exit 1
fi

echo "[1] RE100 http_client.cpp 읽기..."
FILE_CONTENT=$(cat "$RE100_FILE" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))")
HEADER_CONTENT=""
if [ -f "$RE100_HEADER" ]; then
    HEADER_CONTENT=$(cat "$RE100_HEADER" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))")
fi
echo "  파일 크기: $(wc -c < "$RE100_FILE") bytes"
echo ""

# 2. 시나리오 1: deep-analyze (SAST 스캔 + 트리아지)
echo "[2] 시나리오 1: deep-analyze 요청 (SAST 스캔 + 트리아지)..."

REQUEST_BODY=$(cat <<EOFBODY
{
  "taskType": "deep-analyze",
  "taskId": "integration-test-001",
  "context": {
    "trusted": {
      "objective": "RE100 http_client.cpp 보안 취약점 심층 분석",
      "buildProfile": {
        "sdkId": "ti-am335x",
        "compiler": "arm-none-linux-gnueabihf-gcc",
        "targetArch": "arm-cortex-a8",
        "languageStandard": "c++17",
        "headerLanguage": "cpp"
      },
      "files": [
        {"path": "src/http_client.cpp", "content": $FILE_CONTENT}
      ]
    }
  },
  "evidenceRefs": [
    {
      "refId": "eref-http-client",
      "artifactId": "art-re100",
      "artifactType": "raw-source",
      "locatorType": "lineRange",
      "locator": {"file": "src/http_client.cpp", "fromLine": 1, "toLine": 200}
    }
  ],
  "constraints": {
    "maxTokens": 4096,
    "timeoutMs": 120000
  }
}
EOFBODY
)

echo "  요청 전송 중..."
RESPONSE=$(curl -sf -X POST "$AGENT_URL/v1/tasks" \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: integration-test-001" \
  -d "$REQUEST_BODY" 2>&1) || {
    echo "  [ERROR] 요청 실패"
    echo "$RESPONSE"
    exit 1
}

echo ""
echo "[3] 응답 분석..."
echo "$RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  상태: {d[\"status\"]}')
print(f'  Task Type: {d[\"taskType\"]}')

if d['status'] == 'completed':
    r = d['result']
    print(f'  요약: {r[\"summary\"][:200]}...')
    print(f'  Claims: {len(r[\"claims\"])}개')
    for i, c in enumerate(r['claims'][:5]):
        print(f'    [{i+1}] {c[\"statement\"][:100]}')
    print(f'  심각도: {r.get(\"suggestedSeverity\", \"N/A\")}')
    print(f'  신뢰도: {r[\"confidence\"]}')
    print(f'  사람 검토 필요: {r[\"needsHumanReview\"]}')

    a = d['audit']
    print(f'  지연시간: {a[\"latencyMs\"]}ms')
    print(f'  토큰: prompt={a[\"tokenUsage\"][\"prompt\"]}, completion={a[\"tokenUsage\"][\"completion\"]}')

    if a.get('agentAudit'):
        aa = a['agentAudit']
        print(f'  에이전트 턴: {aa[\"turn_count\"]}')
        print(f'  Tool 호출: {aa[\"tool_call_count\"]}')
        print(f'  종료 사유: {aa[\"termination_reason\"]}')
        if aa.get('trace'):
            print(f'  Tool trace:')
            for t in aa['trace']:
                print(f'    [{t[\"step_id\"]}] {t[\"tool\"]} ({t[\"cost_tier\"]}) {t[\"duration_ms\"]}ms success={t[\"success\"]}')
else:
    print(f'  실패 코드: {d.get(\"failureCode\", \"N/A\")}')
    print(f'  실패 상세: {d.get(\"failureDetail\", \"N/A\")}')
" || {
    echo "  [WARN] 응답 파싱 실패. 원본:"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
}

echo ""
echo "=== 통합 테스트 완료 ==="
