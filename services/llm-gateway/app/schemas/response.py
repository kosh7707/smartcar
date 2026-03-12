from pydantic import BaseModel


class VulnerabilityItem(BaseModel):
    severity: str
    title: str
    description: str
    location: str | None = None
    suggestion: str
    fixCode: str | None = None


class ErrorDetail(BaseModel):
    code: str
    message: str
    requestId: str | None = None
    retryable: bool = False


class AnalyzeResponse(BaseModel):
    success: bool
    vulnerabilities: list[VulnerabilityItem] = []
    note: str | None = None
    error: str | None = None
    errorDetail: ErrorDetail | None = None


class HealthResponse(BaseModel):
    service: str
    status: str
    version: str
    llmStatus: str
