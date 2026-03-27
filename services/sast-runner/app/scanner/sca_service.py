"""SCA 서비스 — 라이브러리 식별 + upstream diff 오케스트레이션."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any

from app.scanner.library_differ import LibraryDiffer
from app.scanner.library_identifier import LibraryIdentifier

logger = logging.getLogger("aegis-sast-runner")

# 모듈 수준 싱글톤 (router에서 공유)
_identifier = LibraryIdentifier()
_differ = LibraryDiffer()


async def analyze_libraries(
    project_dir: Path,
    *,
    include_diff: bool = True,
) -> list[dict[str, Any]]:
    """라이브러리 식별 + upstream diff를 수행.

    /v1/scan, /v1/functions, /v1/libraries, /v1/build-and-analyze에서 공통 사용.

    Args:
        project_dir: 프로젝트 루트 경로
        include_diff: upstream diff 수행 여부 (기본 True)

    Returns:
        라이브러리 목록 (각각 diff 결과 포함)
    """
    libs_raw = await asyncio.to_thread(_identifier.identify, project_dir)
    results: list[dict[str, Any]] = []

    for lib in libs_raw:
        entry: dict[str, Any] = dict(lib)
        lib_path = project_dir / lib["path"]
        repo_url = lib.get("repoUrl")
        version = lib.get("version")
        commit = lib.get("commit")

        if include_diff and repo_url:
            try:
                if commit:
                    entry["diff"] = await _differ.diff(
                        lib_path, repo_url, version, commit=commit,
                    )
                elif version:
                    entry["diff"] = await _differ.diff(
                        lib_path, repo_url, version,
                    )
                else:
                    entry["diff"] = await _differ.find_closest_version(
                        lib_path, repo_url,
                    )
            except Exception as exc:
                logger.warning(
                    "lib_differ.diff failed for %s: %s", lib["name"], exc,
                )
                entry["diff"] = None
        elif not repo_url:
            entry["diff"] = None
            if include_diff:
                entry["note"] = "Unknown library — no upstream repo to compare"

        results.append(entry)

    return results


async def identify_libraries(project_dir: Path) -> list[dict[str, Any]]:
    """라이브러리 식별만 수행 (diff 없음). origin 태깅용. 이벤트루프 블로킹 방지."""
    return await asyncio.to_thread(_identifier.identify, project_dir)
