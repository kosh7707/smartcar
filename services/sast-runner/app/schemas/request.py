from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class FileEntry(BaseModel):
    path: str
    content: str


class ScanOptions(BaseModel):
    timeout_seconds: int = Field(default=120, alias="timeoutSeconds")
    max_findings_per_rule: int = Field(default=50, alias="maxFindingsPerRule")

    model_config = {"populate_by_name": True}


# --- BuildProfile (mirrors docs/api/shared-models.md BuildProfile) ---

class BuildProfile(BaseModel):
    sdk_id: str = Field(alias="sdkId")
    compiler: str
    compiler_version: str | None = Field(default=None, alias="compilerVersion")
    target_arch: str = Field(alias="targetArch")
    language_standard: str = Field(alias="languageStandard")
    header_language: Literal["c", "cpp", "auto"] = Field(alias="headerLanguage")
    include_paths: list[str] | None = Field(default=None, alias="includePaths")
    defines: dict[str, str] | None = None
    flags: list[str] | None = None

    model_config = {"populate_by_name": True}


class ScanRequest(BaseModel):
    scan_id: str = Field(alias="scanId")
    project_id: str = Field(alias="projectId")
    files: list[FileEntry] = []
    project_path: str | None = Field(default=None, alias="projectPath")
    compile_commands: str | None = Field(default=None, alias="compileCommands")
    build_profile: BuildProfile | None = Field(default=None, alias="buildProfile")
    rulesets: list[str] | None = None
    options: ScanOptions = Field(default_factory=ScanOptions)

    model_config = {"populate_by_name": True}
