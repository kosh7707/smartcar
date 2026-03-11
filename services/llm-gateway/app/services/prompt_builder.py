from app.schemas.request import AnalyzeRequest
from app.templates import static_analysis, dynamic_analysis, dynamic_testing


class PromptBuilder:

    def build(self, request: AnalyzeRequest) -> list[dict[str, str]]:
        builders = {
            "static_analysis": self._build_static,
            "dynamic_analysis": self._build_dynamic,
            "dynamic_testing": self._build_testing,
        }
        builder = builders.get(request.module)
        if not builder:
            raise ValueError(f"Unknown module: {request.module}")
        return builder(request)

    def _format_rules(self, rule_results) -> str:
        if not rule_results:
            return "없음"
        lines = []
        for r in rule_results:
            lines.append(f"- {r.ruleId}: {r.title} [{r.severity}] ({r.location})")
        return "\n".join(lines)

    def _build_static(self, req: AnalyzeRequest) -> list[dict[str, str]]:
        return [
            {"role": "system", "content": static_analysis.SYSTEM_PROMPT},
            {"role": "user", "content": static_analysis.USER_TEMPLATE.safe_substitute(
                rule_results=self._format_rules(req.ruleResults),
                source_code=req.sourceCode or "(소스코드 없음)",
            )},
        ]

    def _build_dynamic(self, req: AnalyzeRequest) -> list[dict[str, str]]:
        return [
            {"role": "system", "content": dynamic_analysis.SYSTEM_PROMPT},
            {"role": "user", "content": dynamic_analysis.USER_TEMPLATE.safe_substitute(
                rule_results=self._format_rules(req.ruleResults),
                can_log=req.canLog or "(CAN 로그 없음)",
            )},
        ]

    def _build_testing(self, req: AnalyzeRequest) -> list[dict[str, str]]:
        return [
            {"role": "system", "content": dynamic_testing.SYSTEM_PROMPT},
            {"role": "user", "content": dynamic_testing.USER_TEMPLATE.safe_substitute(
                rule_results=self._format_rules(req.ruleResults),
                test_results=req.testResults or "(테스트 결과 없음)",
            )},
        ]
