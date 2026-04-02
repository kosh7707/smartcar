#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════
# RE100 전체 프로젝트: Build → Analyze → PoC + 마크다운 보고서
# 4 프로젝트 병렬 실행 (S7 llmConcurrency=4)
# ════════════════════════════════════════════════════════════
set -uo pipefail

RE100_ROOT="${RE100_ROOT:-$HOME/RE100/RE100}"
AGENT_URL="http://localhost:8001"
BUILD_URL="http://localhost:8003"
SAST_URL="http://localhost:9000"
KB_URL="http://localhost:8002"
GW_URL="http://localhost:8000"

REPORT_DIR="${REPORT_DIR:-$HOME/AEGIS/reports/re100-$(date +%Y%m%d-%H%M%S)}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

R=$'\033[31m' G=$'\033[32m' Y=$'\033[33m' B=$'\033[1m' N=$'\033[0m'

mkdir -p "$REPORT_DIR"

# ── 서비스 헬스체크 ──
printf "${B}── Service Check ──${N}\n"
ok=true
for pair in "Agent $AGENT_URL/v1/health" "Build $BUILD_URL/v1/health" "SAST $SAST_URL/v1/health" "KB $KB_URL/v1/health" "Gateway $GW_URL/v1/health"; do
    n="${pair%% *}"; u="${pair#* }"
    if curl -sf "$u" >/dev/null 2>&1; then
        printf "  ${G}+${N} %s\n" "$n"
    else
        printf "  ${R}-${N} %s\n" "$n"; ok=false
    fi
done
[[ "$ok" != "true" ]] && { printf "\n${R}Required services not ready.${N}\n"; exit 1; }

# ── 프로젝트별 전체 파이프라인 ──
run_project() {
    local name="$1"
    local project_path="$RE100_ROOT/$name"
    local rid="re100-${name}-$(date +%s)"
    local report_md="$REPORT_DIR/${name}.md"
    local proj_tmp="$TMP/$name"
    mkdir -p "$proj_tmp"

    local t0_all=$(date +%s)

    # ── BUILD ──
    local build_ok=false build_cmd="" build_script="" build_s=0
    python3 -c "
import json
req = {'taskType':'build-resolve','taskId':'${rid}-build',
       'context':{'trusted':{'projectPath':'${project_path}'}},
       'constraints':{'maxTokens':8192,'timeoutMs':600000}}
print(json.dumps(req))
" > "$proj_tmp/build-req.json"

    local t0=$(date +%s)
    curl -s --max-time 600 -X POST "$BUILD_URL/v1/tasks" \
        -H "Content-Type: application/json" \
        -H "X-Request-Id: ${rid}-build" \
        -d @"$proj_tmp/build-req.json" > "$proj_tmp/build.json" 2>&1
    build_s=$(($(date +%s) - t0))

    build_ok=$(python3 -c "
import json
try:
    d=json.load(open('$proj_tmp/build.json'))
    br=d.get('result',{}).get('buildResult',{})
    print('true' if d.get('status')=='completed' and br.get('success') else 'false')
except: print('false')
" 2>/dev/null)

    if [[ "$build_ok" == "true" ]]; then
        build_cmd=$(python3 -c "import json; print(json.load(open('$proj_tmp/build.json')).get('result',{}).get('buildResult',{}).get('buildCommand',''))" 2>/dev/null)
        build_script=$(python3 -c "import json; print(json.load(open('$proj_tmp/build.json')).get('result',{}).get('buildResult',{}).get('buildScript',''))" 2>/dev/null)
        printf "  ${G}BUILD OK${N}  %s (%ds)\n" "$name" "$build_s"
    else
        printf "  ${Y}BUILD SKIP${N} %s (%ds) — buildProfile 없이 분석 진행\n" "$name" "$build_s"
    fi

    # ── ANALYZE ──
    local analyze_ok=false analyze_s=0
    python3 -c "
import json
req = {'taskType':'deep-analyze','taskId':'${rid}-analyze',
       'context':{'trusted':{'projectPath':'${project_path}','projectId':'re100-${name}'}},
       'constraints':{'maxTokens':16384,'timeoutMs':900000}}
print(json.dumps(req))
" > "$proj_tmp/analyze-req.json"

    t0=$(date +%s)
    curl -s --max-time 900 -X POST "$AGENT_URL/v1/tasks" \
        -H "Content-Type: application/json" \
        -H "X-Request-Id: ${rid}-analyze" \
        -d @"$proj_tmp/analyze-req.json" > "$proj_tmp/analyze.json" 2>&1
    analyze_s=$(($(date +%s) - t0))

    analyze_ok=$(python3 -c "
import json
try:
    d=json.load(open('$proj_tmp/analyze.json'))
    print('true' if d.get('status')=='completed' else 'false')
except: print('false')
" 2>/dev/null)

    if [[ "$analyze_ok" == "true" ]]; then
        local claim_count=$(python3 -c "import json; print(len(json.load(open('$proj_tmp/analyze.json')).get('result',{}).get('claims',[])))" 2>/dev/null)
        printf "  ${G}ANALYZE OK${N} %s (%ds) — %s claims\n" "$name" "$analyze_s" "$claim_count"
    else
        printf "  ${R}ANALYZE FAIL${N} %s (%ds)\n" "$name" "$analyze_s"
    fi

    # ── POC (claim별) ──
    local poc_total=0 poc_ok=0
    if [[ "$analyze_ok" == "true" ]]; then
        poc_total=$(python3 -c "import json; print(len(json.load(open('$proj_tmp/analyze.json')).get('result',{}).get('claims',[])))" 2>/dev/null)

        for idx in $(seq 0 $((poc_total - 1))); do
            python3 << PYEOF > "$proj_tmp/poc-${idx}-req.json"
import json
analyze = json.load(open("$proj_tmp/analyze.json"))
claims = analyze["result"]["claims"]
claim = claims[$idx]
files = analyze.get("result", {}).get("usedEvidenceRefs", [])
req = {
    "taskType": "generate-poc",
    "taskId": "${rid}-poc-${idx}",
    "context": {"trusted": {
        "claim": claim,
        "files": [],
        "projectId": "re100-${name}",
        "projectPath": "${project_path}"
    }},
    "evidenceRefs": [
        {"refId": ref, "artifactId": ref, "artifactType": "analysis",
         "locatorType": "refId", "locator": {"file": ""}}
        for ref in files[:10]
    ],
    "constraints": {"maxTokens": 8192, "timeoutMs": 600000}
}
print(json.dumps(req))
PYEOF

            curl -s --max-time 600 -X POST "$AGENT_URL/v1/tasks" \
                -H "Content-Type: application/json" \
                -H "X-Request-Id: ${rid}-poc-${idx}" \
                -d @"$proj_tmp/poc-${idx}-req.json" > "$proj_tmp/poc-${idx}.json" 2>&1

            local poc_status=$(python3 -c "
import json
try:
    d=json.load(open('$proj_tmp/poc-${idx}.json'))
    print('ok' if d.get('status')=='completed' else 'fail')
except: print('fail')
" 2>/dev/null)
            [[ "$poc_status" == "ok" ]] && poc_ok=$((poc_ok + 1))
        done
        printf "  ${G}POC${N}        %s — %d/%d OK\n" "$name" "$poc_ok" "$poc_total"
    fi

    local total_s=$(($(date +%s) - t0_all))

    # ── 마크다운 보고서 생성 ──
    python3 << PYEOF
import json, sys
from datetime import datetime

name = "${name}"
project_path = "${project_path}"
rid = "${rid}"
total_s = ${total_s}
build_s = ${build_s}
analyze_s = ${analyze_s}
build_ok = ("${build_ok}" == "true")
poc_total = ${poc_total}
poc_ok = ${poc_ok}

lines = []
lines.append(f"# {name.upper()} — AEGIS 보안 분석 보고서")
lines.append("")
lines.append(f"> 생성: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
lines.append(f"> 프로젝트: \`{project_path}\`")
lines.append(f"> Request ID: \`{rid}\`")
lines.append(f"> 총 소요: {total_s}초 (Build {build_s}s + Analyze {analyze_s}s + PoC)")
lines.append("")
lines.append("---")
lines.append("")

# Build
lines.append("## 0. 빌드")
lines.append("")
if build_ok:
    try:
        bd = json.load(open(f"$proj_tmp/build.json"))
        br = bd.get("result", {}).get("buildResult", {})
        lines.append(f"- **상태**: 성공")
        lines.append(f"- **빌드 명령**: \`{br.get('buildCommand','?')}\`")
        lines.append(f"- **빌드 스크립트**: \`{br.get('buildScript','?')}\`")
    except:
        lines.append("- **상태**: 성공 (상세 파싱 실패)")
else:
    lines.append("- **상태**: 실패 또는 스킵 — buildProfile 없이 분석 진행")
lines.append("")

# Analyze
try:
    d = json.load(open(f"$proj_tmp/analyze.json"))
except:
    lines.append("## 1. 분석 실패\\n\\n응답 파싱 실패.\\n")
    with open("${report_md}", "w") as f:
        f.write("\\n".join(lines) + "\\n")
    sys.exit(0)

status = d.get("status", "?")
r = d.get("result", {})
v = d.get("validation", {})
aa = d.get("audit", {}).get("agentAudit", {})
claims = r.get("claims", [])
caveats = r.get("caveats", [])
used_refs = r.get("usedEvidenceRefs", [])
confidence = r.get("confidence", 0)
severity = r.get("suggestedSeverity", "?")
summary = r.get("summary", "")
next_steps = r.get("recommendedNextSteps", [])

lines.append("## 1. 분석 요약")
lines.append("")
lines.append(f"| 항목 | 값 |")
lines.append(f"|------|------|")
lines.append(f"| **상태** | {status} |")
lines.append(f"| **심각도** | {severity} |")
lines.append(f"| **신뢰도** | {confidence:.3f} |")
lines.append(f"| **취약점 (Claims)** | {len(claims)}건 |")
lines.append(f"| **주의사항 (Caveats)** | {len(caveats)}건 |")
lines.append(f"| **증적** | {len(used_refs)}건 |")
lines.append(f"| **검증** | valid={v.get('valid')}, errors={len(v.get('errors',[]))} |")
lines.append(f"| **PoC 생성** | {poc_ok}/{poc_total} |")
lines.append("")
lines.append(f"> {summary}")
lines.append("")

# Claims + PoC
lines.append("---")
lines.append("")
lines.append("## 2. 취약점 상세 + PoC")
lines.append("")
for i, c in enumerate(claims):
    loc = c.get("location", "")
    refs = c.get("supportingEvidenceRefs", [])
    lines.append(f"### 2.{i+1}. {c.get('statement', '?')}")
    lines.append("")
    if loc:
        lines.append(f"**위치**: \`{loc}\`")
        lines.append("")
    if refs:
        lines.append(f"**증적**: {', '.join(f'\`{r}\`' for r in refs)}")
        lines.append("")
    detail = c.get("detail", "")
    if detail:
        lines.append(detail)
        lines.append("")

    # PoC 결과
    try:
        poc = json.load(open(f"$proj_tmp/poc-{i}.json"))
        if poc.get("status") == "completed":
            pr = poc.get("result", {})
            poc_claims = pr.get("claims", [])
            lines.append(f"#### PoC (confidence: {pr.get('confidence', '?')})")
            lines.append("")
            for pc in poc_claims:
                lines.append(pc.get("detail", "(PoC 상세 없음)"))
                lines.append("")
        else:
            lines.append(f"#### PoC: 실패 ({poc.get('failureCode', '?')})")
            lines.append("")
    except:
        pass

# Caveats
if caveats:
    lines.append("---")
    lines.append("")
    lines.append("## 3. 주의사항 (Caveats)")
    lines.append("")
    for cv in caveats:
        lines.append(f"- {cv}")
    lines.append("")

# Next Steps
if next_steps:
    lines.append("---")
    lines.append("")
    lines.append("## 4. 권장 후속 조치")
    lines.append("")
    for ns in next_steps:
        lines.append(f"- {ns}")
    lines.append("")

# Audit
lines.append("---")
lines.append("")
lines.append("## 5. 감사 정보")
lines.append("")
lines.append(f"| 항목 | 값 |")
lines.append(f"|------|------|")
lines.append(f"| 모델 | \`{aa.get('model_name', '?')}\` |")
lines.append(f"| 프롬프트 버전 | \`{aa.get('prompt_version', '?')}\` |")
lines.append(f"| 턴 수 | {aa.get('turn_count', '?')} |")
lines.append(f"| 도구 호출 | {aa.get('tool_call_count', '?')}회 |")
lines.append(f"| 프롬프트 토큰 | {aa.get('total_prompt_tokens', '?')} |")
lines.append(f"| 완성 토큰 | {aa.get('total_completion_tokens', '?')} |")
lines.append(f"| 지연 시간 | {aa.get('latency_ms', '?')}ms |")
lines.append(f"| 종료 사유 | \`{aa.get('termination_reason', '?')}\` |")
lines.append("")

trace = aa.get("trace", [])
if trace:
    lines.append("### 도구 실행 추적")
    lines.append("")
    lines.append("| # | 도구 | 시간(ms) | 성공 | 증적 수 |")
    lines.append("|---|------|---------|:----:|:------:|")
    for t in trace:
        ok_mark = "O" if t["success"] else "X"
        refs_count = len(t.get("new_evidence_refs", []))
        lines.append(f"| {t['step_id']} | {t['tool']} | {t['duration_ms']} | {ok_mark} | {refs_count} |")
    lines.append("")

if used_refs:
    lines.append("### 사용된 증적")
    lines.append("")
    for ref in used_refs:
        lines.append(f"- \`{ref}\`")
    lines.append("")

with open("${report_md}", "w") as f:
    f.write("\\n".join(lines) + "\\n")
PYEOF

    printf "  ${B}REPORT${N}     %s\n" "$report_md"

    # JSON 결과도 보고서 디렉토리에 복사 (summary용)
    cp "$proj_tmp/analyze.json" "$REPORT_DIR/${name}-analyze.json" 2>/dev/null || true
    for pf in "$proj_tmp"/poc-*.json; do
        [[ -f "$pf" ]] && cp "$pf" "$REPORT_DIR/${name}-$(basename "$pf")" 2>/dev/null || true
    done
}

# ── 메인: 4 프로젝트 병렬 실행 ──
PROJECTS=()
for d in "$RE100_ROOT"/*/; do
    [[ -d "$d" ]] && PROJECTS+=("$(basename "$d")")
done

printf "\n${B}════════════════════════════════════════${N}\n"
printf "${B}  RE100 전체 분석 시작 (${#PROJECTS[@]}개 병렬)${N}\n"
printf "${B}  보고서: %s${N}\n" "$REPORT_DIR"
printf "${B}════════════════════════════════════════${N}\n\n"

PIDS=()
for project in "${PROJECTS[@]}"; do
    run_project "$project" &
    PIDS+=($!)
done

# 모든 프로세스 합류
for pid in "${PIDS[@]}"; do
    wait "$pid" 2>/dev/null || true
done

# ── summary.md 생성 ──
python3 << PYEOF
import json, glob, os
from datetime import datetime

report_dir = "${REPORT_DIR}"
lines = []
lines.append("# RE100 전체 분석 종합 보고서")
lines.append("")
lines.append(f"> 생성: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
lines.append("")
lines.append("| 프로젝트 | 상태 | 심각도 | 신뢰도 | Claims | PoC | 검증 |")
lines.append("|----------|:----:|:------:|:------:|:------:|:---:|:----:|")

for json_file in sorted(glob.glob(os.path.join(report_dir, "*-analyze.json"))):
    name = os.path.basename(json_file).replace("-analyze.json", "")
    try:
        d = json.load(open(json_file))
        r = d.get("result", {})
        v = d.get("validation", {})
        status = "OK" if d.get("status") == "completed" else "FAIL"
        severity = r.get("suggestedSeverity", "-")
        confidence = f"{r.get('confidence', 0):.3f}"
        claim_count = len(r.get("claims", []))
        valid = "O" if v.get("valid") else "X"

        # PoC count
        poc_ok = 0
        for i in range(claim_count):
            poc_path = os.path.join(report_dir, f"{name}-poc-{i}.json")
            if os.path.exists(poc_path):
                try:
                    pd = json.load(open(poc_path))
                    if pd.get("status") == "completed":
                        poc_ok += 1
                except:
                    pass
        poc_str = f"{poc_ok}/{claim_count}" if claim_count > 0 else "-"

        lines.append(f"| {name} | {status} | {severity} | {confidence} | {claim_count} | {poc_str} | {valid} |")
    except:
        lines.append(f"| {name} | ERROR | - | - | - | - | - |")

lines.append("")
lines.append("---")
lines.append("")
lines.append("*개별 보고서는 같은 디렉토리의 각 프로젝트명.md 참조*")

with open(os.path.join(report_dir, "summary.md"), "w") as f:
    f.write("\\n".join(lines) + "\\n")
print(f"  summary: {os.path.join(report_dir, 'summary.md')}")
PYEOF

printf "\n${B}════════════════════════════════════════${N}\n"
printf "${B}  RE100 전체 분석 완료${N}\n"
printf "${B}════════════════════════════════════════${N}\n"
printf "  보고서: %s\n\n" "$REPORT_DIR"
ls -la "$REPORT_DIR"/*.md 2>/dev/null
printf "\n"
