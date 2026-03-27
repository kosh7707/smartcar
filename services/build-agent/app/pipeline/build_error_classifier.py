"""BuildErrorClassifier — 빌드 에러 출력을 결정론적으로 분류하고 복구 제안을 생성한다."""
from __future__ import annotations

import re
from dataclasses import dataclass
from enum import StrEnum


class BuildErrorCategory(StrEnum):
    MISSING_HEADER = "missing_header"
    UNDEFINED_SYMBOL = "undefined_symbol"
    TOOLCHAIN_NOT_FOUND = "toolchain_not_found"
    PERMISSION_DENIED = "permission_denied"
    SYNTAX_ERROR = "syntax_error"
    MISSING_LIBRARY = "missing_library"
    CMAKE_CONFIG_ERROR = "cmake_config_error"
    FILE_NOT_FOUND = "file_not_found"
    UNKNOWN = "unknown"


@dataclass
class BuildErrorClassification:
    category: BuildErrorCategory
    message: str
    suggestion: str


# (regex, category, suggestion_template)
# suggestion_template 안의 {0}, {1} 등은 regex 캡처 그룹으로 치환
_PATTERNS: list[tuple[re.Pattern, BuildErrorCategory, str]] = [
    # Missing header: "fatal error: foo.h: No such file or directory"
    (re.compile(r"fatal error:\s*(.+?\.h[p]*)\s*:\s*No such file", re.I),
     BuildErrorCategory.MISSING_HEADER,
     "누락 헤더 '{0}' — 빌드 스크립트에 -I<include_path>를 추가하거나 해당 헤더의 패키지를 확인하라"),

    # Missing header variant: "error: 'foo.h' file not found"
    (re.compile(r"error:\s*['\"]?(.+?\.h[p]*)['\"]?\s*file not found", re.I),
     BuildErrorCategory.MISSING_HEADER,
     "누락 헤더 '{0}' — -I 플래그로 include 경로를 추가하라"),

    # Toolchain not found: "arm-none-linux-gnueabihf-gcc: not found"
    (re.compile(r"(\S+(?:gcc|g\+\+|cc|ld))\s*:\s*(?:not found|No such file|command not found)", re.I),
     BuildErrorCategory.TOOLCHAIN_NOT_FOUND,
     "툴체인 '{0}'을 찾을 수 없음 — SDK 환경 설정(source environment-setup-*)을 빌드 스크립트에 추가하라"),

    # Undefined symbol: "undefined reference to `foo'"
    (re.compile(r"undefined reference to [`'\"](\w+)[`'\"]", re.I),
     BuildErrorCategory.UNDEFINED_SYMBOL,
     "미정의 심볼 '{0}' — 링커 플래그에 -l<library>를 추가하라"),

    # Missing library: "cannot find -lfoo"
    (re.compile(r"cannot find -l(\w+)", re.I),
     BuildErrorCategory.MISSING_LIBRARY,
     "라이브러리 '-l{0}'을 찾을 수 없음 — -L<library_path>를 추가하거나 해당 기능을 비활성화하라"),

    # CMake error
    (re.compile(r"CMake Error(?:\s+at\s+(.+?))?:", re.I),
     BuildErrorCategory.CMAKE_CONFIG_ERROR,
     "CMake 설정 오류{0} — CMakeLists.txt의 누락된 패키지나 잘못된 경로를 수정하라"),

    # Permission denied
    (re.compile(r"Permission denied", re.I),
     BuildErrorCategory.PERMISSION_DENIED,
     "권한 거부 — `bash script.sh` 형태로 실행하라 (chmod 불필요). build_command에 `bash`를 명시하라"),

    # Syntax error
    (re.compile(r"(?:syntax error|parse error|expected .+ before)", re.I),
     BuildErrorCategory.SYNTAX_ERROR,
     "문법 오류 — 빌드 스크립트의 문법을 확인하라 (소스 코드 오류인지 스크립트 오류인지 구분)"),

    # Generic file not found (lowest priority)
    (re.compile(r"(\S+)\s*:\s*No such file or directory", re.I),
     BuildErrorCategory.FILE_NOT_FOUND,
     "파일 '{0}'을 찾을 수 없음 — 경로가 올바른지 확인. PROJECT_ROOT 설정을 점검하라"),
]


def classify_build_error(output: str) -> list[BuildErrorClassification]:
    """빌드 출력을 분석하여 에러를 분류한다. 순수 함수, LLM 없음."""
    if not output:
        return []

    results: list[BuildErrorClassification] = []
    seen_categories: set[BuildErrorCategory] = set()

    for pattern, category, suggestion_tpl in _PATTERNS:
        for match in pattern.finditer(output):
            if category in seen_categories:
                break  # 같은 카테고리 중복 방지
            groups = match.groups()
            # suggestion 내 {0}, {1} 치환
            suggestion = suggestion_tpl
            for i, g in enumerate(groups):
                suggestion = suggestion.replace(f"{{{i}}}", g.strip() if g else "")
            results.append(BuildErrorClassification(
                category=category,
                message=match.group(0).strip()[:200],
                suggestion=suggestion,
            ))
            seen_categories.add(category)
            break  # 첫 매치만

    return results
