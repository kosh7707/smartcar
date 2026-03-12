from pydantic import BaseModel, Field


class RuleResult(BaseModel):
    ruleId: str
    title: str
    severity: str
    location: str


class AnalyzeRequest(BaseModel):
    module: str
    sourceCode: str | None = None
    canLog: str | None = None
    testResults: str | None = None
    ruleResults: list[RuleResult] = []
    maxTokens: int = Field(2048, ge=1, le=8192)
    temperature: float = Field(0.7, ge=0.0, le=2.0)
