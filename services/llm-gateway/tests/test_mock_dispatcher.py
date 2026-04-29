import asyncio
import json

from app.mock.dispatcher import V1MockDispatcher
from app.schemas.request import Constraints, Context, EvidenceRef, TaskRequest
from app.types import TaskType


def _make_request(
    task_type: TaskType,
    *,
    trusted: dict | None = None,
    untrusted: dict | None = None,
    evidence_refs: list[EvidenceRef] | None = None,
) -> TaskRequest:
    return TaskRequest(
        taskType=task_type,
        taskId="test-001",
        context=Context(
            trusted=trusted or {},
            untrusted=untrusted,
        ),
        evidenceRefs=evidence_refs or [],
        constraints=Constraints(
            enableThinking=True,
            maxTokens=2048,
            temperature=1.0,
            topP=0.95,
            topK=20,
            minP=0.0,
            presencePenalty=0.0,
            repetitionPenalty=1.0,
        ),
    )


def _ref(ref_id: str = "eref-001") -> EvidenceRef:
    return EvidenceRef(
        refId=ref_id,
        artifactId="art-1",
        artifactType="raw-source",
        locatorType="lineRange",
        locator={"file": "main.c", "fromLine": 1, "toLine": 5},
    )


def _dispatch(dispatcher, req):
    return asyncio.run(dispatcher.dispatch(req))


dispatcher = V1MockDispatcher()


def test_static_explain_basic():
    req = _make_request(
        TaskType.STATIC_EXPLAIN,
        trusted={"finding": {"ruleId": "CWE-120", "title": "Buffer Overflow", "severity": "critical", "location": "main.c:4"}},
        evidence_refs=[_ref()],
    )
    data = json.loads(_dispatch(dispatcher, req))

    assert data["summary"]
    assert len(data["claims"]) >= 1
    assert data["usedEvidenceRefs"] == ["eref-001"]
    assert data["suggestedSeverity"] == "critical"
    assert data["needsHumanReview"] is True


def test_static_explain_unsafe_function():
    req = _make_request(
        TaskType.STATIC_EXPLAIN,
        trusted={"finding": {"title": "gets usage", "severity": "high", "location": "main.c:4"}},
        untrusted={"sourceSnippet": "char buf[10]; gets(buf);"},
        evidence_refs=[_ref()],
    )
    data = json.loads(_dispatch(dispatcher, req))

    assert len(data["claims"]) >= 2
    assert any("문자열 처리 함수" in c["statement"] for c in data["claims"])


def test_static_explain_no_evidence():
    req = _make_request(
        TaskType.STATIC_EXPLAIN,
        trusted={"finding": {"title": "Test", "severity": "low", "location": "a.c:1"}},
    )
    data = json.loads(_dispatch(dispatcher, req))

    assert data["usedEvidenceRefs"] == []
    assert data["needsHumanReview"] is False


def test_dynamic_annotate_with_rules():
    req = _make_request(
        TaskType.DYNAMIC_ANNOTATE,
        trusted={"ruleMatches": [
            {"ruleId": "DYN-001", "title": "High freq", "severity": "high", "location": "CAN ID: 0x7DF"},
        ]},
        evidence_refs=[_ref("eref-can-001")],
    )
    data = json.loads(_dispatch(dispatcher, req))

    assert data["suggestedSeverity"] == "high"
    assert len(data["claims"]) == 1
    assert "0x7DF" in data["claims"][0]["statement"]


def test_dynamic_annotate_no_rules():
    req = _make_request(TaskType.DYNAMIC_ANNOTATE)
    data = json.loads(_dispatch(dispatcher, req))

    assert data["suggestedSeverity"] == "medium"
    assert len(data["claims"]) == 1


def test_test_plan_propose():
    req = _make_request(
        TaskType.TEST_PLAN_PROPOSE,
        trusted={
            "objective": "SecurityAccess lockout",
            "ecuCapability": {"supportedServices": ["0x27"]},
            "policyConstraints": {"maxAttempts": 5, "simulatorOnly": True, "rateLimit": "1/sec"},
        },
    )
    data = json.loads(_dispatch(dispatcher, req))

    assert "plan" in data
    plan = data["plan"]
    assert plan["objective"] == "SecurityAccess lockout"
    assert "0x27" in plan["targetServiceClass"]
    assert any("simulator" in sc for sc in plan["safetyConstraints"])
    assert plan["suggestedRiskLevel"] == "medium"


def test_static_cluster():
    req = _make_request(TaskType.STATIC_CLUSTER, evidence_refs=[_ref()])
    data = json.loads(_dispatch(dispatcher, req))

    assert "그룹핑" in data["summary"]
    assert data["usedEvidenceRefs"] == ["eref-001"]


def test_report_draft():
    req = _make_request(TaskType.REPORT_DRAFT, evidence_refs=[_ref()])
    data = json.loads(_dispatch(dispatcher, req))

    assert "보고서" in data["summary"]
    assert data["needsHumanReview"] is True


def test_all_responses_are_valid_json():
    """All task types should return parseable JSON with required assessment fields."""
    for task_type in TaskType:
        req = _make_request(task_type, trusted={"finding": {"title": "T", "severity": "low", "location": "a.c:1"}})
        data = json.loads(_dispatch(dispatcher, req))

        assert "summary" in data
        assert "claims" in data
        assert "caveats" in data
        assert "usedEvidenceRefs" in data
        assert "needsHumanReview" in data


def test_evidence_refs_not_hallucinated():
    """Mock should only use provided ref IDs, never invent new ones."""
    refs = [_ref("eref-A"), _ref("eref-B")]
    allowed = {"eref-A", "eref-B"}

    for task_type in TaskType:
        req = _make_request(task_type, evidence_refs=refs, trusted={"finding": {"title": "T", "severity": "low", "location": "a.c:1"}})
        data = json.loads(_dispatch(dispatcher, req))

        for ref_id in data.get("usedEvidenceRefs", []):
            assert ref_id in allowed, f"{task_type}: hallucinated ref {ref_id}"
        for claim in data.get("claims", []):
            for ref_id in claim.get("supportingEvidenceRefs", []):
                assert ref_id in allowed, f"{task_type}: hallucinated claim ref {ref_id}"
