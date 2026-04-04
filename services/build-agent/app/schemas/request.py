from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.types import TaskType

class Context(BaseModel):
    trusted: dict
    semiTrusted: dict | None = None
    untrusted: dict | None = None

class Constraints(BaseModel):
    maxTokens: int = Field(8192, ge=1, le=16384)
    timeoutMs: int = Field(600000, ge=1000, le=900000)
    outputSchema: str | None = None

class EvidenceRef(BaseModel):
    refId: str
    artifactId: str
    artifactType: str
    locatorType: str
    locator: dict
    hash: str | None = None


class BuildMode(StrEnum):
    NATIVE = "native"
    SDK = "sdk"


class ContractVersion(StrEnum):
    LEGACY = "legacy"
    COMPILE_FIRST_V1 = "compile-first-v1"


class ExpectedArtifactType(StrEnum):
    EXECUTABLE = "executable"
    SHARED_LIBRARY = "shared-library"
    STATIC_LIBRARY = "static-library"
    NAMED_OUTPUT_SET = "named-output-set"


class ExpectedArtifact(BaseModel):
    artifactType: ExpectedArtifactType
    path: str | None = None
    name: str | None = None

    @field_validator("path", "name")
    @classmethod
    def _strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @model_validator(mode="after")
    def _validate_named_output(self) -> "ExpectedArtifact":
        if self.artifactType == ExpectedArtifactType.NAMED_OUTPUT_SET and not (self.name or self.path):
            raise ValueError("named-output-set artifacts require either 'name' or 'path'")
        return self


class BuildResolveContract(BaseModel):
    model_config = ConfigDict(extra="ignore")

    projectPath: str = Field(min_length=1)
    targetPath: str | None = None
    targetName: str | None = None
    buildMode: BuildMode | None = None
    sdkId: str | None = None
    expectedArtifacts: list[ExpectedArtifact] = Field(default_factory=list)
    contractVersion: ContractVersion | None = None
    strictMode: bool | None = None

    @field_validator("projectPath", "targetPath", "targetName", "sdkId", mode="before")
    @classmethod
    def _strip_text(cls, value: Any) -> Any:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @field_validator("projectPath")
    @classmethod
    def _require_project_path(cls, value: str | None) -> str:
        if not value:
            raise ValueError("projectPath is required")
        return value

    @field_validator("contractVersion", mode="before")
    @classmethod
    def _normalize_contract_version(cls, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, ContractVersion):
            return value
        if not isinstance(value, str):
            raise ValueError("contractVersion must be a string")

        normalized = value.strip().lower()
        aliases = {
            "legacy": ContractVersion.LEGACY,
            "v0": ContractVersion.LEGACY,
            "v0-legacy": ContractVersion.LEGACY,
            "compile-first-v1": ContractVersion.COMPILE_FIRST_V1,
            "v1": ContractVersion.COMPILE_FIRST_V1,
            "strict-v1": ContractVersion.COMPILE_FIRST_V1,
        }
        contract_version = aliases.get(normalized)
        if contract_version is None:
            raise ValueError(
                "contractVersion must be one of legacy, v0, compile-first-v1, v1, or strict-v1",
            )
        return contract_version

    @field_validator("expectedArtifacts", mode="before")
    @classmethod
    def _coerce_expected_artifacts(cls, value: Any) -> Any:
        if value is None:
            return []
        if not isinstance(value, list):
            raise ValueError("expectedArtifacts must be a list")

        normalized: list[Any] = []
        for item in value:
            if isinstance(item, str):
                normalized.append({"artifactType": item})
            else:
                normalized.append(item)
        return normalized

    @model_validator(mode="after")
    def _normalize_contract(self) -> "BuildResolveContract":
        if self.strictMode is True and self.contractVersion in (None, ContractVersion.LEGACY):
            self.contractVersion = ContractVersion.COMPILE_FIRST_V1
        elif self.strictMode is False and self.contractVersion == ContractVersion.COMPILE_FIRST_V1:
            raise ValueError("strictMode=false conflicts with contractVersion=compile-first-v1")
        elif self.strictMode is None:
            self.strictMode = self.contractVersion == ContractVersion.COMPILE_FIRST_V1

        if self.contractVersion is None:
            self.contractVersion = (
                ContractVersion.COMPILE_FIRST_V1 if self.strictMode else ContractVersion.LEGACY
            )

        if self.buildMode == BuildMode.SDK and not self.sdkId:
            raise ValueError("sdkId is required when buildMode is 'sdk'")
        if self.buildMode == BuildMode.NATIVE and self.sdkId:
            raise ValueError("sdkId must be omitted when buildMode is 'native'")

        return self

class TaskRequest(BaseModel):
    taskType: TaskType
    taskId: str
    context: Context
    evidenceRefs: list[EvidenceRef] = Field(default_factory=list)
    constraints: Constraints = Field(default_factory=Constraints)
    metadata: dict | None = None

    def build_resolve_contract(self) -> BuildResolveContract:
        return BuildResolveContract.model_validate(self.context.trusted)
