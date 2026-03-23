"""파일 해시 기반 라이브러리 비교 — 패키징 차이에 면역."""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger("aegis-sast-runner")

# 소스 코드 확장자
_SOURCE_EXTS = {".c", ".cpp", ".cc", ".cxx", ".h", ".hpp", ".hxx"}

# 무시할 경로
_SKIP_PATHS = {"test", "tests", "example", "examples", "doc", "docs",
               "benchmark", "fuzztest", "unittest", "perftest", ".git"}


def hash_source_files(directory: Path) -> dict[str, str]:
    """디렉토리 내 소스 파일의 SHA256 해시 맵을 생성.

    Returns:
        { "src/civetweb.c": "a3f2b7...", "include/civetweb.h": "9c1d4e...", ... }
    """
    hashes: dict[str, str] = {}

    for f in directory.rglob("*"):
        if not f.is_file():
            continue
        if f.suffix.lower() not in _SOURCE_EXTS:
            continue

        # 스킵 경로 확인
        try:
            rel = str(f.relative_to(directory))
        except ValueError:
            continue
        if any(skip in rel.lower().split("/") for skip in _SKIP_PATHS):
            continue

        try:
            content = f.read_bytes()
            # 줄 끝 정규화 (CRLF → LF) — OS 차이로 인한 불일치 방지
            content = content.replace(b"\r\n", b"\n")
            file_hash = hashlib.sha256(content).hexdigest()[:16]
            hashes[rel] = file_hash
        except Exception:
            continue

    return hashes


def compare_hashes(
    local_hashes: dict[str, str],
    upstream_hashes: dict[str, str],
) -> dict[str, Any]:
    """두 해시 맵을 비교하여 수정/추가/삭제 파일을 분류.

    Returns:
        {
            "identical": ["src/main.c", ...],
            "modified": ["src/civetweb.c", ...],
            "added": ["src/my_patch.c", ...],
            "deleted": ["src/old_file.c", ...],
            "identicalCount": 45,
            "modifiedCount": 2,
            "addedCount": 1,
            "deletedCount": 0,
            "matchRatio": 0.94
        }
    """
    all_files = set(local_hashes.keys()) | set(upstream_hashes.keys())

    identical: list[str] = []
    modified: list[str] = []
    added: list[str] = []
    deleted: list[str] = []

    for f in sorted(all_files):
        local_h = local_hashes.get(f)
        upstream_h = upstream_hashes.get(f)

        if local_h and upstream_h:
            if local_h == upstream_h:
                identical.append(f)
            else:
                modified.append(f)
        elif local_h and not upstream_h:
            added.append(f)
        elif not local_h and upstream_h:
            deleted.append(f)

    total_comparable = len(identical) + len(modified)
    match_ratio = len(identical) / total_comparable if total_comparable > 0 else 0.0

    return {
        "identical": identical,
        "modified": modified,
        "added": added,
        "deleted": deleted,
        "identicalCount": len(identical),
        "modifiedCount": len(modified),
        "addedCount": len(added),
        "deletedCount": len(deleted),
        "matchRatio": round(match_ratio, 4),
    }
