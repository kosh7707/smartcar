from __future__ import annotations

import hashlib
import os
import re
from dataclasses import dataclass

from pydantic import ValidationError

from app.agent_runtime.path_util import resolve_scoped_path
from app.schemas.request import BuildMode, BuildResolveContract, ContractVersion, TaskRequest
from app.types import TaskType

_MAX_SCRIPT_HINT_BYTES = 20_000
_WINDOWS_DRIVE_OR_UNC = re.compile(r"^(?:[a-zA-Z]:[\\/]|\\\\|//)")


@dataclass(frozen=True)
class BuildScriptHintMaterial:
    """Validated uploaded-project script hint material for prompt reference."""

    path: str
    resolved_path: str
    content: str
    size_bytes: int
    sha256: str


@dataclass(frozen=True)
class BuildRequestPreflight:
    contract: BuildResolveContract
    project_path: str
    target_path: str
    target_name: str
    script_hint: BuildScriptHintMaterial | None = None


class BuildRequestContractValidator:
    def validate(self, request: TaskRequest) -> tuple[BuildRequestPreflight | None, list[str]]:
        if request.taskType != TaskType.BUILD_RESOLVE:
            return None, []

        try:
            contract = request.build_resolve_contract()
        except ValidationError as exc:
            return None, self._format_validation_errors(exc)

        errors: list[str] = []
        project_path = contract.projectPath

        if not os.path.isabs(project_path):
            errors.append("context.trusted.projectPath must be an absolute path")

        strict_mode = contract.strictMode is True

        if strict_mode and not os.path.isdir(project_path):
            errors.append(
                "strict compile-first v1 requires context.trusted.projectPath to exist and be a directory",
            )

        target_path = self._normalize_target_path(contract.buildTargetPath or contract.targetPath)
        if contract.buildTargetPath is not None or contract.targetPath is not None:
            scoped_target = resolve_scoped_path(project_path, target_path or ".")
            if scoped_target is None:
                errors.append("context.trusted.buildTargetPath must stay within projectPath")

        if strict_mode:
            if contract.buildTargetPath is None:
                errors.append(
                    "strict compile-first v1 requires context.trusted.buildTargetPath "
                    "(use '.' when the project root itself is the declared target)",
                )
            if not contract.buildTargetName:
                errors.append("strict compile-first v1 requires context.trusted.buildTargetName")
            if contract.buildMode is None:
                errors.append("strict compile-first v1 requires context.trusted.build.mode")
            if not contract.expectedArtifacts:
                errors.append("strict compile-first v1 requires context.trusted.expectedArtifacts")

        if contract.buildMode == BuildMode.SDK and contract.sdkId is None:
            errors.append("context.trusted.build.sdkId is required when build.mode is 'sdk'")
        if strict_mode and contract.buildMode == BuildMode.SDK and not (
            contract.setupScript or contract.buildEnvironment or contract.scriptHintPath
        ):
            errors.append(
                "strict compile-first v1 sdk builds require at least one materialization source: "
                "context.trusted.build.setupScript, context.trusted.build.environment, "
                "or context.trusted.build.scriptHintPath",
            )

        script_hint: BuildScriptHintMaterial | None = None
        if contract.scriptHintPath:
            script_hint, hint_errors = self._load_script_hint(
                project_path=project_path,
                target_path=target_path,
                script_hint_path=contract.scriptHintPath,
            )
            errors.extend(hint_errors)

        if errors:
            return None, errors

        target_name = contract.buildTargetName or contract.targetName or self._derive_target_name(project_path, target_path)
        return BuildRequestPreflight(
            contract=contract,
            project_path=project_path,
            target_path=target_path,
            target_name=target_name,
            script_hint=script_hint,
        ), []

    @staticmethod
    def _load_script_hint(
        *,
        project_path: str,
        target_path: str,
        script_hint_path: str,
    ) -> tuple[BuildScriptHintMaterial | None, list[str]]:
        errors: list[str] = []
        if not script_hint_path:
            return None, ["context.trusted.build.scriptHintPath must not be empty"]
        if "\x00" in script_hint_path:
            return None, ["context.trusted.build.scriptHintPath must not contain NUL bytes"]
        if "\\" in script_hint_path:
            return None, ["context.trusted.build.scriptHintPath must use POSIX '/' separators"]
        if os.path.isabs(script_hint_path) or _WINDOWS_DRIVE_OR_UNC.match(script_hint_path):
            return None, ["context.trusted.build.scriptHintPath must be a relative uploaded-project path"]

        normalized = os.path.normpath(script_hint_path)
        if ".." in script_hint_path.split("/"):
            return None, ["context.trusted.build.scriptHintPath must not contain path traversal"]
        if normalized in ("", ".") or normalized.startswith("../") or normalized == "..":
            return None, ["context.trusted.build.scriptHintPath must not traverse outside the build target"]
        if ".." in normalized.split(os.sep):
            return None, ["context.trusted.build.scriptHintPath must not contain path traversal"]

        # Canonical interpretation after S2 review: scriptHintPath is relative
        # to the effective BuildTarget root, not the broader uploaded project
        # root.  This keeps Build Agent hints scoped to the declared target.
        allowed_root = os.path.join(project_path, target_path) if target_path else project_path
        resolved = resolve_scoped_path(allowed_root, normalized)
        if resolved is None:
            return None, ["context.trusted.build.scriptHintPath must resolve inside the build target scope"]
        if not os.path.isfile(resolved):
            return None, ["context.trusted.build.scriptHintPath must resolve to a regular file"]

        try:
            size_bytes = os.path.getsize(resolved)
        except OSError:
            return None, ["context.trusted.build.scriptHintPath could not be stat'ed"]
        if size_bytes > _MAX_SCRIPT_HINT_BYTES:
            return None, [
                "context.trusted.build.scriptHintPath exceeds "
                f"{_MAX_SCRIPT_HINT_BYTES} byte limit",
            ]

        try:
            with open(resolved, "rb") as fp:
                raw = fp.read()
        except OSError:
            return None, ["context.trusted.build.scriptHintPath could not be read"]
        if b"\x00" in raw:
            return None, ["context.trusted.build.scriptHintPath must be a text file without NUL bytes"]
        try:
            content = raw.decode("utf-8")
        except UnicodeDecodeError:
            return None, ["context.trusted.build.scriptHintPath must be UTF-8 text"]

        return BuildScriptHintMaterial(
            path=normalized,
            resolved_path=resolved,
            content=content,
            size_bytes=size_bytes,
            sha256=hashlib.sha256(raw).hexdigest(),
        ), []

    @staticmethod
    def _normalize_target_path(target_path: str | None) -> str:
        if target_path is None:
            return ""
        normalized = os.path.normpath(target_path)
        return "" if normalized == "." else normalized

    @staticmethod
    def _derive_target_name(project_path: str, target_path: str) -> str:
        if target_path:
            return os.path.basename(target_path.rstrip("/")) or target_path
        return os.path.basename(os.path.normpath(project_path)) or "project-root"

    @staticmethod
    def _format_validation_errors(exc: ValidationError) -> list[str]:
        errors: list[str] = []
        for error in exc.errors():
            loc = ".".join(str(part) for part in error.get("loc", ()))
            msg = error.get("msg", "invalid value")
            errors.append(f"{loc}: {msg}" if loc else msg)
        return errors


def normalize_contract_version(contract: BuildResolveContract) -> str:
    if contract.contractVersion == ContractVersion.BUILD_RESOLVE_V1:
        return ContractVersion.BUILD_RESOLVE_V1.value
    return ContractVersion.LEGACY.value
