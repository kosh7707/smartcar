"""POST /v1/tasks 성공 응답 구조 계약 테스트.

mock dispatcher를 통과한 실제 성공 응답의 JSON 구조를
API 계약서(llm-gateway-api.md)와 대조한다.
"""

import uuid
from datetime import datetime

from tests.conftest import ALL_TASK_TYPES, make_task_body, make_test_plan_body


class TestSuccessTopLevel:
    """성공 응답의 최상위 필드 검증."""

    def test_success_top_level_fields(self, client_live):
        resp = client_live.post("/v1/tasks", json=make_task_body())
        assert resp.status_code == 200
        data = resp.json()
        for field in ("taskId", "taskType", "status", "modelProfile",
                      "promptVersion", "schemaVersion", "validation",
                      "result", "audit"):
            assert field in data, f"missing top-level field: {field}"

    def test_success_status_completed(self, client_live):
        data = client_live.post("/v1/tasks", json=make_task_body()).json()
        assert data["status"] == "completed"

    def test_success_taskid_echoed(self, client_live):
        body = make_task_body(task_id="echo-check-42")
        data = client_live.post("/v1/tasks", json=body).json()
        assert data["taskId"] == "echo-check-42"


class TestSuccessResult:
    """result(AssessmentResult) 내부 필드 검증."""

    def test_result_assessment_fields(self, client_live):
        data = client_live.post("/v1/tasks", json=make_task_body()).json()
        result = data["result"]
        for field in ("summary", "claims", "caveats", "usedEvidenceRefs",
                      "suggestedSeverity", "confidence",
                      "confidenceBreakdown", "needsHumanReview",
                      "recommendedNextSteps", "policyFlags"):
            assert field in result, f"missing result field: {field}"

    def test_claim_structure(self, client_live):
        data = client_live.post("/v1/tasks", json=make_task_body()).json()
        claims = data["result"]["claims"]
        assert isinstance(claims, list)
        if claims:
            claim = claims[0]
            assert isinstance(claim["statement"], str)
            assert isinstance(claim["supportingEvidenceRefs"], list)
            assert "location" in claim  # null 허용

    def test_claim_location_field_exists(self, client_live):
        data = client_live.post("/v1/tasks", json=make_task_body()).json()
        for claim in data["result"]["claims"]:
            assert "location" in claim, "claim must have 'location' key (null ok)"


class TestConfidenceBreakdown:
    """confidence/confidenceBreakdown 검증."""

    def test_confidence_breakdown_four_fields(self, client_live):
        data = client_live.post("/v1/tasks", json=make_task_body()).json()
        bd = data["result"]["confidenceBreakdown"]
        for field in ("grounding", "deterministicSupport",
                      "ragCoverage", "schemaCompliance"):
            assert field in bd, f"missing breakdown field: {field}"

    def test_confidence_breakdown_range(self, client_live):
        data = client_live.post("/v1/tasks", json=make_task_body()).json()
        bd = data["result"]["confidenceBreakdown"]
        for key in ("grounding", "deterministicSupport",
                    "ragCoverage", "schemaCompliance"):
            assert 0.0 <= bd[key] <= 1.0, f"{key}={bd[key]} out of [0,1]"

    def test_confidence_weighted_average(self, client_live):
        data = client_live.post("/v1/tasks", json=make_task_body()).json()
        bd = data["result"]["confidenceBreakdown"]
        expected = (
            0.45 * bd["grounding"]
            + 0.30 * bd["deterministicSupport"]
            + 0.15 * bd["ragCoverage"]
            + 0.10 * bd["schemaCompliance"]
        )
        assert abs(data["result"]["confidence"] - expected) < 0.01


class TestValidation:
    def test_validation_structure(self, client_live):
        data = client_live.post("/v1/tasks", json=make_task_body()).json()
        v = data["validation"]
        assert isinstance(v["valid"], bool)
        assert isinstance(v["errors"], list)


class TestAudit:
    """audit 필드 검증."""

    def test_audit_required_fields(self, client_live):
        data = client_live.post("/v1/tasks", json=make_task_body()).json()
        audit = data["audit"]
        for field in ("inputHash", "latencyMs", "tokenUsage",
                      "retryCount", "ragHits", "createdAt"):
            assert field in audit, f"missing audit field: {field}"

    def test_audit_input_hash_format(self, client_live):
        data = client_live.post("/v1/tasks", json=make_task_body()).json()
        h = data["audit"]["inputHash"]
        assert h.startswith("sha256:"), f"inputHash must start with 'sha256:': {h}"
        hex_part = h[len("sha256:"):]
        assert len(hex_part) == 16, f"hex part should be 16 chars: {hex_part}"
        int(hex_part, 16)  # should not raise

    def test_audit_created_at_iso8601(self, client_live):
        data = client_live.post("/v1/tasks", json=make_task_body()).json()
        ts = data["audit"]["createdAt"]
        datetime.fromisoformat(ts)  # should not raise

    def test_audit_latency_positive(self, client_live):
        data = client_live.post("/v1/tasks", json=make_task_body()).json()
        assert data["audit"]["latencyMs"] >= 0


class TestTestPlan:
    def test_test_plan_has_plan_field(self, client_live):
        data = client_live.post("/v1/tasks", json=make_test_plan_body()).json()
        assert data["status"] == "completed"
        plan = data["result"]["plan"]
        assert plan is not None
        for field in ("objective", "hypotheses", "preconditions",
                      "dataToCollect", "stopConditions", "safetyConstraints"):
            assert field in plan, f"missing plan field: {field}"


class TestRequestIdAndTaskTypes:
    def test_x_request_id_propagated(self, client_live):
        rid = f"test-{uuid.uuid4()}"
        resp = client_live.post(
            "/v1/tasks",
            json=make_task_body(),
            headers={"X-Request-Id": rid},
        )
        assert resp.headers.get("x-request-id") == rid

    def test_all_five_task_types_succeed(self, client_live):
        for task_type in ALL_TASK_TYPES:
            if task_type == "test-plan-propose":
                body = make_test_plan_body(task_id=f"tt-{task_type}")
            else:
                body = make_task_body(task_type=task_type, task_id=f"tt-{task_type}")
            resp = client_live.post("/v1/tasks", json=body)
            data = resp.json()
            assert resp.status_code == 200, f"{task_type}: status={resp.status_code}"
            assert data["status"] == "completed", f"{task_type}: {data.get('status')}"
