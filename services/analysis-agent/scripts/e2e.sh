#!/bin/bash
# ════════════════════════════════════════════════════════════
# AEGIS Agent E2E Integration Test Suite
# ════════════════════════════════════════════════════════════
#
# Usage:
#   ./e2e.sh MODE [-p PROJECT] [-t TARGET] [-i ID]
#
# Modes:
#   build            Build Agent 단독
#   analyze          Analysis Agent 단독 (deep-analyze)
#   poc              PoC 생성 단독 (이전 분석 결과 필요)
#   build-analyze    빌드 -> 분석
#   analyze-poc      분석 -> PoC
#   all              빌드 -> 분석 -> PoC (전체 E2E)
#
# Options:
#   -p PATH   프로젝트 절대 경로 (기본: ~/projects/re100-gateway)
#   -t PATH   서브프로젝트 상대 경로
#   -i ID     프로젝트 ID (기본: 디렉토리명)
#
# Examples:
#   ./e2e.sh all
#   ./e2e.sh build -p /home/kosh/projects/re100-gateway
#   ./e2e.sh analyze-poc -p /path/to/proj -t gateway/ -i my-gw
#
# Strict compile-first examples:
#   BUILD_CONTRACT_VERSION=build-resolve-v1 STRICT_MODE=true BUILD_MODE=native \
#     EXPECTED_ARTIFACT_KIND=executable EXPECTED_ARTIFACT_PATH=gateway \
#     ./e2e.sh build -p /path/to/proj -t gateway/
#   BUILD_MODE=sdk SDK_ID=ti-am335x ./e2e.sh build -p /path/to/proj -t gateway/
#
# Prerequisites:
#   build:   Build Agent(:8003), SAST Runner(:9000), LLM Gateway(:8000)
#   analyze: Analysis Agent(:8001), SAST Runner(:9000), KB(:8002), LLM Gateway(:8000)
#   poc:     Analysis Agent(:8001), LLM Gateway(:8000)

set -uo pipefail

# ─── Service URLs ───
BUILD_URL="http://localhost:8003"
AGENT_URL="http://localhost:8001"
SAST_URL="http://localhost:9000"
KB_URL="http://localhost:8002"
GW_URL="http://localhost:8000"

# ─── Colors ───
G='\033[32m' R='\033[31m' Y='\033[33m' C='\033[36m' B='\033[1m' N='\033[0m'

# ─── Defaults ───
PROJECT="$HOME/projects/re100-gateway"
TARGET=""
PROJECT_ID=""
REQUEST_ID="e2e-$(date +%s)"
TMP="/tmp/aegis-e2e"
BUILD_CONTRACT_VERSION="${BUILD_CONTRACT_VERSION:-}"
STRICT_MODE="${STRICT_MODE:-}"
BUILD_MODE="${BUILD_MODE:-}"
SDK_ID="${SDK_ID:-}"
EXPECTED_ARTIFACT_KIND="${EXPECTED_ARTIFACT_KIND:-}"
EXPECTED_ARTIFACT_PATH="${EXPECTED_ARTIFACT_PATH:-}"

# ─── State ───
BUILD_STATUS="skip"
ANALYZE_STATUS="skip"
POC_TOTAL=0
POC_OK=0
T_START=$(date +%s%3N)

# ════════════════════════════════════════════════════════════
# Usage
# ════════════════════════════════════════════════════════════
usage() {
    cat << 'USAGE'
AEGIS Agent E2E Integration Test

Usage: e2e.sh MODE [OPTIONS]

Modes:
  build           Build Agent (build-resolve)
  analyze         Analysis Agent (deep-analyze)
  poc             PoC (generate-poc, 이전 분석 결과 필요)
  build-analyze   빌드 -> 분석
  analyze-poc     분석 -> PoC
  all             빌드 -> 분석 -> PoC

Options:
  -p PATH   프로젝트 경로 (기본: ~/projects/re100-gateway)
  -t PATH   서브프로젝트 상대 경로
  -i ID     프로젝트 ID (기본: 디렉토리명)
USAGE
    exit 1
}

# ════════════════════════════════════════════════════════════
# Argument Parsing
# ════════════════════════════════════════════════════════════
[[ $# -lt 1 ]] && usage
MODE="$1"; shift
while [[ $# -gt 0 ]]; do
    case "$1" in
        -p) PROJECT="$2"; shift 2 ;;
        -t) TARGET="$2"; shift 2 ;;
        -i) PROJECT_ID="$2"; shift 2 ;;
        *)  usage ;;
    esac
done

[[ -z "$PROJECT_ID" ]] && PROJECT_ID=$(basename "${TARGET:-$PROJECT}" | tr -d '/')
mkdir -p "$TMP"

# ════════════════════════════════════════════════════════════
# Helpers
# ════════════════════════════════════════════════════════════
hdr() { printf "\n${B}── %s ──${N}\n" "$1"; }

check_services() {
    hdr "Service Check"
    local svcs=() ok=true
    case "$MODE" in
        build)         svcs=("Build:$BUILD_URL" "SAST:$SAST_URL" "Gateway:$GW_URL") ;;
        analyze)       svcs=("Agent:$AGENT_URL" "SAST:$SAST_URL" "KB:$KB_URL" "Gateway:$GW_URL") ;;
        poc)           svcs=("Agent:$AGENT_URL" "Gateway:$GW_URL") ;;
        build-analyze) svcs=("Build:$BUILD_URL" "Agent:$AGENT_URL" "SAST:$SAST_URL" "KB:$KB_URL" "Gateway:$GW_URL") ;;
        analyze-poc)   svcs=("Agent:$AGENT_URL" "SAST:$SAST_URL" "KB:$KB_URL" "Gateway:$GW_URL") ;;
        all)           svcs=("Build:$BUILD_URL" "Agent:$AGENT_URL" "SAST:$SAST_URL" "KB:$KB_URL" "Gateway:$GW_URL") ;;
        *) echo "Unknown mode: $MODE"; usage ;;
    esac
    for s in "${svcs[@]}"; do
        local n="${s%%:*}" u="${s#*:}"
        # KB는 /v1/ready로 Qdrant+Neo4j 준비 상태까지 확인
        local endpoint="/v1/health"
        [[ "$n" == "KB" ]] && endpoint="/v1/ready"
        if curl -sf "$u$endpoint" >/dev/null 2>&1; then
            printf "  ${G}+${N} %s\n" "$n"
        else
            printf "  ${R}-${N} %s\n" "$n"; ok=false
        fi
    done
    [[ "$ok" != "true" ]] && { printf "\n${R}Required services not ready.${N}\n"; exit 1; }
}

# ════════════════════════════════════════════════════════════
# STEP: Build
# ════════════════════════════════════════════════════════════
step_build() {
    hdr "BUILD (build-resolve)"
    printf "  project: %s\n" "$PROJECT"
    [[ -n "$TARGET" ]] && printf "  subproject: %s\n" "$TARGET"
    [[ -n "$BUILD_CONTRACT_VERSION" ]] && printf "  contract:%s%s\n" " " "$BUILD_CONTRACT_VERSION"
    [[ -n "$STRICT_MODE" ]] && printf "  strict:  %s\n" "$STRICT_MODE"
    [[ -n "$BUILD_MODE" ]] && printf "  mode:    %s%s\n" "$BUILD_MODE" "${SDK_ID:+ (sdkId=$SDK_ID)}"
    [[ -n "$EXPECTED_ARTIFACT_KIND" || -n "$EXPECTED_ARTIFACT_PATH" ]] && \
        printf "  expect:  %s%s\n" "${EXPECTED_ARTIFACT_KIND:-artifact}" "${EXPECTED_ARTIFACT_PATH:+ @ $EXPECTED_ARTIFACT_PATH}"

    python3 << PYEOF > "$TMP/build-req.json"
import json
trusted = {"projectPath":"${PROJECT}"}
t = "${TARGET}"
if t:
    trusted["subprojectPath"] = t
    trusted["subprojectName"] = t.rstrip("/").split("/")[-1]
if "${BUILD_CONTRACT_VERSION}":
    trusted["contractVersion"] = "${BUILD_CONTRACT_VERSION}"
if "${STRICT_MODE}":
    trusted["strictMode"] = "${STRICT_MODE}".lower() in ("1", "true", "yes", "on")
if "${BUILD_MODE}":
    trusted["build"] = {"mode": "${BUILD_MODE}"}
if "${SDK_ID}":
    trusted.setdefault("build", {})["sdkId"] = "${SDK_ID}"
if "${EXPECTED_ARTIFACT_KIND}" or "${EXPECTED_ARTIFACT_PATH}":
    trusted["expectedArtifacts"] = [{
        "kind": "${EXPECTED_ARTIFACT_KIND}" or "artifact",
        "path": "${EXPECTED_ARTIFACT_PATH}",
    }]
req = {"taskType":"build-resolve","taskId":"${REQUEST_ID}-build",
       "context":{"trusted":trusted},
       "constraints":{"maxTokens":8192,"timeoutMs":600000}}
print(json.dumps(req))
PYEOF

    local t0=$(date +%s%3N)
    curl -s --max-time 600 -X POST "$BUILD_URL/v1/tasks" \
        -H "Content-Type: application/json" \
        -H "X-Request-Id: ${REQUEST_ID}-build" \
        -d @"$TMP/build-req.json" > "$TMP/build.json" 2>&1
    local dt=$(( ($(date +%s%3N) - t0) / 1000 ))

    python3 << PYEOF
import json, sys
try:
    d = json.load(open("$TMP/build.json"))
except:
    print("  \033[31mFAIL\033[0m invalid response"); sys.exit(0)
br = d.get("result",{}).get("buildResult",{})
aa = d.get("audit",{}).get("agentAudit",{})
if d.get("status") == "completed" and br.get("success"):
    print(f"  \033[32mOK\033[0m build succeeded ({aa.get('turn_count','?')} turns, ${dt}s)")
    if br.get("buildCommand"):
        print(f"     cmd: {br['buildCommand'][:120]}")
    if br.get("buildScript"):
        print(f"     script: {br['buildScript']}")
else:
    fc = d.get("failureCode", d.get("status","?"))
    print(f"  \033[31mFAIL\033[0m {fc}")
    fd = d.get("failureDetail","") or ""
    if fd: print(f"     {fd[:200]}")
for t in aa.get("trace",[])[:15]:
    m = "+" if t["success"] else "-"
    print(f"     {m} {t['tool']:12s} {t['duration_ms']}ms")
PYEOF

    BUILD_STATUS=$(python3 -c "
import json
d=json.load(open('$TMP/build.json'))
br=d.get('result',{}).get('buildResult',{})
print('ok' if d.get('status')=='completed' and br.get('success') else 'fail')
" 2>/dev/null || echo "fail")
}

# ════════════════════════════════════════════════════════════
# STEP: Analyze
# ════════════════════════════════════════════════════════════
step_analyze() {
    hdr "ANALYZE (deep-analyze)"

    local analysis_path="$PROJECT"
    [[ -n "$TARGET" ]] && analysis_path="${PROJECT}/${TARGET}"
    analysis_path="${analysis_path%/}"
    printf "  path: %s\n" "$analysis_path"

    python3 << PYEOF > "$TMP/analyze-req.json"
import json
req = {"taskType":"deep-analyze","taskId":"${REQUEST_ID}-analyze",
       "context":{"trusted":{"projectPath":"${analysis_path}","projectId":"${PROJECT_ID}"}},
       "constraints":{"maxTokens":16384,"timeoutMs":900000}}
print(json.dumps(req))
PYEOF

    local t0=$(date +%s%3N)
    curl -s --max-time 900 -X POST "$AGENT_URL/v1/tasks" \
        -H "Content-Type: application/json" \
        -H "X-Request-Id: ${REQUEST_ID}-analyze" \
        -d @"$TMP/analyze-req.json" > "$TMP/analyze.json" 2>&1
    local dt=$(( ($(date +%s%3N) - t0) / 1000 ))

    python3 << PYEOF
import json, sys
try:
    d = json.load(open("$TMP/analyze.json"))
except:
    print("  \033[31mFAIL\033[0m invalid response"); sys.exit(0)
r = d.get("result",{})
aa = d.get("audit",{}).get("agentAudit",{})
claims = r.get("claims",[])
if d.get("status") == "completed":
    print(f"  \033[32mOK\033[0m {len(claims)} claims, confidence={r.get('confidence','?')}, severity={r.get('suggestedSeverity','?')} ({aa.get('turn_count','?')} turns, ${dt}s)")
    for i, c in enumerate(claims[:10]):
        loc = f" @ {c['location']}" if c.get("location") else ""
        print(f"     {i+1}. {c['statement'][:100]}{loc}")
    if len(claims) > 10:
        print(f"     ... ({len(claims)-10} more)")
    for t in aa.get("trace",[])[:15]:
        m = "+" if t["success"] else "-"
        print(f"     {m} {t['tool']:12s} {t['duration_ms']}ms refs={len(t.get('new_evidence_refs',[]))}")
else:
    fc = d.get("failureCode", d.get("status","?"))
    print(f"  \033[31mFAIL\033[0m {fc}")
    fd = d.get("failureDetail","") or ""
    if fd: print(f"     {fd[:200]}")
PYEOF

    ANALYZE_STATUS=$(python3 -c "
import json; d=json.load(open('$TMP/analyze.json'))
print('ok' if d.get('status')=='completed' else 'fail')
" 2>/dev/null || echo "fail")
}

# ════════════════════════════════════════════════════════════
# STEP: PoC
# ════════════════════════════════════════════════════════════
step_poc() {
    hdr "POC (generate-poc)"

    if [[ ! -f "$TMP/analyze.json" ]]; then
        printf "  ${R}No analysis result found.${N} Run 'analyze' first.\n"
        return 1
    fi

    # Check staleness
    local age_s=$(( ( $(date +%s) - $(stat -c %Y "$TMP/analyze.json" 2>/dev/null || echo 0) ) ))
    if [[ $age_s -gt 3600 ]]; then
        printf "  ${Y}Warning: analysis result is %d min old${N}\n" $((age_s / 60))
    fi

    POC_TOTAL=$(python3 -c "
import json; print(len(json.load(open('$TMP/analyze.json')).get('result',{}).get('claims',[])))
" 2>/dev/null || echo 0)

    if [[ "$POC_TOTAL" -eq 0 ]]; then
        printf "  ${Y}No claims to generate PoC for.${N}\n"
        return 0
    fi

    printf "  %d claims to process\n\n" "$POC_TOTAL"

    local analysis_path="$PROJECT"
    [[ -n "$TARGET" ]] && analysis_path="${PROJECT}/${TARGET}"
    analysis_path="${analysis_path%/}"

    # Generate per-claim request files
    python3 << PYEOF
import json
d = json.load(open("$TMP/analyze.json"))
claims = d.get("result",{}).get("claims",[])
for i, c in enumerate(claims):
    req = {"taskType":"generate-poc","taskId":"${REQUEST_ID}-poc-" + str(i),
           "context":{"trusted":{
               "claim":{"statement":c.get("statement",""),"detail":c.get("detail",""),"location":c.get("location","")},
               "projectPath":"${analysis_path}","projectId":"${PROJECT_ID}"}},
           "constraints":{"maxTokens":8192,"timeoutMs":300000}}
    with open(f"$TMP/poc-req-{i}.json","w") as f:
        json.dump(req, f, ensure_ascii=False)
PYEOF

    POC_OK=0
    for i in $(seq 0 $((POC_TOTAL - 1))); do
        local n=$((i + 1))
        # Print claim statement
        local stmt
        stmt=$(python3 -c "
import json; c=json.load(open('$TMP/analyze.json'))['result']['claims'][$i]
print(c.get('statement','')[:80])
" 2>/dev/null)
        printf "  [%d/%d] %s\n" "$n" "$POC_TOTAL" "$stmt"

        local t0=$(date +%s%3N)
        curl -s --max-time 300 -X POST "$AGENT_URL/v1/tasks" \
            -H "Content-Type: application/json" \
            -H "X-Request-Id: ${REQUEST_ID}-poc-${i}" \
            -d @"$TMP/poc-req-${i}.json" > "$TMP/poc-${i}.json" 2>&1
        local dt=$(( ($(date +%s%3N) - t0) / 1000 ))

        local st
        st=$(python3 -c "import json; print(json.load(open('$TMP/poc-${i}.json')).get('status','?'))" 2>/dev/null)

        if [[ "$st" == "completed" ]]; then
            local conf
            conf=$(python3 -c "import json; print(json.load(open('$TMP/poc-${i}.json')).get('result',{}).get('confidence','?'))" 2>/dev/null)
            printf "        ${G}OK${N} confidence=%s (%ds)\n" "$conf" "$dt"
            POC_OK=$((POC_OK + 1))
        else
            local fc
            fc=$(python3 -c "import json; print(json.load(open('$TMP/poc-${i}.json')).get('failureCode','?'))" 2>/dev/null)
            printf "        ${R}FAIL${N} %s (%ds)\n" "$fc" "$dt"
        fi
    done
}

# ════════════════════════════════════════════════════════════
# Summary
# ════════════════════════════════════════════════════════════
print_summary() {
    local t_total=$(( ($(date +%s%3N) - T_START) / 1000 ))

    hdr "Summary"
    printf "  mode:       %s\n" "$MODE"
    printf "  project:    %s\n" "$PROJECT"
    [[ -n "$TARGET" ]] && printf "  target:     %s\n" "$TARGET"
    printf "  request-id: %s\n" "$REQUEST_ID"
    printf "  elapsed:    %ds\n" "$t_total"
    echo ""

    [[ "$BUILD_STATUS" != "skip" ]] && {
        if [[ "$BUILD_STATUS" == "ok" ]]; then printf "  build:   ${G}OK${N}\n"
        else printf "  build:   ${R}FAIL${N}\n"; fi
    }
    [[ "$ANALYZE_STATUS" != "skip" ]] && {
        if [[ "$ANALYZE_STATUS" == "ok" ]]; then
            local cc
            cc=$(python3 -c "import json;print(len(json.load(open('$TMP/analyze.json')).get('result',{}).get('claims',[])))" 2>/dev/null)
            printf "  analyze: ${G}OK${N} (%s claims)\n" "$cc"
        else printf "  analyze: ${R}FAIL${N}\n"; fi
    }
    [[ "$POC_TOTAL" -gt 0 ]] && {
        if [[ "$POC_OK" -eq "$POC_TOTAL" ]]; then
            printf "  poc:     ${G}%d/%d OK${N}\n" "$POC_OK" "$POC_TOTAL"
        else
            printf "  poc:     ${Y}%d/%d OK${N}\n" "$POC_OK" "$POC_TOTAL"
        fi
    }

    echo ""
    printf "  results: %s/\n" "$TMP"
    printf "  trace:   mcp__log-analyzer__trace_request %s\n" "$REQUEST_ID"

    # Cleanup request files only
    rm -f "$TMP"/*-req*.json
}

# ════════════════════════════════════════════════════════════
# Main
# ════════════════════════════════════════════════════════════
echo ""
printf "${B}AEGIS Agent E2E Test${N} [%s]\n" "$MODE"

check_services

case "$MODE" in
    build)
        step_build
        ;;
    analyze)
        step_analyze
        ;;
    poc)
        step_poc
        ;;
    build-analyze)
        step_build
        step_analyze
        ;;
    analyze-poc)
        step_analyze
        [[ "$ANALYZE_STATUS" == "ok" ]] && step_poc \
            || printf "\n  ${Y}Skipping PoC — analysis failed${N}\n"
        ;;
    all)
        step_build
        step_analyze
        [[ "$ANALYZE_STATUS" == "ok" ]] && step_poc \
            || printf "\n  ${Y}Skipping PoC — analysis failed${N}\n"
        ;;
    *)
        usage
        ;;
esac

print_summary
