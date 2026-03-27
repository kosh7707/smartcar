"""FilePolicy — 에이전트 생성 파일 추적 + 권한 판정 + 내용 안전성 검사.

build-aegis/ 하위에 에이전트가 만든 파일만 수정/삭제 가능.
프로젝트 원본 파일은 read-only.
"""
from __future__ import annotations

import os
import re


class FilePolicy:
    """능력 기반 파일 접근 정책.

    - read: 프로젝트 내 모든 파일
    - write: build-aegis/ 하위만
    - edit/delete: build-aegis/ 하위 + 이 세션에서 에이전트가 생성한 파일만
    """

    def __init__(self, project_path: str, build_dir: str = "build-aegis") -> None:
        self._project_path = os.path.normpath(project_path)
        self._build_dir = os.path.normpath(os.path.join(project_path, build_dir))
        self._created_files: set[str] = set()

    @property
    def build_dir(self) -> str:
        return self._build_dir

    @property
    def project_path(self) -> str:
        return self._project_path

    @property
    def created_files(self) -> frozenset[str]:
        return frozenset(self._created_files)

    def _resolve_project(self, path: str) -> str:
        return os.path.normpath(os.path.join(self._project_path, path))

    def _resolve_build(self, path: str) -> str:
        return os.path.normpath(os.path.join(self._build_dir, path))

    def can_read(self, path: str) -> bool:
        """프로젝트 내 파일이면 읽기 허용."""
        full = self._resolve_project(path)
        return full.startswith(self._project_path + os.sep) or full == self._project_path

    def can_write(self, path: str) -> bool:
        """build-aegis/ 하위이면 쓰기 허용."""
        full = self._resolve_build(path)
        return full.startswith(self._build_dir + os.sep) or full == self._build_dir

    def can_edit(self, path: str) -> bool:
        """이 세션에서 에이전트가 생성한 파일만 수정 허용."""
        full = self._resolve_build(path)
        return full in self._created_files

    def can_delete(self, path: str) -> bool:
        """이 세션에서 에이전트가 생성한 파일만 삭제 허용."""
        return self.can_edit(path)

    def record_created(self, path: str) -> None:
        """에이전트가 파일을 생성했음을 기록한다. build_dir 밖 경로는 무시."""
        full = self._resolve_build(path)
        if full.startswith(self._build_dir + os.sep) or full == self._build_dir:
            self._created_files.add(full)

    def record_deleted(self, path: str) -> None:
        """에이전트가 파일을 삭제했음을 기록한다."""
        full = self._resolve_build(path)
        self._created_files.discard(full)

    # --- 내용 안전성 검사 ---

    _CONTENT_FORBIDDEN = [
        re.compile(r"\brm\s+-[rf]", re.I),
        re.compile(r"\bcurl\b", re.I),
        re.compile(r"\bwget\b", re.I),
        re.compile(r"\bgit\s+(?:clone|push|pull)\b", re.I),
        re.compile(r"\bdocker\b", re.I),
        re.compile(r"\bchmod\b", re.I),
        re.compile(r"\bchown\b", re.I),
        re.compile(r"\bsudo\b", re.I),
        re.compile(r"\bapt-get\b|\byum\b|\bpip\s+install\b", re.I),
    ]

    @classmethod
    def scan_content(cls, content: str) -> list[str]:
        """스크립트 내용에서 금지 패턴을 검색한다. 발견된 패턴 목록을 반환."""
        warnings: list[str] = []
        for pattern in cls._CONTENT_FORBIDDEN:
            match = pattern.search(content)
            if match:
                warnings.append(match.group())
        return warnings
