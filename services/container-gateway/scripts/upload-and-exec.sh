#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4010}"
PROJECT_ID=""
FILE_PATH=""
CWD=""
TIMEOUT_MS=""

usage() {
  cat <<'EOF'
Usage:
  scripts/upload-and-exec.sh --project <projectId> --file <path> [--cwd <dir>] [--timeout-ms <ms>] <command> [args...]

Examples:
  scripts/upload-and-exec.sh --project demo --file ./sample.zip ls -al
  scripts/upload-and-exec.sh --project demo --file ./src/main.c pwd
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT_ID="${2:-}"
      shift 2
      ;;
    --file)
      FILE_PATH="${2:-}"
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
      break
      ;;
  esac
done

if [[ -z "${PROJECT_ID}" || -z "${FILE_PATH}" || $# -eq 0 ]]; then
  usage
  exit 1
fi

if [[ ! -f "${FILE_PATH}" ]]; then
  echo "ERROR: file not found: ${FILE_PATH}" >&2
  exit 1
fi

COMMAND="$1"
shift

if ! curl -fsS "${BASE_URL}/health" >/dev/null 2>&1; then
  echo "ERROR: S8 service is not reachable at ${BASE_URL}" >&2
  exit 1
fi

echo "== Uploading ${FILE_PATH} to project ${PROJECT_ID} =="
UPLOAD_BODY="$(mktemp)"
UPLOAD_STATUS="$(curl -sS -o "${UPLOAD_BODY}" -w "%{http_code}" -X POST \
  "${BASE_URL}/api/projects/${PROJECT_ID}/upload" \
  -F "file=@${FILE_PATH}")"
echo "HTTP ${UPLOAD_STATUS}"
python3 -m json.tool < "${UPLOAD_BODY}"

WORKSPACE_ID="$(python3 - <<'PY' "${UPLOAD_BODY}"
import json, sys
with open(sys.argv[1], 'r', encoding='utf-8') as fh:
    data = json.load(fh)
print(data['data']['workspaceId'])
PY
)"
rm -f "${UPLOAD_BODY}"

echo
echo "== Executing command =="
BASE_URL="${BASE_URL}" WORKSPACE_STORE=/dev/null \
  services/container-gateway/scripts/exec-command.sh \
  --project "${PROJECT_ID}" \
  --workspace-id "${WORKSPACE_ID}" \
  ${CWD:+--cwd "${CWD}"} \
  ${TIMEOUT_MS:+--timeout-ms "${TIMEOUT_MS}"} \
  "${COMMAND}" "$@"
