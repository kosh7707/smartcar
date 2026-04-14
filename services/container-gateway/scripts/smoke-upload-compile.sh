#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${BASE_URL:-http://localhost:4010}"
PROJECT_ID="${PROJECT_ID:-demo-project}"
TMP_DIR="${TMP_DIR:-$(mktemp -d /tmp/s8-upload-compile-XXXXXX)}"
trap 'rm -rf "$TMP_DIR"' EXIT
mkdir -p "$TMP_DIR/src"
printf 'int main(void){return 0;}\n' > "$TMP_DIR/src/main.c"
python3 - <<'PY' "$TMP_DIR"
import pathlib, sys, zipfile
tmp = pathlib.Path(sys.argv[1])
with zipfile.ZipFile(tmp / "sample.zip", "w") as zf:
    zf.write(tmp / "src" / "main.c", arcname="main.c")
PY
resp=$(curl -sS -X POST "$BASE_URL/api/projects/$PROJECT_ID/upload" -F "file=@$TMP_DIR/sample.zip;type=application/zip")
echo "$resp" | python3 -m json.tool
workspace_id=$(python3 - <<'PY' "$resp"
import json,sys
print(json.loads(sys.argv[1])['data']['workspaceId'])
PY
)
comp=$(curl -sS -X POST "$BASE_URL/api/projects/$PROJECT_ID/compile" -H 'Content-Type: application/json' -d "{\"workspaceId\":\"$workspace_id\",\"profile\":{\"language\":\"c\",\"entryFile\":\"main.c\",\"outputName\":\"main\"}}")
echo "$comp" | python3 -m json.tool
exec_resp=$(curl -sS -X POST "$BASE_URL/api/projects/$PROJECT_ID/exec" -H 'Content-Type: application/json' -d "{\"workspaceId\":\"$workspace_id\",\"command\":\"pwd\"}")
echo "$exec_resp" | python3 -m json.tool
