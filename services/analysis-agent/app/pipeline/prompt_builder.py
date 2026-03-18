from __future__ import annotations

import json
from string import Template

from app.registry.prompt_registry import PromptEntry
from app.schemas.request import TaskRequest


class V1PromptBuilder:
    """TaskRequest + PromptEntry → LLM 메시지 리스트를 조립한다.

    3계층 프롬프트 구성:
    - system: policy + output schema (trusted)
    - user 상단: structured context (trusted / semi-trusted)
    - user 하단: untrusted evidence (delimiter로 격리)
    """

    def build(
        self,
        request: TaskRequest,
        prompt_entry: PromptEntry,
        threat_context: str = "",
    ) -> list[dict[str, str]]:
        system_content = prompt_entry.systemTemplate

        evidence_refs_list = self._format_evidence_refs(request)
        trusted_context = self._format_dict(request.context.trusted)
        semi_trusted_context = self._format_dict(
            request.context.semiTrusted or {},
        )
        untrusted_content = self._format_dict(
            request.context.untrusted or {},
        )

        finding_json = ""
        if request.context.trusted.get("finding"):
            finding_json = json.dumps(
                request.context.trusted["finding"],
                ensure_ascii=False,
                indent=2,
            )
        elif request.context.trusted.get("ruleMatches"):
            # S2가 ruleMatches 배열로 보낸 경우 finding_json 대체
            finding_json = json.dumps(
                request.context.trusted["ruleMatches"],
                ensure_ascii=False,
                indent=2,
            )

        build_profile_context = self._format_build_profile(request)

        user_template = Template(prompt_entry.userTemplate)
        user_content = user_template.safe_substitute(
            finding_json=finding_json or trusted_context,
            evidence_refs_list=evidence_refs_list,
            trusted_context=trusted_context,
            semi_trusted_context=semi_trusted_context,
            untrusted_content=untrusted_content or "(없음)",
            threat_knowledge_context=threat_context or "(해당 없음)",
            build_profile_context=build_profile_context,
        )

        return [
            {"role": "system", "content": system_content},
            {"role": "user", "content": user_content},
        ]

    def _format_evidence_refs(self, request: TaskRequest) -> str:
        if not request.evidenceRefs:
            return "(없음)"
        lines = []
        for ref in request.evidenceRefs:
            label = ref.label or ref.artifactType
            lines.append(f"- {ref.refId}: {label} ({ref.artifactType}, {ref.locatorType})")
        return "\n".join(lines)

    def _format_build_profile(self, request: TaskRequest) -> str:
        bp = request.context.trusted.get("buildProfile")
        if not bp or not isinstance(bp, dict):
            return ""
        parts = []
        if bp.get("targetArch"):
            parts.append(f"Target: {bp['targetArch']}")
        if bp.get("compiler"):
            parts.append(f"Compiler: {bp['compiler']}")
        if bp.get("languageStandard"):
            parts.append(f"Standard: {bp['languageStandard']}")
        return " | ".join(parts) if parts else ""

    def _format_dict(self, d: dict) -> str:
        if not d:
            return "(없음)"
        return json.dumps(d, ensure_ascii=False, indent=2)
