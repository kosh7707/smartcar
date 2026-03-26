"""경로 정규화 유틸리티 — 모든 runner에서 공유."""

from __future__ import annotations

from pathlib import Path


def normalize_path(path: str, base_dir: Path) -> str:
    """절대 경로를 base_dir 기준 상대 경로로 변환.

    도구 출력의 파일 경로를 스캔 디렉토리 기준 상대 경로로 정규화한다.
    이미 상대 경로이거나 base_dir 하위가 아니면 그대로 반환.
    """
    base_str = str(base_dir)
    if not base_str.endswith("/"):
        base_str += "/"
    if path.startswith(base_str):
        return path[len(base_str):]
    try:
        return str(Path(path).relative_to(base_dir))
    except ValueError:
        return path
