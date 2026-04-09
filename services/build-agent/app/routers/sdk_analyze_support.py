"""Support helpers for sdk-analyze task routing."""

from __future__ import annotations

import os
import re


_EXPORT_RE = re.compile(r"^\s*export\s+([A-Z0-9_]+)=(.*)$")


def parse_export_lines(text: str) -> dict[str, str]:
    exports: dict[str, str] = {}
    for line in text.splitlines():
        match = _EXPORT_RE.match(line.strip())
        if not match:
            continue
        key, raw_value = match.groups()
        value = raw_value.strip().strip('"').strip("'")
        exports[key] = value
    return exports


def tokenize_flags(value: str) -> list[str]:
    return [token for token in value.split() if token]


def walk_matching_files(
    root: str,
    predicate,
    *,
    max_depth: int,
    limit: int,
) -> list[str]:
    matches: list[str] = []
    root = os.path.abspath(root)
    root_depth = root.count(os.sep)

    for current_root, dirs, files in os.walk(root):
        current_depth = current_root.count(os.sep) - root_depth
        if current_depth >= max_depth:
            dirs[:] = []

        for name in files:
            path = os.path.join(current_root, name)
            if predicate(path):
                matches.append(path)
                if len(matches) >= limit:
                    return sorted(matches)

    return sorted(matches)


def infer_target_arch(environment_setup: str, compiler_prefix: str) -> str:
    hint = f"{environment_setup} {compiler_prefix}".lower()
    if "armv7" in hint:
        return "armv7-a"
    if "aarch64" in hint or "arm64" in hint:
        return "arm64"
    if "arm" in hint:
        return "arm"
    if "x86_64" in hint:
        return "x86_64"
    return ""


def discover_sdk_profile(sdk_path: str) -> dict | None:
    env_scripts = walk_matching_files(
        sdk_path,
        lambda path: os.path.basename(path).startswith("environment-setup-"),
        max_depth=4,
        limit=10,
    )
    compiler_candidates = walk_matching_files(
        sdk_path,
        lambda path: os.access(path, os.X_OK) and os.path.basename(path).endswith("gcc"),
        max_depth=8,
        limit=20,
    )

    if not env_scripts and not compiler_candidates:
        return None

    exports: dict[str, str] = {}
    env_script = env_scripts[0] if env_scripts else ""
    if env_script:
        with open(env_script, encoding="utf-8", errors="ignore") as fh:
            exports = parse_export_lines(fh.read())

    compiler_from_cc = ""
    cc_value = exports.get("CC", "")
    if cc_value:
        compiler_from_cc = tokenize_flags(cc_value)[0]

    compiler_path = ""
    if compiler_from_cc and os.path.isabs(compiler_from_cc):
        compiler_path = compiler_from_cc
    elif compiler_from_cc:
        compiler_path = next(
            (
                candidate for candidate in compiler_candidates
                if os.path.basename(candidate) == compiler_from_cc
            ),
            "",
        )
    elif compiler_candidates:
        compiler_path = compiler_candidates[0]

    compiler_prefix = ""
    if compiler_path:
        compiler_name = os.path.basename(compiler_path)
        if compiler_name.endswith("-gcc"):
            compiler_prefix = compiler_name[:-4]
        else:
            compiler_prefix = compiler_name

    cflags = " ".join(filter(None, [exports.get("CFLAGS", ""), exports.get("CPPFLAGS", "")]))
    tokens = tokenize_flags(cflags)
    include_paths = [token[2:] for token in tokens if token.startswith("-I") and len(token) > 2]
    defines = {}
    for token in tokens:
        if token.startswith("-D") and len(token) > 2:
            key_value = token[2:].split("=", 1)
            key = key_value[0]
            value = key_value[1] if len(key_value) == 2 else "1"
            defines[key] = value

    language_standard = ""
    for token in tokens:
        if token.startswith("-std="):
            language_standard = token[5:]
            break
    if not language_standard:
        language_standard = "c11"

    sysroot = exports.get("SDKTARGETSYSROOT") or exports.get("OECORE_TARGET_SYSROOT", "")

    return {
        "compiler": compiler_path,
        "compilerPrefix": compiler_prefix,
        "gccVersion": "",
        "targetArch": infer_target_arch(os.path.basename(env_script), compiler_prefix),
        "languageStandard": language_standard,
        "sysroot": sysroot,
        "environmentSetup": os.path.relpath(env_script, sdk_path) if env_script else "",
        "includePaths": include_paths,
        "defines": defines,
    }


def build_sdk_analyze_prompt(sdk_path: str) -> str:
    """sdk-analyze 시스템 프롬프트."""
    return (
        "당신은 AEGIS SDK Analyzer입니다.\n"
        "주어진 SDK 디렉토리를 분석하여 프로파일 정보를 추출하는 것이 유일한 목표입니다.\n\n"
        "## 분석 대상\n"
        f"SDK 경로: `{sdk_path}`\n\n"
        "## 분석 전략\n\n"
        "### 1단계: SDK 구조 탐색 (list_files → read_file)\n"
        "1. **반드시 첫 동작은 `list_files`** 로 SDK 루트 구조를 확인하라.\n"
        "2. `environment-setup-*`, `README*`, `Makefile`, `setup.sh`, `bin/*gcc*` 후보를 찾은 뒤에만 `read_file`을 호출하라.\n"
        "3. `read_file`에는 반드시 실제 파일 경로만 넣어라. 디렉토리를 읽으려고 하지 마라.\n"
        "4. `environment-setup-*` 스크립트에서 compilerPrefix, sysroot, CFLAGS, defines를 추출하라.\n"
        "5. `bin/*gcc*` 경로를 확인해 compiler 절대 경로를 식별하라.\n"
        "6. SDK 루트의 README/Makefile/setup 스크립트에서 벤더/제품명을 보강하라.\n\n"
        "### 2단계: 컴파일러 확인 (try_build, 선택)\n"
        "컴파일러 버전을 확인하려면 try_build로 `{compiler} --version` 실행 가능.\n"
        "디렉토리 탐색을 위해 `try_build`로 `ls` 같은 셸 명령을 실행하지 마라.\n\n"
        "### 3단계: 보고서 작성\n"
        "탐색 결과를 아래 JSON 스키마로 출력하라.\n\n"
        "## 절대 규칙\n"
        "1. SDK 파일을 수정하지 마라. read_file로 읽기만.\n"
        "2. write_file/edit_file/delete_file은 사용하지 마라 (SDK 분석에 파일 생성 불필요).\n"
        "3. `usedEvidenceRefs`와 `claims[].supportingEvidenceRefs`에는 **도구가 반환한 refId만** 넣어라. 명령어 문자열, 파일 경로, 자연어 설명을 ref처럼 쓰지 마라.\n\n"
        "## 출력 형식\n"
        "**순수 JSON만 출력. 코드 펜스, 인사말 금지. 첫 문자는 `{`.**\n"
        "```json\n"
        "{\n"
        '  "summary": "SDK 분석 결과 요약 (1-2문장)",\n'
        '  "sdkProfile": {\n'
        '    "compiler": "arm-none-linux-gnueabihf-gcc (절대 경로)",\n'
        '    "compilerPrefix": "arm-none-linux-gnueabihf",\n'
        '    "gccVersion": "9.2.1",\n'
        '    "targetArch": "armv7-a",\n'
        '    "languageStandard": "c11",\n'
        '    "sysroot": "SDK 내 상대 경로",\n'
        '    "environmentSetup": "SDK 내 environment-setup 스크립트 상대 경로",\n'
        '    "includePaths": ["sysroot 내 include 경로"],\n'
        '    "defines": {"__ARM_ARCH": "7", ...}\n'
        "  },\n"
        '  "claims": [{"statement": "발견 사항", "supportingEvidenceRefs": []}],\n'
        '  "caveats": ["제한사항"],\n'
        '  "usedEvidenceRefs": [],\n'
        '  "needsHumanReview": false,\n'
        '  "recommendedNextSteps": [],\n'
        '  "policyFlags": []\n'
        "}\n"
        "```\n"
    )
