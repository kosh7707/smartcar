from __future__ import annotations

import os
from dataclasses import dataclass

from pydantic import ValidationError

from agent_shared.path_util import resolve_scoped_path
from app.schemas.request import BuildMode, BuildResolveContract, ContractVersion, TaskRequest
from app.types import TaskType


@dataclass(frozen=True)
class BuildRequestPreflight:
    contract: BuildResolveContract
    project_path: str
    target_path: str
    target_name: str


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

        target_path = self._normalize_target_path(contract.subprojectPath or contract.targetPath)
        if contract.subprojectPath is not None or contract.targetPath is not None:
            scoped_target = resolve_scoped_path(project_path, target_path or ".")
            if scoped_target is None:
                errors.append("context.trusted.subprojectPath must stay within projectPath")

        if strict_mode:
            if contract.subprojectPath is None:
                errors.append(
                    "strict compile-first v1 requires context.trusted.subprojectPath "
                    "(use '.' when the project root itself is the declared target)",
                )
            if not contract.subprojectName:
                errors.append("strict compile-first v1 requires context.trusted.subprojectName")
            if contract.buildMode is None:
                errors.append("strict compile-first v1 requires context.trusted.build.mode")
            if not contract.expectedArtifacts:
                errors.append("strict compile-first v1 requires context.trusted.expectedArtifacts")

        if contract.buildMode == BuildMode.SDK and contract.sdkId is None:
            errors.append("context.trusted.build.sdkId is required when build.mode is 'sdk'")

        if errors:
            return None, errors

        target_name = contract.subprojectName or contract.targetName or self._derive_target_name(project_path, target_path)
        return BuildRequestPreflight(
            contract=contract,
            project_path=project_path,
            target_path=target_path,
            target_name=target_name,
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
