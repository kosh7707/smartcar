from pydantic import BaseModel


class VulnerabilityItem(BaseModel):
    severity: str
    title: str
    description: str
    location: str | None = None
    suggestion: str
    fixCode: str | None = None


class AnalyzeResponse(BaseModel):
    success: bool
    vulnerabilities: list[VulnerabilityItem] = []
    note: str | None = None
    error: str | None = None


class HealthResponse(BaseModel):
    service: str
    status: str
    version: str
    llmStatus: str
