#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4010}"
WORKSPACE_STORE="${WORKSPACE_STORE:-$(cd "$(dirname "$0")/.." && pwd)/.runtime/workspace-versions.json}"
PROJECT_ID=""
WORKSPACE_ID=""
CWD=""
TIMEOUT_MS=""

usage() {
  cat <<'EOF'
Usage:
  scripts/exec-command.sh <projectId> <command> [args...]
  scripts/exec-command.sh --project <projectId> [--workspace-id <id>] [--cwd <dir>] [--timeout-ms <ms>] <command> [args...]

Examples:
  scripts/exec-command.sh projExec ls -al
  scripts/exec-command.sh --project projExec --cwd src pwd
  BASE_URL=http://localhost:4010 scripts/exec-command.sh projExec find . -maxdepth 2
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT_ID="${2:-}"
      shift 2
      ;;
    --workspace-id)
      WORKSPACE_ID="${2:-}"
      shift 2
      ;;
    --cwd)
      CWD="${2:-}"
      shift 2
      ;;
    --timeout-ms)
      TIMEOUT_MS="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      break
      ;;
    *)
      if [[ -z "${PROJECT_ID}" ]]; then
        PROJECT_ID="$1"
        shift
      else
        break
      fi
      ;;
  esac
done

if [[ -z "${PROJECT_ID}" || $# -eq 0 ]]; then
  usage
  exit 1
fi

COMMAND="$1"
shift

if ! curl -fsS "${BASE_URL}/health" >/dev/null 2>&1; then
  echo "ERROR: S8 service is not reachable at ${BASE_URL}" >&2
  exit 1
fi

if [[ -z "${WORKSPACE_ID}" ]]; then
  if [[ ! -f "${WORKSPACE_STORE}" ]]; then
    echo "ERROR: workspace store not found: ${WORKSPACE_STORE}" >&2
    echo "       Upload a project first or pass --workspace-id explicitly." >&2
    exit 1
  fi
  WORKSPACE_ID="$(python3 - <<'PY' "${WORKSPACE_STORE}" "${PROJECT_ID}"
import json, sys
store_path, project_id = sys.argv[1], sys.argv[2]
with open(store_path, 'r', encoding='utf-8') as fh:
    data = json.load(fh)
items = data.get('projects', {}).get(project_id, [])
if not items:
    raise SystemExit(1)
print(items[-1]['workspaceId'])
PY
)" || {
    echo "ERROR: no workspace found for project '${PROJECT_ID}'." >&2
    echo "       Upload first or pass --workspace-id explicitly." >&2
    exit 1
  }
fi

REQUEST_JSON="$(python3 - <<'PY' "${WORKSPACE_ID}" "${COMMAND}" "${CWD}" "${TIMEOUT_MS}" "$@"
import json, sys
workspace_id = sys.argv[1]
command = sys.argv[2]
cwd = sys.argv[3]
timeout_ms = sys.argv[4]
args = sys.argv[5:]
payload = {
    "workspaceId": workspace_id,
    "command": command,
    "args": args,
}
if cwd:
    payload["cwd"] = cwd
if timeout_ms:
    payload["timeoutMs"] = int(timeout_ms)
print(json.dumps(payload))
PY
)"

echo "== S8 exec request =="
echo "BASE_URL=${BASE_URL}"
echo "PROJECT_ID=${PROJECT_ID}"
echo "WORKSPACE_ID=${WORKSPACE_ID}"
echo "COMMAND=${COMMAND}"
if [[ $# -gt 0 ]]; then
  echo "ARGS=$*"
fi
echo

TMP_BODY="$(mktemp)"
STATUS="$(curl -sS -o "${TMP_BODY}" -w "%{http_code}" -X POST \
  "${BASE_URL}/api/projects/${PROJECT_ID}/exec" \
  -H 'Content-Type: application/json' \
  -d "${REQUEST_JSON}")"

echo "HTTP ${STATUS}"
python3 -m json.tool < "${TMP_BODY}" || cat "${TMP_BODY}"
rm -f "${TMP_BODY}"
