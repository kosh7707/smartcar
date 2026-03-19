from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


# --- SastFinding (mirrors docs/api/shared-models.md:253-289 exactly) ---

class SastFindingLocation(BaseModel):
    file: str
    line: int
    column: int | None = None
    end_line: int | None = Field(default=None, alias="endLine")
    end_column: int | None = Field(default=None, alias="endColumn")

    model_config = {"populate_by_name": True, "by_alias": True}


class SastDataFlowStep(BaseModel):
    file: str
    line: int
    content: str | None = None

    model_config = {"by_alias": True}


class SastFinding(BaseModel):
    tool_id: str = Field(alias="toolId")
    rule_id: str = Field(alias="ruleId")
    severity: str
    message: str
    location: SastFindingLocation
    data_flow: list[SastDataFlowStep] | None = Field(default=None, alias="dataFlow")
    metadata: dict[str, Any] | None = None

    model_config = {"populate_by_name": True, "by_alias": True}


# --- Scan response ---

class ScanStats(BaseModel):
    files_scanned: int = Field(alias="filesScanned")
    rules_run: int = Field(alias="rulesRun")
    findings_total: int = Field(alias="findingsTotal")
    elapsed_ms: int = Field(alias="elapsedMs")

    model_config = {"populate_by_name": True, "by_alias": True}


class ErrorDetail(BaseModel):
    code: str
    message: str
    request_id: str | None = Field(default=None, alias="requestId")
    retryable: bool = False

    model_config = {"populate_by_name": True, "by_alias": True}


class ScanResponse(BaseModel):
    success: bool
    scan_id: str = Field(alias="scanId")
    status: str
    findings: list[SastFinding] | None = None
    stats: ScanStats | None = None
    execution: dict[str, Any] | None = None
    error: str | None = None
    error_detail: ErrorDetail | None = Field(default=None, alias="errorDetail")

    model_config = {"populate_by_name": True, "by_alias": True}


class HealthResponse(BaseModel):
    service: str = "s4-sast-runner"
    status: str = "ok"
    version: str = "0.4.0"
    semgrep: dict[str, Any] = {}
    tools: dict[str, Any] = {}
    default_rulesets: list[str] = Field(default_factory=list, alias="defaultRulesets")

    model_config = {"populate_by_name": True, "by_alias": True}
