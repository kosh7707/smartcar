from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


# --- ExecutionReport (typed schema for scan execution metadata) ---


class ToolExecutionResult(BaseModel):
    """개별 도구 실행 결과."""
    status: Literal["ok", "failed", "skipped"]
    findings_count: int = Field(alias="findingsCount")
    elapsed_ms: int = Field(alias="elapsedMs")
    skip_reason: str | None = Field(default=None, alias="skipReason")
    version: str | None = None

    model_config = {"populate_by_name": True, "by_alias": True}


class SdkResolutionInfo(BaseModel):
    """SDK 경로 해석 결과."""
    resolved: bool
    sdk_id: str | None = Field(default=None, alias="sdkId")
    include_paths_added: int = Field(default=0, alias="includePathsAdded")

    model_config = {"populate_by_name": True, "by_alias": True}


class FindingsFilterInfo(BaseModel):
    """SDK/외부 노이즈 필터링 + scope-early 결과."""
    before_filter: int = Field(alias="beforeFilter")
    after_filter: int = Field(alias="afterFilter")
    sdk_noise_removed: int = Field(default=0, alias="sdkNoiseRemoved")
    third_party_removed: int = Field(default=0, alias="thirdPartyRemoved")
    cross_boundary_kept: int = Field(default=0, alias="crossBoundaryKept")
    files_scoped_out: int = Field(default=0, alias="filesScopedOut")

    model_config = {"populate_by_name": True, "by_alias": True}


class ExecutionReport(BaseModel):
    """SAST 스캔 실행 보고서 — 도구별 상태, SDK 해석, 필터링 결과."""
    tools_run: list[str] = Field(alias="toolsRun")
    tool_results: dict[str, ToolExecutionResult] = Field(alias="toolResults")
    sdk: SdkResolutionInfo
    filtering: FindingsFilterInfo

    model_config = {"populate_by_name": True, "by_alias": True}


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
    origin: str | None = None
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
    execution: ExecutionReport | None = None
    code_graph: dict[str, Any] | None = Field(default=None, alias="codeGraph")
    sca: dict[str, Any] | None = None
    error: str | None = None
    error_detail: ErrorDetail | None = Field(default=None, alias="errorDetail")

    model_config = {"populate_by_name": True, "by_alias": True}


class HealthResponse(BaseModel):
    service: str = "s4-sast"
    status: str = "ok"
    version: str = "0.7.0"
    semgrep: dict[str, Any] = {}
    tools: dict[str, Any] = {}
    default_rulesets: list[str] = Field(default_factory=list, alias="defaultRulesets")

    model_config = {"populate_by_name": True, "by_alias": True}
