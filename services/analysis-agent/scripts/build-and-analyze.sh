#!/bin/bash
# 빌드 에이전트 → 분석 에이전트 풀 파이프라인 통합 테스트
# S2 없이 독립 실행 가능
#
# 사전 조건:
#   - Build Agent (:8003)
#   - Analysis Agent (:8001)
#   - SAST Runner (:9000)
#   - LLM Gateway (:8000)
#   - Knowledge Base (:8002)
#
# 사용법:
#   ./scripts/build-and-analyze.sh                           # 기본: gateway-webserver
#   ./scripts/build-and-analyze.sh /path/to/project gateway/ # 커스텀 프로젝트+타겟
#
# 선택 환경변수:
#   BUILD_CONTRACT_VERSION=build-resolve-v1
#   STRICT_MODE=true
#   BUILD_MODE=sdk
#   SDK_ID=ti-am335x
#   BUILD_SETUP_SCRIPT=/opt/sdk/environment-setup-armv7at2hf-neon-linux-gnueabi
#   BUILD_ENV_JSON='{"CC":"/opt/toolchains/arm-gcc","SYSROOT":"/opt/sysroot"}'
#   BUILD_SCRIPT_HINT_TEXT='#!/bin/bash ...'
#   BUILD_SCRIPT_HINT_FILE=./scripts/cross_build.sh
#   BUILD_PROFILE_SDK_ID=ti-am335x

set -euo pipefail

# ─── 설정 ───
BUILD_URL="http://localhost:8003"
AGENT_URL="http://localhost:8001"
SAST_URL="http://localhost:9000"
KB_URL="http://localhost:8002"
GW_URL="http://localhost:8000"

PROJECT_PATH="${1:-/home/kosh/AEGIS/uploads/proj-60bf5eb4-bc1f-4275-b7d5-15db1f939935}"
TARGET_PATH="${2:-gateway-webserver/}"
TARGET_NAME="${TARGET_PATH%/}"
PROJECT_ID="${3:-re100-${TARGET_NAME}}"
REQUEST_ID="integ-$(date +%s)"
BUILD_CONTRACT_VERSION="${BUILD_CONTRACT_VERSION:-}"
STRICT_MODE="${STRICT_MODE:-}"
BUILD_MODE="${BUILD_MODE:-}"
SDK_ID="${SDK_ID:-}"
BUILD_SETUP_SCRIPT="${BUILD_SETUP_SCRIPT:-}"
BUILD_ENV_JSON="${BUILD_ENV_JSON:-}"
BUILD_SCRIPT_HINT_TEXT="${BUILD_SCRIPT_HINT_TEXT:-}"
BUILD_SCRIPT_HINT_FILE="${BUILD_SCRIPT_HINT_FILE:-}"
BUILD_PROFILE_SDK_ID="${BUILD_PROFILE_SDK_ID:-}"
EXPECTED_ARTIFACT_KIND="${EXPECTED_ARTIFACT_KIND:-}"
EXPECTED_ARTIFACT_PATH="${EXPECTED_ARTIFACT_PATH:-}"

if [[ -z "$BUILD_SCRIPT_HINT_TEXT" && -n "$BUILD_SCRIPT_HINT_FILE" && -f "$BUILD_SCRIPT_HINT_FILE" ]]; then
    BUILD_SCRIPT_HINT_TEXT="$(cat "$BUILD_SCRIPT_HINT_FILE")"
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║       AEGIS 빌드 + 분석 통합 테스트 파이프라인              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  프로젝트: ${PROJECT_PATH}"
echo "  타겟:     ${TARGET_PATH}"
echo "  요청 ID:  ${REQUEST_ID}"
[[ -n "$BUILD_CONTRACT_VERSION" ]] && echo "  build contract: ${BUILD_CONTRACT_VERSION} (strict=${STRICT_MODE:-unset})"
[[ -n "$BUILD_MODE" ]] && echo "  build mode: ${BUILD_MODE}${SDK_ID:+ (sdkId=${SDK_ID})}"
[[ -n "$BUILD_SETUP_SCRIPT" ]] && echo "  build setup: ${BUILD_SETUP_SCRIPT}"
[[ -n "$BUILD_ENV_JSON" ]] && echo "  build env: provided"
[[ -n "$BUILD_SCRIPT_HINT_TEXT" ]] && echo "  build hint: text provided"
[[ -n "$EXPECTED_ARTIFACT_KIND" || -n "$EXPECTED_ARTIFACT_PATH" ]] && echo "  build expect: ${EXPECTED_ARTIFACT_KIND:-artifact}${EXPECTED_ARTIFACT_PATH:+ @ ${EXPECTED_ARTIFACT_PATH}}"
echo ""

# ─── Phase 0: 서비스 상태 확인 ───
echo "[Phase 0] 서비스 상태 확인"
SERVICES=(
    "Build Agent:${BUILD_URL}/v1/health"
    "Analysis Agent:${AGENT_URL}/v1/health"
    "SAST Runner:${SAST_URL}/v1/health"
    "LLM Gateway:${GW_URL}/v1/health"
    "Knowledge Base:${KB_URL}/v1/health"
)
ALL_OK=true
for svc in "${SERVICES[@]}"; do
    name="${svc%%:http*}"
    url="http${svc#*:http}"
    if curl -sf "$url" > /dev/null 2>&1; then
        printf "  ${GREEN}✓${NC} %s\n" "$name"
    else
        printf "  ${RED}✗${NC} %s\n" "$name"
        ALL_OK=false
    fi
done
if [ "$ALL_OK" != "true" ]; then
    printf "\n${RED}일부 서비스 미기동. 중단.${NC}\n"
    exit 1
fi
echo ""

# ─── Phase 1: 빌드 에이전트 ───
echo "[Phase 1] Build Agent — 빌드 스크립트 생성"
echo "  POST ${BUILD_URL}/v1/tasks (build-resolve)"

BUILD_RESULT=$(curl -s -X POST "${BUILD_URL}/v1/tasks" \
    -H "Content-Type: application/json" \
    -H "X-Request-Id: ${REQUEST_ID}-build" \
    -d "$(python3 -c "
import json
import os
trusted = {
    'projectPath': '${PROJECT_PATH}',
    'subprojectPath': '${TARGET_PATH}',
    'subprojectName': '${TARGET_NAME}'
}
if os.environ.get('BUILD_CONTRACT_VERSION'):
    trusted['contractVersion'] = os.environ['BUILD_CONTRACT_VERSION']
if os.environ.get('STRICT_MODE'):
    trusted['strictMode'] = os.environ['STRICT_MODE'].lower() in ('1', 'true', 'yes', 'on')
if os.environ.get('BUILD_MODE'):
    trusted['build'] = {'mode': os.environ['BUILD_MODE']}
if os.environ.get('SDK_ID'):
    trusted.setdefault('build', {})['sdkId'] = os.environ['SDK_ID']
if os.environ.get('BUILD_SETUP_SCRIPT'):
    trusted.setdefault('build', {})['setupScript'] = os.environ['BUILD_SETUP_SCRIPT']
if os.environ.get('BUILD_ENV_JSON'):
    trusted.setdefault('build', {})['environment'] = json.loads(os.environ['BUILD_ENV_JSON'])
if os.environ.get('BUILD_SCRIPT_HINT_TEXT'):
    trusted.setdefault('build', {})['scriptHintText'] = os.environ['BUILD_SCRIPT_HINT_TEXT']
if os.environ.get('EXPECTED_ARTIFACT_KIND') or os.environ.get('EXPECTED_ARTIFACT_PATH'):
    trusted['expectedArtifacts'] = [{
        'kind': os.environ.get('EXPECTED_ARTIFACT_KIND') or 'artifact',
        'path': os.environ.get('EXPECTED_ARTIFACT_PATH') or '',
    }]

print(json.dumps({
    'taskType': 'build-resolve',
    'taskId': '${REQUEST_ID}-build',
    'context': {'trusted': trusted},
    'constraints': {'maxTokens': 8192, 'timeoutMs': 600000}
}))
")")

BUILD_STATUS=$(echo "$BUILD_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null)
BUILD_OK=$(echo "$BUILD_RESULT" | python3 -c "import sys,json; br=json.load(sys.stdin).get('result',{}).get('buildResult',{}); print(br.get('success', False))" 2>/dev/null)
BUILD_CMD=$(echo "$BUILD_RESULT" | python3 -c "import sys,json; br=json.load(sys.stdin).get('result',{}).get('buildResult',{}); print(br.get('buildCommand','')[:120])" 2>/dev/null)
BUILD_TURNS=$(echo "$BUILD_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('audit',{}).get('agentAudit',{}).get('turn_count','?'))" 2>/dev/null)
BUILD_LATENCY=$(echo "$BUILD_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('audit',{}).get('agentAudit',{}).get('latency_ms',0)//1000)" 2>/dev/null)

if [ "$BUILD_STATUS" = "completed" ] && [ "$BUILD_OK" = "True" ]; then
    printf "  ${GREEN}✓ 빌드 성공${NC} (${BUILD_TURNS}턴, ${BUILD_LATENCY}초)\n"
    printf "  명령어: ${CYAN}%s${NC}\n" "$BUILD_CMD"
else
    printf "  ${RED}✗ 빌드 실패${NC}: status=${BUILD_STATUS}\n"
    echo "$BUILD_RESULT" | python3 -m json.tool 2>/dev/null | head -20
    printf "\n${YELLOW}빌드 실패. 분석은 빌드 없이 진행합니다.${NC}\n"
fi
echo ""

# ─── Phase 2: 분석 에이전트 ───
echo "[Phase 2] Analysis Agent — deep-analyze"
echo "  POST ${AGENT_URL}/v1/tasks (deep-analyze)"

ANALYZE_RESULT=$(curl -s -X POST "${AGENT_URL}/v1/tasks" \
    -H "Content-Type: application/json" \
    -H "X-Request-Id: ${REQUEST_ID}-analyze" \
    -d "$(python3 -c "
import json, os
trusted = {
    'projectPath': '${PROJECT_PATH}/${TARGET_PATH}'.rstrip('/'),
    'projectId': '${PROJECT_ID}'
}
build_command = '''${BUILD_CMD}'''.strip()
if build_command:
    trusted['buildCommand'] = build_command
if os.environ.get('BUILD_ENV_JSON'):
    trusted['buildEnvironment'] = json.loads(os.environ['BUILD_ENV_JSON'])
if os.environ.get('BUILD_PROFILE_SDK_ID'):
    trusted['buildProfile'] = {'sdkId': os.environ['BUILD_PROFILE_SDK_ID']}
print(json.dumps({
    'taskType': 'deep-analyze',
    'taskId': '${REQUEST_ID}-analyze',
    'context': {'trusted': trusted},
    'constraints': {'maxTokens': 16384, 'timeoutMs': 900000}
}))
")")

ANALYZE_STATUS=$(echo "$ANALYZE_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null)
CLAIM_COUNT=$(echo "$ANALYZE_RESULT" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('result',{}).get('claims',[])))" 2>/dev/null)
CONFIDENCE=$(echo "$ANALYZE_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('result',{}).get('confidence','?'))" 2>/dev/null)
ANALYZE_TURNS=$(echo "$ANALYZE_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('audit',{}).get('agentAudit',{}).get('turn_count','?'))" 2>/dev/null)
ANALYZE_LATENCY=$(echo "$ANALYZE_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('audit',{}).get('agentAudit',{}).get('latency_ms',0)//1000)" 2>/dev/null)
VALID=$(echo "$ANALYZE_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('validation',{}).get('valid','?'))" 2>/dev/null)

echo ""
if [ "$ANALYZE_STATUS" = "completed" ]; then
    printf "  ${GREEN}✓ 분석 완료${NC} (${ANALYZE_TURNS}턴, ${ANALYZE_LATENCY}초)\n"
    printf "  claims: ${CYAN}%s${NC}  confidence: ${CYAN}%s${NC}  valid: ${CYAN}%s${NC}\n" "$CLAIM_COUNT" "$CONFIDENCE" "$VALID"
    echo ""
    echo "  Claims:"
    echo "$ANALYZE_RESULT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for i, c in enumerate(d.get('result',{}).get('claims',[])[:10]):
    loc = c.get('location','')
    print(f'    {i+1}. {c[\"statement\"][:100]}')
    if loc: print(f'       @ {loc}')
" 2>/dev/null
else
    printf "  ${RED}✗ 분석 실패${NC}: status=${ANALYZE_STATUS}\n"
    FAIL_DETAIL=$(echo "$ANALYZE_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('failureDetail','')[:200])" 2>/dev/null)
    printf "  사유: %s\n" "$FAIL_DETAIL"
fi

# ─── 요약 ───
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  요약"
echo "────────────────────────────────────────────────────────────────"
printf "  빌드:   %s\n" "$([ "$BUILD_OK" = "True" ] && echo "✓ 성공" || echo "✗ 실패")"
printf "  분석:   %s\n" "$([ "$ANALYZE_STATUS" = "completed" ] && echo "✓ ${CLAIM_COUNT} claims, confidence ${CONFIDENCE}" || echo "✗ ${ANALYZE_STATUS}")"
echo "  요청 ID: ${REQUEST_ID}"
echo "════════════════════════════════════════════════════════════════"
