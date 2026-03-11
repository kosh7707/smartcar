from pydantic import BaseModel


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
    maxTokens: int = 2048
    temperature: float = 0.7
