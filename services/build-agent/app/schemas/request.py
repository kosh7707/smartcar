from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator, model_validator

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
    BUILD_RESOLVE_V1 = "build-resolve-v1"


class ExpectedArtifactType(StrEnum):
    EXECUTABLE = "executable"
    SHARED_LIBRARY = "shared-library"
    STATIC_LIBRARY = "static-library"
    DIRECTORY = "directory"
    FILE_SET = "file-set"
    NAMED_OUTPUT_SET = "named-output-set"


class ExpectedArtifact(BaseModel):
    artifactType: ExpectedArtifactType = Field(
        validation_alias=AliasChoices("artifactType", "kind", "type"),
    )
    path: str | None = None
    name: str | None = None
    required: bool = True
    notes: str | None = None

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
    buildTargetPath: str | None = None
    buildTargetName: str | None = None
    targetPath: str | None = None
    targetName: str | None = None
    buildMode: BuildMode | None = None
    sdkId: str | None = None
    setupScript: str | None = None
    toolchainTriplet: str | None = None
    buildEnvironment: dict[str, str] = Field(default_factory=dict)
    buildScriptHintText: str | None = Field(default=None, max_length=20000)
    expectedArtifacts: list[ExpectedArtifact] = Field(default_factory=list)
    contractVersion: ContractVersion | None = None
    strictMode: bool | None = None

    @model_validator(mode="before")
    @classmethod
    def _normalize_input_payload(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value

        normalized = dict(value)
        build_blob = normalized.get("build")
        if not isinstance(build_blob, dict):
            build_blob = {}

        if normalized.get("buildTargetPath") is None and normalized.get("targetPath") is not None:
            normalized["buildTargetPath"] = normalized.get("targetPath")
        if normalized.get("buildTargetName") is None and normalized.get("targetName") is not None:
            normalized["buildTargetName"] = normalized.get("targetName")

        if normalized.get("buildMode") is None and build_blob.get("mode") is not None:
            normalized["buildMode"] = build_blob.get("mode")
        if normalized.get("sdkId") is None and build_blob.get("sdkId") is not None:
            normalized["sdkId"] = build_blob.get("sdkId")
        if normalized.get("setupScript") is None and build_blob.get("setupScript") is not None:
            normalized["setupScript"] = build_blob.get("setupScript")
        if normalized.get("toolchainTriplet") is None and build_blob.get("toolchainTriplet") is not None:
            normalized["toolchainTriplet"] = build_blob.get("toolchainTriplet")
        if normalized.get("buildEnvironment") in (None, {}) and build_blob.get("environment") is not None:
            normalized["buildEnvironment"] = build_blob.get("environment")
        if normalized.get("buildScriptHintText") is None:
            hint_value = build_blob.get("scriptHintText")
            if hint_value is None:
                hint_value = build_blob.get("scriptHint")
            if hint_value is None:
                hint_value = normalized.get("buildScriptHint")
            if hint_value is not None:
                normalized["buildScriptHintText"] = hint_value

        expected = normalized.get("expectedArtifacts")
        if isinstance(expected, list):
            normalized_items: list[Any] = []
            for item in expected:
                if isinstance(item, dict) and "artifactType" not in item:
                    candidate = dict(item)
                    if "kind" in candidate:
                        candidate["artifactType"] = candidate["kind"]
                    elif "type" in candidate:
                        candidate["artifactType"] = candidate["type"]
                    normalized_items.append(candidate)
                else:
                    normalized_items.append(item)
            normalized["expectedArtifacts"] = normalized_items

        return normalized

    @field_validator(
        "projectPath",
        "buildTargetPath",
        "buildTargetName",
        "targetPath",
        "targetName",
        "sdkId",
        "setupScript",
        "toolchainTriplet",
        "buildScriptHintText",
        mode="before",
    )
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
            "build-resolve-v1": ContractVersion.BUILD_RESOLVE_V1,
            "compile-first-v1": ContractVersion.BUILD_RESOLVE_V1,
            "v1": ContractVersion.BUILD_RESOLVE_V1,
            "strict-v1": ContractVersion.BUILD_RESOLVE_V1,
        }
        contract_version = aliases.get(normalized)
        if contract_version is None:
            raise ValueError(
                "contractVersion must be one of legacy, v0, build-resolve-v1, compile-first-v1, v1, or strict-v1",
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

    @field_validator("buildEnvironment", mode="before")
    @classmethod
    def _normalize_build_environment(cls, value: Any) -> dict[str, str]:
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise ValueError("buildEnvironment must be an object mapping environment keys to strings")

        normalized: dict[str, str] = {}
        for raw_key, raw_val in value.items():
            if not isinstance(raw_key, str):
                raise ValueError("buildEnvironment keys must be strings")
            key = raw_key.strip()
            if not key:
                raise ValueError("buildEnvironment keys must not be empty")
            if not isinstance(raw_val, str):
                raise ValueError(f"buildEnvironment['{key}'] must be a string")
            normalized[key] = raw_val
        return normalized

    @model_validator(mode="after")
    def _normalize_contract(self) -> "BuildResolveContract":
        if self.strictMode is True and self.contractVersion in (None, ContractVersion.LEGACY):
            self.contractVersion = ContractVersion.BUILD_RESOLVE_V1
        elif self.strictMode is False and self.contractVersion == ContractVersion.BUILD_RESOLVE_V1:
            raise ValueError("strictMode=false conflicts with contractVersion=build-resolve-v1")
        elif self.strictMode is None:
            self.strictMode = self.contractVersion == ContractVersion.BUILD_RESOLVE_V1

        if self.contractVersion is None:
            self.contractVersion = (
                ContractVersion.BUILD_RESOLVE_V1 if self.strictMode else ContractVersion.LEGACY
            )

        if self.buildTargetPath is None and self.targetPath is not None:
            self.buildTargetPath = self.targetPath
        if self.buildTargetName is None and self.targetName is not None:
            self.buildTargetName = self.targetName
        if self.targetPath is None and self.buildTargetPath is not None:
            self.targetPath = self.buildTargetPath
        if self.targetName is None and self.buildTargetName is not None:
            self.targetName = self.buildTargetName

        if self.buildMode == BuildMode.SDK and not self.sdkId:
            raise ValueError("sdkId is required when buildMode is 'sdk'")
        if self.buildMode == BuildMode.SDK and not (
            self.setupScript or self.buildEnvironment or self.buildScriptHintText
        ):
            raise ValueError(
                "sdk builds require at least one materialization source: "
                "setupScript, buildEnvironment, or buildScriptHintText",
            )
        if self.buildMode == BuildMode.NATIVE and self.sdkId:
            raise ValueError("sdkId must be omitted when buildMode is 'native'")

        return self

class TaskRequest(BaseModel):
    taskType: TaskType
    taskId: str
    contractVersion: ContractVersion | None = None
    strictMode: bool | None = None
    context: Context
    evidenceRefs: list[EvidenceRef] = Field(default_factory=list)
    constraints: Constraints = Field(default_factory=Constraints)
    metadata: dict | None = None

    def build_resolve_contract(self) -> BuildResolveContract:
        trusted = dict(self.context.trusted)
        if self.contractVersion is not None and trusted.get("contractVersion") is None:
            trusted["contractVersion"] = self.contractVersion
        if self.strictMode is not None and trusted.get("strictMode") is None:
            trusted["strictMode"] = self.strictMode
        return BuildResolveContract.model_validate(trusted)
