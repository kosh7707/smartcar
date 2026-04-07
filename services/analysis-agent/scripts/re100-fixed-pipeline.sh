#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
RE100_ROOT="${RE100_ROOT:-$HOME/RE100/RE100}"
E2E_SCRIPT="$ROOT_DIR/services/analysis-agent/scripts/e2e.sh"
TI_SDK_ROOT="${TI_SDK_ROOT:-$HOME/ti-sdk}"
TI_SETUP_SCRIPT="${TI_SETUP_SCRIPT:-$TI_SDK_ROOT/linux-devkit/environment-setup-armv7at2hf-neon-linux-gnueabi}"
REPORT_DIR="${REPORT_DIR:-$ROOT_DIR/reports/re100-fixed-pipeline-$(date +%Y%m%d-%H%M%S)}"
SUMMARY_JSON="$REPORT_DIR/aggregate-summary.json"

mkdir -p "$REPORT_DIR"

if [[ ! -x "$E2E_SCRIPT" ]]; then
  echo "missing executable e2e script: $E2E_SCRIPT" >&2
  exit 1
fi

if [[ ! -f "$TI_SETUP_SCRIPT" ]]; then
  echo "missing TI setup script: $TI_SETUP_SCRIPT" >&2
  exit 1
fi

G=$'\033[32m'; R=$'\033[31m'; Y=$'\033[33m'; B=$'\033[1m'; N=$'\033[0m'

healthcheck() {
  local ok=true
  for pair in "Build:http://localhost:8003/v1/health" "Agent:http://localhost:8001/v1/health" "SAST:http://localhost:9000/v1/health" "KB:http://localhost:8002/v1/ready" "Gateway:http://localhost:8000/v1/health"; do
    local name="${pair%%:*}" url="${pair#*:}"
    if curl -sf "$url" >/dev/null 2>&1; then
      printf "  ${G}+${N} %s\n" "$name"
    else
      printf "  ${R}-${N} %s\n" "$name"
      ok=false
    fi
  done
  [[ "$ok" == true ]]
}

cmake_hint() {
  local artifact="$1"
  cat <<HINT
cmake -S . -B build-aegis -DCMAKE_BUILD_TYPE=Release
cmake --build build-aegis --parallel
# expected artifact: ${artifact}
HINT
}

script_hint_file() {
  local path="$1"
  if [[ -f "$path" ]]; then
    cat "$path"
  fi
}

run_one() {
  local key="$1" target="$2" analyze_target="$3" build_mode="$4" sdk_id="$5" setup_script="$6" expected_kind="$7" expected_path="$8" hint_text="$9"
  local tmp_dir="$REPORT_DIR/tmp-${key}"
  local summary_path="$REPORT_DIR/${key}.summary.json"
  local console_log="$REPORT_DIR/${key}.console.log"
  mkdir -p "$tmp_dir"

  printf "\n${B}== %s ==${N}\n" "$key"
  TMP="$tmp_dir" \
  E2E_SUMMARY_PATH="$summary_path" \
  BUILD_CONTRACT_VERSION=build-resolve-v1 \
  STRICT_MODE=true \
  ANALYZE_TARGET="$analyze_target" \
  BUILD_MODE="$build_mode" \
  SDK_ID="$sdk_id" \
  BUILD_SETUP_SCRIPT="$setup_script" \
  BUILD_PROFILE_SDK_ID="$sdk_id" \
  EXPECTED_ARTIFACT_KIND="$expected_kind" \
  EXPECTED_ARTIFACT_PATH="$expected_path" \
  BUILD_SCRIPT_HINT_TEXT="$hint_text" \
  bash "$E2E_SCRIPT" all -p "$RE100_ROOT" -t "$target" -i "$key" | tee "$console_log"
  return ${PIPESTATUS[0]}
}

printf "${B}RE100 fixed-input 4-project pipeline${N}\n"
printf "  RE100_ROOT: %s\n" "$RE100_ROOT"
printf "  REPORT_DIR: %s\n\n" "$REPORT_DIR"

printf "${B}Preflight${N}\n"
healthcheck || { echo "preflight failed" >&2; exit 2; }

GW_HINT="$(script_hint_file "$RE100_ROOT/gateway/scripts/build/cross_build.sh")"
GWW_HINT="$(script_hint_file "$RE100_ROOT/gateway-webserver/scripts/cross_build.sh")"
CERT_HINT="$(cmake_hint certificate-maker)"
GWTEST_HINT="$(script_hint_file "$RE100_ROOT/gateway-test/build-aegis-gateway-/aegis-build.sh")"

# key|build-target|analyze-target|mode|sdk|setup|kind|expected|hint
matrix=(
  "certificate-maker|certificate-maker|certificate-maker|native|||executable|certificate-maker|$CERT_HINT"
  "gateway|gateway|gateway/apps/central|sdk|ti-am335x|$TI_SETUP_SCRIPT|executable|central|$GW_HINT"
  "gateway-webserver|gateway-webserver|gateway-webserver/src|sdk|ti-am335x|$TI_SETUP_SCRIPT|executable|gateway-webserver|$GWW_HINT"
  "gateway-test|gateway-test|gateway-test/apps/central|native|||executable|dist/bin/central|$GWTEST_HINT"
)

fail_count=0
for row in "${matrix[@]}"; do
  IFS='|' read -r key target analyze_target mode sdk setup kind expected hint <<< "$row"
  if ! run_one "$key" "$target" "$analyze_target" "$mode" "$sdk" "$setup" "$kind" "$expected" "$hint"; then
    fail_count=$((fail_count + 1))
  fi
  # keep running all four after preflight regardless of per-project failures
  true
done

python3 - <<PY > "$SUMMARY_JSON"
import json, os, glob
report_dir = os.path.abspath("$REPORT_DIR")
files = sorted(glob.glob(os.path.join(report_dir, "*.summary.json")))
projects = []
overall_pass = True
for path in files:
    data = json.load(open(path))
    key = os.path.basename(path).split('.', 1)[0]
    claim_count = data.get("claimCount", 0)
    poc_total = data.get("pocTotal", 0)
    poc_ok = data.get("pocOk", 0)
    compile_ok = bool(data.get("compileCommandsPaths"))
    project_pass = (
        data.get("buildStatus") == "ok"
        and data.get("analyzeStatus") == "ok"
        and compile_ok
        and ((claim_count == 0 and poc_total == 0) or (claim_count > 0 and poc_total == claim_count and poc_ok == poc_total))
    )
    if not project_pass:
        overall_pass = False
    projects.append({
        "project": key,
        "target": data.get("target"),
        "buildStatus": data.get("buildStatus"),
        "analyzeStatus": data.get("analyzeStatus"),
        "claimCount": claim_count,
        "pocTotal": poc_total,
        "pocOk": poc_ok,
        "compileCommandsPaths": data.get("compileCommandsPaths", []),
        "requestId": data.get("requestId"),
        "resultsDir": data.get("resultsDir"),
        "pass": project_pass,
    })
print(json.dumps({
    "reportDir": report_dir,
    "overallPass": overall_pass,
    "projects": projects,
}, ensure_ascii=False, indent=2))
PY

python3 - <<PY
import json
summary = json.load(open("$SUMMARY_JSON"))
print("\nAggregate summary:")
for item in summary["projects"]:
    verdict = "PASS" if item["pass"] else "FAIL"
    print(f"  - {item['project']}: {verdict} | build={item['buildStatus']} analyze={item['analyzeStatus']} claims={item['claimCount']} poc={item['pocOk']}/{item['pocTotal']} compile_commands={len(item['compileCommandsPaths'])}")
print(f"\nOverall: {'PASS' if summary['overallPass'] else 'FAIL'}")
print(f"Summary JSON: $SUMMARY_JSON")
PY

python3 - <<PY
import json, sys
summary = json.load(open("$SUMMARY_JSON"))
sys.exit(0 if summary.get("overallPass") else 1)
PY
