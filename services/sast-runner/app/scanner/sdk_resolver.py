"""SDK 설치 경로 자동 해석 — BuildProfile.sdkId로 헤더/컴파일러 경로를 찾는다.

SDK 폴더 규칙:
  SAST_SDK_ROOT=/home/kosh/sdks   (.env에 설정)
    └── ti-am335x/                 ← sdkId가 곧 폴더명
    └── nxp-s32k/                  ← 나중에 추가 시
  sdkId가 레지스트리에 있으면 → sysroot/compiler 자동 해석
  sdkId가 레지스트리에 없어도 폴더가 있으면 → includePaths로 활용 가능
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from app.schemas.request import BuildProfile

logger = logging.getLogger("aegis-sast-runner")


def _get_sdk_root() -> Path:
    """SDK 루트 디렉토리. .env의 SAST_SDK_ROOT → 폴백 ~/sdks."""
    from app.config import settings
    if settings.sdk_root:
        return Path(settings.sdk_root)
    return Path.home() / "sdks"


# SDK 레지스트리 — sdkId별 내부 구조 정보
# base 경로는 _get_sdk_root() / sdkId로 자동 결정
_SDK_REGISTRY: dict[str, dict[str, Any]] = {
    "ti-am335x": {
        "sysroot": "linux-devkit/sysroots/x86_64-arago-linux",
        "compiler_prefix": "arm-none-linux-gnueabihf",
        "gcc_version": "9.2.1",
        "environment_setup": "linux-devkit/environment-setup-armv7at2hf-neon-linux-gnueabi",
    },
}


def _get_sdk_base(sdk_id: str) -> Path:
    """sdkId에 해당하는 SDK 설치 경로."""
    return _get_sdk_root() / sdk_id


def resolve_sdk_paths(profile: BuildProfile) -> list[str]:
    """BuildProfile의 sdkId에서 헤더 인클루드 경로를 해석한다.

    반환하는 경로들은 도구의 -I 옵션에 직접 사용할 수 있다.
    profile.includePaths가 있으면 그것도 포함한다.
    """
    paths: list[str] = []

    # 1. SDK 레지스트리에서 자동 해석
    sdk_info = _SDK_REGISTRY.get(profile.sdk_id)
    base = _get_sdk_base(profile.sdk_id)

    if sdk_info and base.is_dir():
        sdk_paths = _resolve_from_registry(base, sdk_info)
        paths.extend(sdk_paths)
        logger.info(
            "Resolved %d include paths from SDK '%s' at %s",
            len(sdk_paths), profile.sdk_id, base,
        )
    elif not base.is_dir():
        logger.warning("SDK directory not found: %s", base)

    # 2. BuildProfile에 명시된 includePaths 추가
    if profile.include_paths:
        paths.extend(profile.include_paths)

    return paths


def get_sdk_compiler(profile: BuildProfile) -> str | None:
    """SDK의 크로스 컴파일러 경로를 반환."""
    sdk_info = _SDK_REGISTRY.get(profile.sdk_id)
    if not sdk_info:
        return None

    base = _get_sdk_base(profile.sdk_id)
    sysroot = sdk_info["sysroot"]
    prefix = sdk_info["compiler_prefix"]

    compiler_path = base / sysroot / "usr" / "bin" / f"{prefix}-gcc"
    if compiler_path.exists():
        return str(compiler_path)
    return None


def get_sdk_environment_setup(profile: BuildProfile) -> str | None:
    """SDK의 environment-setup 스크립트 경로를 반환."""
    sdk_info = _SDK_REGISTRY.get(profile.sdk_id)
    if not sdk_info or "environment_setup" not in sdk_info:
        return None

    base = _get_sdk_base(profile.sdk_id)
    setup_path = base / sdk_info["environment_setup"]
    if setup_path.exists():
        return str(setup_path)
    return None


def _resolve_from_registry(base: Path, sdk_info: dict[str, Any]) -> list[str]:
    """레지스트리 정보에서 인클루드 경로 목록을 생성."""
    sysroot = sdk_info["sysroot"]
    prefix = sdk_info["compiler_prefix"]
    gcc_ver = sdk_info["gcc_version"]

    sysroot_dir = base / sysroot
    if not sysroot_dir.exists():
        logger.warning("SDK sysroot not found: %s", sysroot_dir)
        return []

    gcc_base = sysroot_dir / "usr" / "lib" / "gcc" / prefix / gcc_ver
    cpp_include = sysroot_dir / "usr" / prefix / "include" / "c++" / gcc_ver
    libc_include = sysroot_dir / "usr" / prefix / "libc" / "usr" / "include"

    candidates = [
        # C++ 표준 라이브러리
        cpp_include,
        cpp_include / prefix,
        cpp_include / "backward",
        # GCC 내장 헤더
        gcc_base / "include",
        gcc_base / "include-fixed",
        # ARM 타겟 헤더
        sysroot_dir / "usr" / prefix / "include",
        # libc 헤더
        libc_include,
    ]

    return [str(p) for p in candidates if p.exists()]
