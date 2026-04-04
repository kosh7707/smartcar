#!/bin/bash
# Build Agent 단독 통합 테스트
# S2 없이 독립 실행 가능
#
# 사전 조건: Build Agent(:8003), SAST Runner(:9000), LLM Gateway(:8000)
#
# 사용법:
#   ./scripts/build-test.sh                                    # 기본: gateway-webserver
#   ./scripts/build-test.sh /path/to/project gateway/          # 커스텀
#
# strict compile-first 예시:
#   BUILD_CONTRACT_VERSION=compile-first-v1 \
#   STRICT_MODE=true \
#   BUILD_MODE=native \
#   EXPECTED_ARTIFACT_KIND=executable \
#   EXPECTED_ARTIFACT_PATH=build-aegis/gateway-webserver \
#   ./scripts/build-test.sh /path/to/project gateway-webserver/
#
# shell+gcc 예시:
#   BUILD_MODE=sdk SDK_ID=ti-am335x ./scripts/build-test.sh /path/to/project gateway/

set -euo pipefail

BUILD_URL="http://localhost:8003"
SAST_URL="http://localhost:9000"
GW_URL="http://localhost:8000"

PROJECT_PATH="${1:-/home/kosh/AEGIS/uploads/proj-60bf5eb4-bc1f-4275-b7d5-15db1f939935}"
TARGET_PATH="${2:-gateway-webserver/}"
TARGET_NAME="${TARGET_PATH%/}"
REQUEST_ID="build-test-$(date +%s)"
BUILD_CONTRACT_VERSION="${BUILD_CONTRACT_VERSION:-}"
STRICT_MODE="${STRICT_MODE:-}"
BUILD_MODE="${BUILD_MODE:-}"
SDK_ID="${SDK_ID:-}"
EXPECTED_ARTIFACT_KIND="${EXPECTED_ARTIFACT_KIND:-}"
EXPECTED_ARTIFACT_PATH="${EXPECTED_ARTIFACT_PATH:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              AEGIS Build Agent 통합 테스트                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  프로젝트: ${PROJECT_PATH}"
echo "  타겟:     ${TARGET_PATH}"
[[ -n "$BUILD_CONTRACT_VERSION" ]] && echo "  contract: ${BUILD_CONTRACT_VERSION} (strict=${STRICT_MODE:-unset})"
[[ -n "$BUILD_MODE" ]] && echo "  mode:     ${BUILD_MODE}${SDK_ID:+ (sdkId=${SDK_ID})}"
[[ -n "$EXPECTED_ARTIFACT_KIND" || -n "$EXPECTED_ARTIFACT_PATH" ]] && \
    echo "  expect:   ${EXPECTED_ARTIFACT_KIND:-artifact}${EXPECTED_ARTIFACT_PATH:+ @ ${EXPECTED_ARTIFACT_PATH}}"
echo ""

# 서비스 확인
for svc in "Build Agent:${BUILD_URL}/v1/health" "SAST Runner:${SAST_URL}/v1/health" "LLM Gateway:${GW_URL}/v1/health"; do
    name="${svc%%:http*}"
    url="http${svc#*:http}"
    if curl -sf "$url" > /dev/null 2>&1; then
        printf "  ${GREEN}✓${NC} %s\n" "$name"
    else
        printf "  ${RED}✗${NC} %s — 중단\n" "$name"; exit 1
    fi
done
echo ""

# 빌드 실행
echo "[Build] POST ${BUILD_URL}/v1/tasks"
RESULT=$(curl -s -X POST "${BUILD_URL}/v1/tasks" \
    -H "Content-Type: application/json" \
    -H "X-Request-Id: ${REQUEST_ID}" \
    -d "$(python3 -c "
import json
trusted = {
    'projectPath': '${PROJECT_PATH}',
    'targetPath': '${TARGET_PATH}',
    'targetName': '${TARGET_NAME}',
}
if '${BUILD_CONTRACT_VERSION}':
    trusted['contractVersion'] = '${BUILD_CONTRACT_VERSION}'
if '${STRICT_MODE}':
    trusted['strictMode'] = '${STRICT_MODE}'.lower() in ('1', 'true', 'yes', 'on')
if '${BUILD_MODE}':
    trusted['buildMode'] = '${BUILD_MODE}'
if '${SDK_ID}':
    trusted['sdkId'] = '${SDK_ID}'
if '${EXPECTED_ARTIFACT_KIND}' or '${EXPECTED_ARTIFACT_PATH}':
    trusted['expectedArtifacts'] = [{
        'kind': '${EXPECTED_ARTIFACT_KIND}' or 'artifact',
        'path': '${EXPECTED_ARTIFACT_PATH}',
    }]

print(json.dumps({
    'taskType': 'build-resolve',
    'taskId': '${REQUEST_ID}',
    'context': {'trusted': trusted},
    'constraints': {'maxTokens': 8192, 'timeoutMs': 600000}
}))
")")

# 결과 파싱
python3 -c "
import json, sys, os
d = json.loads('''${RESULT}''' if len('''${RESULT}''') < 50000 else sys.stdin.read())
status = d.get('status', '?')
audit = d.get('audit', {}).get('agentAudit', {})
br = d.get('result', {}).get('buildResult', {})

print(f'  status:   {status}')
print(f'  turns:    {audit.get(\"turn_count\", \"?\")}')
print(f'  latency:  {audit.get(\"latency_ms\", 0)//1000}s')
if br:
    print(f'  build.ok: {br.get(\"success\", False)}')
    print(f'  command:  {br.get(\"buildCommand\", \"\")[:120]}')
    print(f'  script:   {br.get(\"buildScript\", \"\")}')
else:
    print(f'  failure:  {d.get(\"failureCode\", \"?\")}')
    print(f'  detail:   {d.get(\"failureDetail\", \"?\")[:200]}')

# 스크립트 존재 확인
script = '${PROJECT_PATH}/${TARGET_PATH}/build-aegis/aegis-build.sh'.replace('//', '/')
print(f'  script exists: {os.path.isfile(script)}')

# trace
for t in audit.get('trace', []):
    print(f'    {t[\"step_id\"]}: {t[\"tool\"]:12s} ok={t[\"success\"]}')
" <<< "$RESULT" 2>/dev/null || echo "$RESULT" | python3 -m json.tool 2>/dev/null | head -30

echo ""
echo "  요청 ID: ${REQUEST_ID}"
echo "  MCP trace: mcp__log-analyzer__trace_request ${REQUEST_ID}"
