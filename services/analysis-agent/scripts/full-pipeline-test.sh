#!/bin/bash
# 풀 파이프라인 통합 테스트: deep-analyze → claims → 각 claim별 PoC 생성
# 사전 조건: S3(:8001), S4(:9000), S5(:8002), S7(:8000) 가동 중
set -uo pipefail

AGENT_URL="http://localhost:8001"
SAST_URL="http://localhost:9000"
KB_URL="http://localhost:8002"
PROJECT_ID="re100-gateway"
SRC_DIR="$HOME/RE100/RE100/gateway-webserver/src"
PROJECT_ROOT="$HOME/RE100/RE100/gateway-webserver"
REQUEST_ID="full-pipeline-$(date +%s)"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     RE100 풀 파이프라인 통합 테스트 (분석 + PoC 생성)      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ─────────────────────────────────────────────────
# Phase 0: 서비스 상태 확인
# ─────────────────────────────────────────────────
echo "[Phase 0] 서비스 상태 확인"
for svc in "SAST Runner:$SAST_URL/v1/health" "Knowledge Base:$KB_URL/v1/health" "Agent:$AGENT_URL/v1/health" "Gateway:http://localhost:8000/v1/health"; do
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
while IFS= read -r filepath; do
    relpath="${filepath#$SRC_DIR/}"
    content=$(python3 -c "import sys,json; print(json.dumps(open(sys.argv[1]).read()))" "$filepath")
    FILE_COUNT=$((FILE_COUNT + 1))
    if [ "$FIRST" = true ]; then FIRST=false; else FILES_JSON+=","; fi
    FILES_JSON+="{\"path\":\"src/$relpath\",\"content\":$content}"
done < <(find "$SRC_DIR" -name "*.cpp" -o -name "*.c" -o -name "*.h" -o -name "*.hpp" | sort)
FILES_JSON+="]"
echo "  $FILE_COUNT 파일 수집"
echo ""

# ─────────────────────────────────────────────────
# Phase 2: SAST 스캔
# ─────────────────────────────────────────────────
echo "[Phase 2] SAST 스캔..."
SCAN_BODY=$(python3 -c "
import json, sys
files = json.loads(sys.argv[1])
print(json.dumps({'scanId': '$REQUEST_ID', 'projectId': '$PROJECT_ID', 'files': files}))
" "$FILES_JSON")

SCAN_RESPONSE=$(echo "$SCAN_BODY" | curl -sf -X POST "$SAST_URL/v1/scan" \
    -H "Content-Type: application/json" -H "X-Request-Id: $REQUEST_ID" --data-binary @-)
FINDING_COUNT=$(echo "$SCAN_RESPONSE" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('findings',[])))")
echo "  ✅ $FINDING_COUNT findings"
echo ""

# ─────────────────────────────────────────────────
# Phase 3: 코드 그래프 + KB 적재
# ─────────────────────────────────────────────────
echo "[Phase 3] 코드 그래프 추출 + KB 적재..."
FUNC_RESPONSE=$(curl -sf -X POST "$SAST_URL/v1/functions" \
    -H "Content-Type: application/json" -H "X-Request-Id: $REQUEST_ID" \
    -d "{\"scanId\":\"$REQUEST_ID-func\",\"projectId\":\"$PROJECT_ID\",\"projectPath\":\"$PROJECT_ROOT\",\"buildProfile\":{\"compiler\":\"g++\",\"targetArch\":\"x86_64\",\"languageStandard\":\"c++17\",\"headerLanguage\":\"cpp\",\"includePaths\":[\"src\",\"libraries/civetweb/include\",\"libraries/rapidjson/include\"]}}" 2>&1) || FUNC_RESPONSE='{"functions":[]}'
FUNC_COUNT=$(echo "$FUNC_RESPONSE" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('functions',[])))")
echo "  함수 $FUNC_COUNT개"

if [ "$FUNC_COUNT" -gt 0 ]; then
    echo "$FUNC_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
src = [f for f in d['functions'] if f.get('file','').startswith('src/') or f.get('origin')]
print(json.dumps({'functions': src}))
" | curl -sf -X POST "$KB_URL/v1/code-graph/$PROJECT_ID/ingest" \
        -H "Content-Type: application/json" --data-binary @- > /dev/null 2>&1
    echo "  ✅ KB 적재 완료"
fi
echo ""

# ─────────────────────────────────────────────────
# Phase 3.5: SCA
# ─────────────────────────────────────────────────
echo "[Phase 3.5] SCA 라이브러리 식별..."
SCA_RESPONSE=$(curl -sf -X POST "$SAST_URL/v1/libraries" \
    -H "Content-Type: application/json" -H "X-Request-Id: $REQUEST_ID" \
    -d "{\"scanId\":\"$REQUEST_ID-sca\",\"projectId\":\"$PROJECT_ID\",\"projectPath\":\"$PROJECT_ROOT\"}" 2>&1) || SCA_RESPONSE='{"libraries":[]}'
SCA_COUNT=$(echo "$SCA_RESPONSE" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('libraries',[])))")
echo "  ✅ $SCA_COUNT 라이브러리"
echo ""

# ─────────────────────────────────────────────────
# Phase 4: deep-analyze (pre-computed)
# ─────────────────────────────────────────────────
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                  Phase 4: deep-analyze                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

AGENT_BODY_FILE=$(mktemp /tmp/agent-body-XXXXXX.json)
python3 -c "
import json, sys
files = json.loads(sys.argv[1])
scan = json.loads(sys.argv[2])
sca = json.loads(sys.argv[3])
findings = scan.get('findings', [])
libraries = sca.get('libraries', [])
evidence_refs = []
for i, f in enumerate(files):
    evidence_refs.append({'refId': f'eref-file-{i:02d}','artifactId':'art-$PROJECT_ID','artifactType':'raw-source','locatorType':'lineRange','locator':{'file':f['path'],'fromLine':1,'toLine':9999}})
for i, finding in enumerate(findings[:20]):
    evidence_refs.append({'refId':f'eref-sast-{i:02d}','artifactId':'art-sast','artifactType':'sast-finding','locatorType':'lineRange','locator':{'file':finding.get('location',{}).get('file',''),'fromLine':finding.get('location',{}).get('line',0),'toLine':finding.get('location',{}).get('line',0)+10}})
request = {'taskType':'deep-analyze','taskId':'$REQUEST_ID','context':{'trusted':{'objective':'RE100 gateway-webserver 보안 취약점 심층 분석','buildProfile':{'sdkId':'ti-am335x','compiler':'arm-none-linux-gnueabihf-gcc','targetArch':'arm-cortex-a8','languageStandard':'c++17','headerLanguage':'cpp'},'sastFindings':findings,'scaLibraries':libraries,'projectId':'$PROJECT_ID'}},'evidenceRefs':evidence_refs,'constraints':{'maxTokens':16384,'timeoutMs':900000}}
with open('$AGENT_BODY_FILE','w') as f: json.dump(request, f, ensure_ascii=False)
" "$FILES_JSON" "$SCAN_RESPONSE" "$SCA_RESPONSE"

echo "  요청 전송 중..."
ANALYZE_START=$(date +%s%3N)
ANALYZE_RESPONSE=$(curl -s --max-time 900 -X POST "$AGENT_URL/v1/tasks" \
    -H "Content-Type: application/json" -H "X-Request-Id: $REQUEST_ID" \
    -d @"$AGENT_BODY_FILE" 2>&1)
ANALYZE_END=$(date +%s%3N)
ANALYZE_MS=$((ANALYZE_END - ANALYZE_START))
rm -f "$AGENT_BODY_FILE"

ANALYZE_STATUS=$(echo "$ANALYZE_RESPONSE" | python3 -c "import sys,json;print(json.load(sys.stdin).get('status','?'))" 2>/dev/null)
if [ "$ANALYZE_STATUS" != "completed" ]; then
    echo "  ❌ deep-analyze 실패: $ANALYZE_STATUS"
    echo "$ANALYZE_RESPONSE" | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'  {d.get(\"failureCode\",\"?\")} — {d.get(\"failureDetail\",\"?\")[:200]}')" 2>/dev/null
    exit 1
fi

# claims 추출 + 표시
CLAIM_COUNT=$(echo "$ANALYZE_RESPONSE" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d['result']['claims']))")
echo ""
echo "  ✅ deep-analyze 완료 (${ANALYZE_MS}ms)"
echo "$ANALYZE_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
r = d['result']
a = d['audit']
print(f'  Claims: {len(r[\"claims\"])}개 | Severity: {r.get(\"suggestedSeverity\")} | Confidence: {r[\"confidence\"]}')
print(f'  Turns: {a.get(\"agentAudit\",{}).get(\"turn_count\",\"?\")} | Tools: {a.get(\"agentAudit\",{}).get(\"tool_call_count\",\"?\")}')
print()
for i, c in enumerate(r['claims']):
    print(f'  [{i+1}] {c[\"statement\"][:100]}')
    if c.get('location'):
        print(f'      location: {c[\"location\"]}')
"
echo ""

# claims를 파일로 저장 (PoC 생성용)
echo "$ANALYZE_RESPONSE" > /tmp/analyze-response.json

# ─────────────────────────────────────────────────
# Phase 5: 각 claim별 PoC 생성
# ─────────────────────────────────────────────────
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              Phase 5: claim별 PoC 생성                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

POC_SUCCESS=0
POC_FAIL=0

python3 -c "
import json, sys, os

response = json.load(open('/tmp/analyze-response.json'))
claims = response['result']['claims']
files_json = json.loads(sys.argv[1])

# 파일 내용 맵 구성
file_map = {}
for f in files_json:
    file_map[f['path']] = f['content']

for i, claim in enumerate(claims):
    loc = claim.get('location', '')
    # location에서 파일 경로 추출 (예: 'src/clients/http_client.cpp:62')
    src_file = loc.split(':')[0] if loc else ''

    # 해당 소스 파일 찾기
    poc_files = []
    if src_file and src_file in file_map:
        poc_files.append({'path': src_file, 'content': file_map[src_file]})

    poc_request = {
        'taskType': 'generate-poc',
        'taskId': f'poc-{i+1:02d}',
        'context': {
            'trusted': {
                'objective': f'Claim #{i+1} PoC 생성: {claim[\"statement\"][:80]}',
                'claim': {
                    'statement': claim.get('statement', ''),
                    'detail': claim.get('detail', ''),
                    'location': claim.get('location', '')
                },
                'files': poc_files,
                'projectId': '$PROJECT_ID'
            }
        },
        'evidenceRefs': [
            {
                'refId': 'eref-file-00',
                'artifactId': 'art-poc',
                'artifactType': 'raw-source',
                'locatorType': 'lineRange',
                'locator': {'file': src_file, 'fromLine': 1, 'toLine': 9999}
            }
        ] if src_file else [],
        'constraints': {'maxTokens': 8192, 'timeoutMs': 300000}
    }

    with open(f'/tmp/poc-request-{i}.json', 'w') as f:
        json.dump(poc_request, f, ensure_ascii=False)

print(len(claims))
" "$FILES_JSON" > /tmp/claim_count.txt

TOTAL_CLAIMS=$(cat /tmp/claim_count.txt)
echo "  총 $TOTAL_CLAIMS개 claim에 대해 PoC 생성 시작"
echo ""

for i in $(seq 0 $((TOTAL_CLAIMS - 1))); do
    CLAIM_NUM=$((i + 1))
    echo "  ── Claim #$CLAIM_NUM PoC 생성 ──"

    POC_START=$(date +%s%3N)
    POC_RESPONSE=$(curl -s --max-time 600 -X POST "$AGENT_URL/v1/tasks" \
        -H "Content-Type: application/json" \
        -H "X-Request-Id: poc-${REQUEST_ID}-${CLAIM_NUM}" \
        -d @"/tmp/poc-request-${i}.json" 2>&1)
    POC_END=$(date +%s%3N)
    POC_MS=$((POC_END - POC_START))

    POC_STATUS=$(echo "$POC_RESPONSE" | python3 -c "import sys,json;print(json.load(sys.stdin).get('status','?'))" 2>/dev/null)

    if [ "$POC_STATUS" = "completed" ]; then
        echo "$POC_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
r = d['result']
a = d['audit']
claims = r.get('claims', [])
confidence = r.get('confidence', 0)
severity = r.get('suggestedSeverity', '?')
detail_len = len(claims[0].get('detail', '') or '') if claims else 0
has_poc = 'python' in (claims[0].get('detail', '') or '').lower() or 'curl' in (claims[0].get('detail', '') or '').lower() if claims else False
print(f'  ✅ 성공 | confidence={confidence} | severity={severity} | detail={detail_len}자 | PoC코드={\"있음\" if has_poc else \"없음\"} | {a.get(\"latencyMs\")}ms | ragHits={a.get(\"ragHits\",0)}')
if claims and claims[0].get('statement'):
    print(f'     statement: {claims[0][\"statement\"][:120]}')
"
        POC_SUCCESS=$((POC_SUCCESS + 1))
    else
        echo "  ❌ 실패 (${POC_MS}ms)"
        echo "$POC_RESPONSE" | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'     {d.get(\"failureCode\",\"?\")} — {d.get(\"failureDetail\",\"?\")[:150]}')" 2>/dev/null
        POC_FAIL=$((POC_FAIL + 1))
    fi
    echo ""
done

# 정리
rm -f /tmp/poc-request-*.json /tmp/claim_count.txt

# ─────────────────────────────────────────────────
# 최종 결과
# ─────────────────────────────────────────────────
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                      최종 결과                             ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  SAST: $FINDING_COUNT findings"
echo "  코드 그래프: $FUNC_COUNT functions"
echo "  SCA: $SCA_COUNT libraries"
echo "  deep-analyze: $CLAIM_COUNT claims (${ANALYZE_MS}ms)"
echo "  PoC 생성: $POC_SUCCESS 성공 / $POC_FAIL 실패 (총 $TOTAL_CLAIMS건)"
echo ""
echo "  Request ID: $REQUEST_ID"
echo "  로그 추적: grep '$REQUEST_ID' logs/*.jsonl"
echo ""
if [ "$POC_FAIL" -eq 0 ]; then
    echo "  🎉 풀 파이프라인 통합 테스트 성공!"
else
    echo "  ⚠ 일부 PoC 생성 실패. 로그 확인 필요."
fi
