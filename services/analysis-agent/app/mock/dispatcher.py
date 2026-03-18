"""Mock Dispatcher — taskType enum 기반 Assessment JSON 생성."""

from __future__ import annotations

import json

from app.schemas.request import TaskRequest
from app.types import TaskType


class V1MockDispatcher:
    """taskType별로 mock Assessment JSON을 생성한다."""

    async def dispatch(self, request: TaskRequest) -> str:
        dispatchers = {
            TaskType.STATIC_EXPLAIN: self._static_explain,
            TaskType.STATIC_CLUSTER: self._static_cluster,
            TaskType.DYNAMIC_ANNOTATE: self._dynamic_annotate,
            TaskType.TEST_PLAN_PROPOSE: self._test_plan_propose,
            TaskType.REPORT_DRAFT: self._report_draft,
        }
        handler = dispatchers.get(request.taskType, self._stub)
        return handler(request)

    def _static_explain(self, request: TaskRequest) -> str:
        ref_ids = [ref.refId for ref in request.evidenceRefs]
        finding = request.context.trusted.get("finding", {})
        title = finding.get("title", "Unknown Finding")
        severity = finding.get("severity", "medium")
        location = finding.get("location", "unknown")
        rule_id = finding.get("ruleId", "")

        source_snippet = ""
        if request.context.untrusted:
            source_snippet = request.context.untrusted.get("sourceSnippet", "")

        claims = []
        claim_text = (
            f"{location}에서 탐지된 '{title}' 항목에 대한 심층 분석입니다. "
            "해당 패턴은 보안 취약점으로 이어질 수 있으며, "
            "ECU 환경에서는 메모리 보호 기능의 부재로 인해 "
            "공격 영향이 더 심각할 수 있습니다."
        )
        claims.append({
            "statement": claim_text,
            "supportingEvidenceRefs": ref_ids[:1] if ref_ids else [],
        })

        if source_snippet and any(
            kw in source_snippet
            for kw in ("gets", "strcpy", "sprintf", "strcat")
        ):
            claims.append({
                "statement": (
                    "소스코드에서 안전하지 않은 문자열 처리 함수가 확인되었습니다. "
                    "입력 길이 검증 없이 복사 연산이 수행되어 버퍼 오버플로우가 발생할 수 있습니다."
                ),
                "supportingEvidenceRefs": ref_ids[:1] if ref_ids else [],
            })

        return json.dumps({
            "summary": (
                f"{location}에서 '{title}' 취약점이 탐지되었습니다. "
                f"심각도는 {severity}로 평가됩니다."
            ),
            "claims": claims,
            "caveats": [
                "시뮬레이터 환경에서의 분석이므로 실 ECU 메모리 레이아웃에 따라 영향이 다를 수 있습니다.",
                "정적 분석만으로는 exploitability를 완전히 입증할 수 없습니다.",
            ],
            "usedEvidenceRefs": ref_ids,
            "suggestedSeverity": severity,
            "needsHumanReview": severity in ("critical", "high"),
            "recommendedNextSteps": [
                "안전한 대안 함수로 교체 후 regression test 수행",
                "MISRA C / CERT C 코딩 표준 기반 수동 코드 리뷰 권장",
            ],
        }, ensure_ascii=False)

    def _dynamic_annotate(self, request: TaskRequest) -> str:
        ref_ids = [ref.refId for ref in request.evidenceRefs]
        rule_matches = request.context.trusted.get("ruleMatches", [])

        claims = []
        for match in rule_matches:
            claims.append({
                "statement": (
                    f"{match.get('location', 'CAN Bus')}에서 "
                    f"'{match.get('title', 'Unknown')}' 패턴이 감지되었습니다. "
                    "이는 비정상 트래픽 패턴과 일치합니다."
                ),
                "supportingEvidenceRefs": ref_ids[:1] if ref_ids else [],
            })

        if not claims:
            claims.append({
                "statement": "제공된 이벤트 데이터에서 비정상 패턴이 관찰되었습니다.",
                "supportingEvidenceRefs": ref_ids[:1] if ref_ids else [],
            })

        return json.dumps({
            "summary": (
                f"동적 분석 이벤트 {len(rule_matches)}건에 대한 해석입니다. "
                "CAN 버스 트래픽에서 비정상 패턴이 감지되었습니다."
            ),
            "claims": claims,
            "caveats": [
                "캡처 윈도우가 제한적이므로 전체 공격 패턴을 파악하지 못할 수 있습니다.",
                "정상 트래픽 베이스라인이 없어 정확한 편차 판단에 한계가 있습니다.",
            ],
            "usedEvidenceRefs": ref_ids,
            "suggestedSeverity": "high" if rule_matches else "medium",
            "needsHumanReview": True,
            "recommendedNextSteps": [
                "정상 트래픽 베이스라인 수립 후 비교 분석 수행",
                "IDS/IPS 룰 업데이트 검토",
            ],
        }, ensure_ascii=False)

    def _test_plan_propose(self, request: TaskRequest) -> str:
        ref_ids = [ref.refId for ref in request.evidenceRefs]
        objective = request.context.trusted.get("objective", "보안 테스트")
        ecu_cap = request.context.trusted.get("ecuCapability", {})
        policy = request.context.trusted.get("policyConstraints", {})

        return json.dumps({
            "summary": f"'{objective}'에 대한 테스트 시나리오 초안입니다.",
            "claims": [],
            "caveats": [
                "시뮬레이터 환경 전용 계획이므로 실 ECU 적용 시 추가 검토가 필요합니다.",
                "제안된 시나리오는 승인 후에만 실행 가능합니다.",
            ],
            "usedEvidenceRefs": ref_ids,
            "suggestedSeverity": None,
            "needsHumanReview": True,
            "recommendedNextSteps": [
                "테스트 계획 승인 절차 진행",
                "실행 환경 준비 확인",
            ],
            "plan": {
                "objective": objective,
                "hypotheses": [
                    f"{objective} 관련 ECU 동작이 보안 요구사항을 충족하는지 검증",
                ],
                "targetProtocol": "UDS",
                "targetServiceClass": ", ".join(
                    ecu_cap.get("supportedServices", ["Unknown"]),
                ),
                "preconditions": [
                    "시뮬레이터 환경 활성화",
                    "진단 세션 수립",
                ],
                "dataToCollect": [
                    "NRC 응답 코드 시퀀스",
                    "응답 latency 변화",
                    "ECU 상태 변화",
                ],
                "stopConditions": [
                    "ECU 비응답 발생",
                    f"maxAttempts({policy.get('maxAttempts', 10)}) 도달",
                ],
                "safetyConstraints": [
                    "simulator-only" if policy.get("simulatorOnly") else "lab-only",
                    f"rateLimit: {policy.get('rateLimit', 'N/A')}",
                ],
                "suggestedExecutorTemplateIds": [
                    "uds-generic-probe",
                ],
                "suggestedRiskLevel": "medium",
            },
        }, ensure_ascii=False)

    def _static_cluster(self, request: TaskRequest) -> str:
        ref_ids = [ref.refId for ref in request.evidenceRefs]
        return json.dumps({
            "summary": "유사 finding 그룹핑 분석 결과입니다.",
            "claims": [
                {
                    "statement": "제공된 finding 목록에서 유사한 패턴을 식별했습니다.",
                    "supportingEvidenceRefs": ref_ids[:1] if ref_ids else [],
                },
            ],
            "caveats": [
                "finding 간 정확한 중복 여부는 소스코드 수준의 비교가 필요합니다.",
            ],
            "usedEvidenceRefs": ref_ids,
            "suggestedSeverity": None,
            "needsHumanReview": True,
            "recommendedNextSteps": [
                "그룹별 대표 finding 선정 후 심층 분석 수행",
            ],
        }, ensure_ascii=False)

    def _report_draft(self, request: TaskRequest) -> str:
        ref_ids = [ref.refId for ref in request.evidenceRefs]
        return json.dumps({
            "summary": "보고서 초안이 생성되었습니다.",
            "claims": [
                {
                    "statement": "제공된 확정 finding과 evidence를 기반으로 보고서를 구성했습니다.",
                    "supportingEvidenceRefs": ref_ids[:1] if ref_ids else [],
                },
            ],
            "caveats": [
                "자동 생성 초안이므로 전문가 검토 및 수정이 필요합니다.",
            ],
            "usedEvidenceRefs": ref_ids,
            "suggestedSeverity": None,
            "needsHumanReview": True,
            "recommendedNextSteps": [
                "보고서 검토 및 승인 절차 진행",
            ],
        }, ensure_ascii=False)

    def _stub(self, request: TaskRequest) -> str:
        return json.dumps({
            "summary": f"'{request.taskType}' 타입은 아직 구현되지 않았습니다.",
            "claims": [],
            "caveats": ["이 응답은 stub입니다."],
            "usedEvidenceRefs": [],
            "suggestedSeverity": None,
            "needsHumanReview": True,
            "recommendedNextSteps": [],
        }, ensure_ascii=False)
