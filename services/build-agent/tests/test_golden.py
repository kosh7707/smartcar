"""Golden test — output schema drift prevention.

Golden fixtures define the expected shape of API responses.  These tests
ensure that actual responses and Pydantic models stay in sync with the
golden fixtures, catching accidental schema drift early.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from agent_shared.schemas.agent import BudgetState
from app.core.agent_session import AgentSession
from app.core.result_assembler import ResultAssembler
from app.schemas.request import Context, EvidenceRef, TaskRequest
from app.schemas.response import TaskFailureResponse, TaskSuccessResponse
from app.types import TaskType

from tests.golden.schema_checker import check_schema

GOLDEN_DIR = Path(__file__).parent / "golden"


# ── helpers ─────────────────────────────────────────────────


def _load_golden(name: str) -> dict:
    return json.loads((GOLDEN_DIR / name).read_text())


def _make_session(termination_reason: str = "") -> AgentSession:
    req = TaskRequest(
        taskType=TaskType.BUILD_RESOLVE,
        taskId="golden-test-001",
        context=Context(trusted={"projectPath": "/tmp/test"}),
        evidenceRefs=[
            EvidenceRef(
                refId="ref-g01",
                artifactId="art-g01",
                artifactType="raw-source",
                locatorType="lineRange",
                locator={"file": "CMakeLists.txt", "fromLine": 1, "toLine": 50},
            ),
        ],
    )
    session = AgentSession(
        request=req,
        budget=BudgetState(
            max_steps=10,
            max_completion_tokens=20000,
            max_cheap_calls=20,
            max_medium_calls=5,
            max_expensive_calls=5,
            max_consecutive_no_evidence=6,
        ),
    )
    if termination_reason:
        session.set_termination_reason(termination_reason)
    return session


def _valid_build_json() -> str:
    return json.dumps({
        "summary": "CMake build succeeded",
        "claims": [
            {
                "statement": "CMake 3.10 project detected",
                "supportingEvidenceRefs": ["ref-g01"],
            }
        ],
        "caveats": [],
        "usedEvidenceRefs": ["ref-g01"],
        "needsHumanReview": False,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })


def _collect_schema_keys(schema: dict, prefix: str = "") -> set[str]:
    """Recursively collect dotted key paths from a JSON Schema."""
    keys: set[str] = set()
    props = schema.get("properties", {})
    for name, prop in props.items():
        full = f"{prefix}.{name}" if prefix else name
        keys.add(full)
        # Resolve $ref / $defs for nested objects
        resolved = _resolve_ref(prop, schema)
        if resolved.get("type") == "object" or "properties" in resolved:
            keys |= _collect_schema_keys(resolved, full)
    return keys


def _resolve_ref(prop: dict, root_schema: dict) -> dict:
    """Resolve a $ref in a JSON Schema against the root $defs."""
    ref = prop.get("$ref")
    if ref and ref.startswith("#/$defs/"):
        def_name = ref.split("/")[-1]
        return root_schema.get("$defs", {}).get(def_name, {})
    # allOf with single $ref
    all_of = prop.get("allOf")
    if all_of and len(all_of) == 1:
        return _resolve_ref(all_of[0], root_schema)
    return prop


def _collect_golden_keys(golden: dict, prefix: str = "") -> set[str]:
    """Recursively collect dotted key paths from a golden fixture."""
    keys: set[str] = set()
    for name, value in golden.items():
        full = f"{prefix}.{name}" if prefix else name
        keys.add(full)
        if isinstance(value, dict):
            keys |= _collect_golden_keys(value, full)
    return keys


# ── Tests ───────────────────────────────────────────────────


def test_golden_success_schema(client):
    """POST /v1/tasks 응답이 golden success fixture와 구조적으로 일치."""
    resp = client.post("/v1/tasks", json={
        "taskType": "build-resolve",
        "taskId": "golden-success-test",
        "context": {
            "trusted": {
                "projectPath": "/tmp/test",
            }
        },
    })
    assert resp.status_code == 200
    data = resp.json()

    # LLM이 없으면 model_error/budget_exceeded일 수 있음 — success만 golden 체크
    if data["status"] == "completed":
        golden = _load_golden("build_resolve_success.json")
        violations = check_schema(data, golden)
        assert violations == [], f"Schema violations: {violations}"
    else:
        # 실패 응답이면 failure golden으로 체크
        golden = _load_golden("build_resolve_failure.json")
        violations = check_schema(data, golden)
        assert violations == [], f"Schema violations: {violations}"


def test_golden_failure_schema():
    """ResultAssembler.build_from_exhaustion 결과가 golden failure fixture와 구조적으로 일치."""
    assembler = ResultAssembler()
    session = _make_session(termination_reason="max_steps")

    resp = assembler.build_from_exhaustion(session)
    assert isinstance(resp, TaskFailureResponse)

    data = resp.model_dump(mode="json")
    golden = _load_golden("build_resolve_failure.json")
    violations = check_schema(data, golden)
    assert violations == [], f"Schema violations: {violations}"


def test_golden_success_fixture_covers_model():
    """Golden success fixture의 모든 키가 Pydantic 모델에 존재."""
    golden = _load_golden("build_resolve_success.json")
    schema = TaskSuccessResponse.model_json_schema()

    golden_keys = _collect_golden_keys(golden)
    schema_keys = _collect_schema_keys(schema)

    missing = golden_keys - schema_keys
    assert missing == set(), (
        f"Golden fixture has keys not in Pydantic model: {missing}"
    )


def test_golden_failure_fixture_covers_model():
    """Golden failure fixture의 모든 키가 Pydantic 모델에 존재."""
    golden = _load_golden("build_resolve_failure.json")
    schema = TaskFailureResponse.model_json_schema()

    golden_keys = _collect_golden_keys(golden)
    schema_keys = _collect_schema_keys(schema)

    missing = golden_keys - schema_keys
    assert missing == set(), (
        f"Golden fixture has keys not in Pydantic model: {missing}"
    )
