import json

from app.pipeline.prompt_builder import V1PromptBuilder
from app.registry.prompt_registry import PromptEntry
from app.schemas.request import Context, EvidenceRef, TaskRequest
from app.types import TaskType


def _make_request(
    *,
    trusted: dict | None = None,
    semi_trusted: dict | None = None,
    untrusted: dict | None = None,
    evidence_refs: list[EvidenceRef] | None = None,
) -> TaskRequest:
    return TaskRequest(
        taskType=TaskType.STATIC_EXPLAIN,
        taskId="test-001",
        context=Context(
            trusted=trusted or {},
            semiTrusted=semi_trusted,
            untrusted=untrusted,
        ),
        evidenceRefs=evidence_refs or [],
    )


def _make_prompt_entry() -> PromptEntry:
    return PromptEntry(
        promptId="test-prompt",
        version="v1",
        taskType=TaskType.STATIC_EXPLAIN,
        description="test",
        systemTemplate="You are a security expert.\n/no_think",
        userTemplate="""\
[Finding]
${finding_json}

[Evidence]
${evidence_refs_list}

[Context]
${trusted_context}

[Semi-trusted]
${semi_trusted_context}

BEGIN_UNTRUSTED_EVIDENCE
${untrusted_content}
END_UNTRUSTED_EVIDENCE""",
    )


def _ref(ref_id: str = "eref-001", label: str | None = None) -> EvidenceRef:
    return EvidenceRef(
        refId=ref_id,
        artifactId="art-1",
        artifactType="raw-source",
        locatorType="lineRange",
        locator={"file": "main.c", "fromLine": 1, "toLine": 5},
        label=label,
    )


builder = V1PromptBuilder()
entry = _make_prompt_entry()


def test_returns_system_and_user_messages():
    req = _make_request()
    messages = builder.build(req, entry)

    assert len(messages) == 2
    assert messages[0]["role"] == "system"
    assert messages[1]["role"] == "user"


def test_system_message_is_template():
    req = _make_request()
    messages = builder.build(req, entry)

    assert messages[0]["content"] == "You are a security expert.\n/no_think"


def test_finding_json_substituted():
    finding = {"ruleId": "CWE-120", "title": "Buffer Overflow", "severity": "critical"}
    req = _make_request(trusted={"finding": finding})
    messages = builder.build(req, entry)
    user = messages[1]["content"]

    assert '"CWE-120"' in user
    assert '"Buffer Overflow"' in user


def test_trusted_context_without_finding():
    req = _make_request(trusted={"ruleMatches": [{"ruleId": "R1"}]})
    messages = builder.build(req, entry)
    user = messages[1]["content"]

    assert "ruleMatches" in user


def test_evidence_refs_formatted():
    refs = [_ref("eref-001", label="main.c source"), _ref("eref-002")]
    req = _make_request(evidence_refs=refs)
    messages = builder.build(req, entry)
    user = messages[1]["content"]

    assert "eref-001: main.c source" in user
    assert "eref-002: raw-source" in user


def test_no_evidence_refs():
    req = _make_request()
    messages = builder.build(req, entry)
    user = messages[1]["content"]

    assert "(없음)" in user


def test_untrusted_delimiters():
    req = _make_request(untrusted={"sourceSnippet": "gets(buf);"})
    messages = builder.build(req, entry)
    user = messages[1]["content"]

    assert "BEGIN_UNTRUSTED_EVIDENCE" in user
    assert "END_UNTRUSTED_EVIDENCE" in user
    assert "gets(buf);" in user


def test_no_untrusted():
    req = _make_request()
    messages = builder.build(req, entry)
    user = messages[1]["content"]

    assert "BEGIN_UNTRUSTED_EVIDENCE" in user
    assert "(없음)" in user


def test_semi_trusted_included():
    req = _make_request(semi_trusted={"parsedEvents": [{"ts": "14:30:01"}]})
    messages = builder.build(req, entry)
    user = messages[1]["content"]

    assert "14:30:01" in user


def test_build_profile_included():
    req = _make_request(trusted={
        "finding": {"ruleId": "CWE-120", "title": "Buffer Overflow"},
        "buildProfile": {
            "languageStandard": "c99",
            "targetArch": "arm-cortex-m7",
            "compiler": "arm-none-eabi-gcc",
        },
    })
    messages = builder.build(req, entry)
    user = messages[1]["content"]

    assert "arm-cortex-m7" in user
    assert "arm-none-eabi-gcc" in user
    assert "c99" in user


def test_build_profile_missing():
    req = _make_request(trusted={"finding": {"ruleId": "CWE-120"}})
    messages = builder.build(req, entry)
    user = messages[1]["content"]

    # buildProfile이 없으면 빈 문자열로 치환
    assert "arm-cortex-m7" not in user


def test_build_profile_partial():
    req = _make_request(trusted={
        "finding": {"ruleId": "CWE-120"},
        "buildProfile": {"targetArch": "x86_64"},
    })
    messages = builder.build(req, entry)
    user = messages[1]["content"]

    assert "x86_64" in user
