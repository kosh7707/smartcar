#!/bin/bash
# 프로젝트 전반 보안 분석 — SAST 스캔 + 코드 그래프 + 에이전트 심층 분석
# 사전 조건: SAST Runner(:9000), Knowledge Base(:8002), Analysis Agent(:8001) 가동 중
# 사용법: ./scripts/project-scan.sh

set -euo pipefail

AGENT_URL="http://localhost:8001"
SAST_URL="http://localhost:9000"
KB_URL="http://localhost:8002"
PROJECT_ID="re100-gateway"
SRC_DIR="$HOME/RE100/RE100/gateway-webserver/src"
REQUEST_ID="project-scan-$(date +%s)"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         RE100 프로젝트 전반 보안 분석 파이프라인            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ─────────────────────────────────────────────────
# Phase 0: 서비스 상태 확인
# ─────────────────────────────────────────────────
echo "[Phase 0] 서비스 상태 확인"
for svc in "SAST Runner:$SAST_URL/v1/health" "Knowledge Base:$KB_URL/v1/health" "Agent:$AGENT_URL/v1/health"; do
    name="${svc%%:*}"
    url="${svc#*:}"
    if curl -sf "$url" > /dev/null 2>&1; then
        echo "  ✅ $name"
    else
        echo "  ❌ $name — 중단"; exit 1
    fi
done
echo ""

# ─────────────────────────────────────────────────
# Phase 1: 소스 파일 수집
# ─────────────────────────────────────────────────
echo "[Phase 1] 소스 파일 수집: $SRC_DIR"
FILES_JSON="["
FIRST=true
FILE_COUNT=0
TOTAL_BYTES=0

while IFS= read -r filepath; do
    relpath="${filepath#$SRC_DIR/}"
    content=$(python3 -c "import sys,json; print(json.dumps(open(sys.argv[1]).read()))" "$filepath")
    size=$(wc -c < "$filepath")
    TOTAL_BYTES=$((TOTAL_BYTES + size))
    FILE_COUNT=$((FILE_COUNT + 1))

    if [ "$FIRST" = true ]; then
        FIRST=false
    else
        FILES_JSON+=","
    fi
    FILES_JSON+="{\"path\":\"src/$relpath\",\"content\":$content}"
done < <(find "$SRC_DIR" -name "*.cpp" -o -name "*.c" -o -name "*.h" -o -name "*.hpp" | sort)

FILES_JSON+="]"
echo "  $FILE_COUNT 파일, $(numfmt --to=iec $TOTAL_BYTES 2>/dev/null || echo "${TOTAL_BYTES}B")"
echo ""

# ─────────────────────────────────────────────────
# Phase 2: SAST 스캔 (전체 파일)
# ─────────────────────────────────────────────────
echo "[Phase 2] SAST 스캔 실행..."
SCAN_BODY=$(python3 -c "
import json, sys
files = json.loads(sys.argv[1])
print(json.dumps({
    'scanId': '$REQUEST_ID',
    'projectId': '$PROJECT_ID',
    'files': files,
    'rulesets': ['p/c', 'p/security-audit'],
    'options': {'timeout_seconds': 120}
}))
" "$FILES_JSON")

SCAN_START=$(date +%s%3N)
SCAN_RESPONSE=$(echo "$SCAN_BODY" | curl -sf -X POST "$SAST_URL/v1/scan" \
    -H "Content-Type: application/json" \
    -H "X-Request-Id: $REQUEST_ID" \
    --data-binary @- 2>&1) || {
    echo "  ❌ SAST 스캔 실패"
    echo "$SCAN_RESPONSE"
    exit 1
}
SCAN_END=$(date +%s%3N)
SCAN_MS=$((SCAN_END - SCAN_START))

FINDING_COUNT=$(echo "$SCAN_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('findings',[])))")
echo "  ✅ 스캔 완료: ${FINDING_COUNT}개 findings (${SCAN_MS}ms)"

echo "$SCAN_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
stats = d.get('stats', {})
print(f'  파일: {stats.get(\"filesScanned\",\"?\")}개 스캔')
print(f'  도구별:')
findings = d.get('findings', [])
tools = {}
for f in findings:
    t = f.get('toolId', 'unknown')
    tools[t] = tools.get(t, 0) + 1
for t, c in sorted(tools.items()):
    print(f'    {t}: {c}개')
sevs = {}
for f in findings:
    s = f.get('severity', 'unknown')
    sevs[s] = sevs.get(s, 0) + 1
if sevs:
    print(f'  심각도별:')
    for s, c in sorted(sevs.items(), key=lambda x: x[1], reverse=True):
        print(f'    {s}: {c}개')
"
echo ""

# ─────────────────────────────────────────────────
# Phase 3: 코드 그래프 추출 + KB 적재
# ─────────────────────────────────────────────────
echo "[Phase 3] 코드 그래프 추출 (projectPath 모드)..."
PROJECT_ROOT="$HOME/RE100/RE100/gateway-webserver"
FUNC_RESPONSE=$(curl -sf -X POST "$SAST_URL/v1/functions" \
    -H "Content-Type: application/json" \
    -H "X-Request-Id: $REQUEST_ID" \
    -d "{
      \"scanId\": \"$REQUEST_ID-func\",
      \"projectId\": \"$PROJECT_ID\",
      \"projectPath\": \"$PROJECT_ROOT\",
      \"buildProfile\": {
        \"compiler\": \"g++\",
        \"targetArch\": \"x86_64\",
        \"languageStandard\": \"c++17\",
        \"headerLanguage\": \"cpp\",
        \"includePaths\": [\"src\", \"libraries/civetweb/include\", \"libraries/rapidjson/include\"]
      }
    }" 2>&1) || {
    echo "  ⚠ 함수 추출 실패 (계속 진행)"
    FUNC_RESPONSE='{"functions":[]}'
}

FUNC_COUNT=$(echo "$FUNC_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('functions',[])))")
echo "  함수 ${FUNC_COUNT}개 추출"

if [ "$FUNC_COUNT" -gt 0 ]; then
    echo "  KB에 코드 그래프 적재 중 (src/ 필터)..."
    INGEST_RESPONSE=$(echo "$FUNC_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
src = [f for f in d['functions'] if f.get('file','').startswith('src/')]
print(json.dumps({'functions': src}))
" | curl -sf -X POST "$KB_URL/v1/code-graph/$PROJECT_ID/ingest" \
        -H "Content-Type: application/json" \
        --data-binary @- 2>&1) || echo "  ⚠ KB 적재 실패"
    echo "  ✅ $(echo "$INGEST_RESPONSE" | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'노드={d.get(\"nodeCount\",0)}, 엣지={d.get(\"edgeCount\",0)}')" 2>/dev/null || echo "적재 결과 확인 불가")"
fi
echo ""

# ─────────────────────────────────────────────────
# Phase 3.5: SCA 라이브러리 식별
# ─────────────────────────────────────────────────
echo "[Phase 3.5] SCA 라이브러리 식별..."
SCA_RESPONSE=$(curl -sf -X POST "$SAST_URL/v1/libraries" \
    -H "Content-Type: application/json" \
    -H "X-Request-Id: $REQUEST_ID" \
    -d "{
      \"scanId\": \"$REQUEST_ID-sca\",
      \"projectId\": \"$PROJECT_ID\",
      \"projectPath\": \"$PROJECT_ROOT\"
    }" 2>&1) || {
    echo "  ⚠ SCA 실패 (계속 진행)"
    SCA_RESPONSE='{"libraries":[]}'
}
SCA_COUNT=$(echo "$SCA_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('libraries',[])))")
echo "  ✅ 라이브러리 ${SCA_COUNT}개 식별"
echo ""

# ─────────────────────────────────────────────────
# Phase 4: 에이전트 심층 분석
# ─────────────────────────────────────────────────
echo "[Phase 4] 에이전트 심층 분석 (Phase 2 only — pre-computed 결과 사용)..."

# Phase 1 결과를 context.trusted에 직접 전달 (Agent는 Phase 2만 실행)
AGENT_BODY=$(python3 -c "
import json, sys

files = json.loads(sys.argv[1])
scan = json.loads(sys.argv[2])
sca = json.loads(sys.argv[3])
findings = scan.get('findings', [])
libraries = sca.get('libraries', [])

# evidence refs: 각 파일마다 1개
evidence_refs = []
for i, f in enumerate(files):
    evidence_refs.append({
        'refId': f'eref-file-{i:02d}',
        'artifactId': 'art-$PROJECT_ID',
        'artifactType': 'raw-source',
        'locatorType': 'lineRange',
        'locator': {'file': f['path'], 'fromLine': 1, 'toLine': 9999}
    })

# SAST findings도 evidence에 추가
for i, finding in enumerate(findings[:20]):
    evidence_refs.append({
        'refId': f'eref-sast-{i:02d}',
        'artifactId': 'art-sast-$REQUEST_ID',
        'artifactType': 'sast-finding',
        'locatorType': 'lineRange',
        'locator': {
            'file': finding.get('location', {}).get('file', ''),
            'fromLine': finding.get('location', {}).get('line', 0),
            'toLine': finding.get('location', {}).get('line', 0) + 10
        }
    })

request = {
    'taskType': 'deep-analyze',
    'taskId': '$REQUEST_ID',
    'context': {
        'trusted': {
            'objective': 'RE100 gateway-webserver 프로젝트 전반 보안 취약점 심층 분석. SAST 결과와 코드 구조를 바탕으로 위협을 식별하고 심각도를 평가하라.',
            'buildProfile': {
                'sdkId': 'ti-am335x',
                'compiler': 'arm-none-linux-gnueabihf-gcc',
                'targetArch': 'arm-cortex-a8',
                'languageStandard': 'c++17',
                'headerLanguage': 'cpp'
            },
            'sastFindings': findings,
            'scaLibraries': libraries,
            'projectId': '$PROJECT_ID',
        }
    },
    'evidenceRefs': evidence_refs,
    'constraints': {
        'maxTokens': 16384,
        'timeoutMs': 900000
    }
}
print(json.dumps(request))
" "$FILES_JSON" "$SCAN_RESPONSE" "$SCA_RESPONSE")

echo "  요청 전송 중... (최대 15분)"
AGENT_START=$(date +%s%3N)
AGENT_BODY_FILE=$(mktemp /tmp/agent-body-XXXXXX.json)
echo "$AGENT_BODY" > "$AGENT_BODY_FILE"
AGENT_RESPONSE=$(curl -s --max-time 900 -X POST "$AGENT_URL/v1/tasks" \
    -H "Content-Type: application/json" \
    -H "X-Request-Id: $REQUEST_ID" \
    -d @"$AGENT_BODY_FILE" 2>&1)
CURL_EXIT=$?
rm -f "$AGENT_BODY_FILE"
if [ $CURL_EXIT -ne 0 ] || [ -z "$AGENT_RESPONSE" ]; then
    echo "  ❌ 에이전트 분석 실패 (curl exit=$CURL_EXIT)"
    echo "$AGENT_RESPONSE" | head -20
    exit 1
fi
AGENT_END=$(date +%s%3N)
AGENT_MS=$((AGENT_END - AGENT_START))

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                        분석 결과                           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "$AGENT_RESPONSE" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
except json.JSONDecodeError as e:
    print(f'❌ JSON 파싱 실패: {e}')
    sys.exit(1)
print(f'상태: {d.get(\"status\", \"unknown\")}')
print(f'Task: {d.get(\"taskType\", \"unknown\")}')

if d['status'] == 'completed':
    r = d['result']
    print()
    print('── 요약 ──')
    print(r['summary'][:1000])
    print()
    print(f'── Claims ({len(r[\"claims\"])}개) ──')
    for i, c in enumerate(r['claims'][:10]):
        print(f'  [{i+1}] {c[\"statement\"][:120]}')
        if c.get('detail'):
            print(f'      📋 detail ({len(c[\"detail\"])}자):')
            for line in c['detail'][:500].split('\\n')[:6]:
                print(f'        {line}')
            if len(c['detail']) > 500:
                print(f'        ...(이하 {len(c[\"detail\"])-500}자 생략)')
    print()
    print(f'심각도: {r.get(\"suggestedSeverity\", \"N/A\")}')
    print(f'신뢰도: {r[\"confidence\"]}')
    print(f'사람 검토 필요: {r[\"needsHumanReview\"]}')
    if r.get('caveats'):
        print(f'주의사항: {r[\"caveats\"][:3]}')

    a = d['audit']
    print()
    print('── 에이전트 감사 ──')
    print(f'지연시간: {a[\"latencyMs\"]}ms')
    print(f'토큰: prompt={a[\"tokenUsage\"][\"prompt\"]}, completion={a[\"tokenUsage\"][\"completion\"]}')

    if a.get('agentAudit'):
        aa = a['agentAudit']
        print(f'턴: {aa[\"turn_count\"]}')
        print(f'Tool 호출: {aa[\"tool_call_count\"]}')
        print(f'종료 사유: {aa[\"termination_reason\"]}')
        if aa.get('trace'):
            print(f'Tool trace:')
            for t in aa['trace']:
                status = '✅' if t['success'] else '❌'
                refs = len(t.get('new_evidence_refs', []))
                print(f'  {status} [{t[\"step_id\"]}] {t[\"tool\"]} ({t[\"cost_tier\"]}) {t[\"duration_ms\"]}ms evidence={refs}')
else:
    print(f'실패: {d.get(\"failureCode\",\"?\")} — {d.get(\"failureDetail\",\"?\")}')
"

echo ""
echo "═══ 파이프라인 완료 ═══"
echo "  SAST 스캔: ${FINDING_COUNT} findings (${SCAN_MS}ms)"
echo "  코드 그래프: ${FUNC_COUNT} functions"
echo "  SCA: ${SCA_COUNT} libraries"
echo "  에이전트 분석: ${AGENT_MS}ms"
echo "  Request ID: $REQUEST_ID"
echo ""
echo "로그 추적: grep '$REQUEST_ID' logs/*.jsonl"
