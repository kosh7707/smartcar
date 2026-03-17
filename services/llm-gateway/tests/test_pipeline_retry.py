"""TaskPipeline 재시도 로직 테스트."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.errors import LlmHttpError, LlmTimeoutError, LlmUnavailableError
from app.pipeline.task_pipeline import TaskPipeline
from app.schemas.request import (
    Constraints,
    Context,
    EvidenceRef,
    TaskRequest,
)
from app.schemas.response import TokenUsage, ValidationInfo
from app.types import FailureCode, TaskStatus, TaskType


# --- fixtures ---


def _make_request(
    task_type: TaskType = TaskType.STATIC_EXPLAIN,
    ref_ids: list[str] | None = None,
) -> TaskRequest:
    if ref_ids is None:
        ref_ids = ["eref-001"]
    return TaskRequest(
        taskType=task_type,
        taskId="test-001",
        context=Context(trusted={"finding": {"id": "f1"}}),
        evidenceRefs=[
            EvidenceRef(
                refId=rid,
                artifactId="a1",
                artifactType="source",
                locatorType="file",
                locator={"path": "main.c"},
            )
            for rid in ref_ids
        ],
        constraints=Constraints(),
    )


_GOOD_LLM_RESPONSE = json.dumps({
    "summary": "Test finding",
    "claims": [
        {"statement": "Vuln found", "supportingEvidenceRefs": ["eref-001"]},
    ],
    "caveats": ["manual review needed"],
    "usedEvidenceRefs": ["eref-001"],
    "suggestedSeverity": "high",
    "needsHumanReview": True,
    "recommendedNextSteps": ["Review"],
    "policyFlags": [],
})


def _build_pipeline() -> TaskPipeline:
    prompt_reg = MagicMock()
    prompt_entry = MagicMock()
    prompt_entry.version = "v1"
    prompt_entry.promptId = "static-explain"
    prompt_reg.get.return_value = prompt_entry

    model_reg = MagicMock()
    profile = MagicMock()
    profile.profileId = "qwen-14b"
    profile.allowedTaskTypes = list(TaskType)
    model_reg.get_default.return_value = profile

    pipeline = TaskPipeline(prompt_reg, model_reg)
    return pipeline


# --- tests ---


@pytest.mark.asyncio
@patch("app.pipeline.task_pipeline.settings")
async def test_retry_on_invalid_schema_then_success(mock_settings):
    """1차 JSON 파싱 실패 → 2차 성공, retryCount=1."""
    mock_settings.llm_mode = "mock"
    mock_settings.llm_max_retries = 2
    mock_settings.llm_max_input_chars = 800_000
    mock_settings.rag_top_k = 5
    mock_settings.llm_concurrency = 4

    pipeline = _build_pipeline()
    pipeline._prompt_builder.build = MagicMock(return_value=[{"role": "user", "content": "test"}])
    pipeline._call_llm = AsyncMock(side_effect=[
        ("not json at all", TokenUsage(prompt=100, completion=50)),
        (_GOOD_LLM_RESPONSE, TokenUsage(prompt=100, completion=50)),
    ])

    request = _make_request()
    result = await pipeline.execute(request)

    assert result.status == TaskStatus.COMPLETED
    assert result.audit.retryCount == 1
    assert result.audit.tokenUsage.prompt == 200
    assert result.audit.tokenUsage.completion == 100


@pytest.mark.asyncio
@patch("app.pipeline.task_pipeline.settings")
async def test_retry_on_invalid_grounding_then_success(mock_settings):
    """1차 hallucinated refId → 2차 성공."""
    mock_settings.llm_mode = "mock"
    mock_settings.llm_max_retries = 2
    mock_settings.llm_max_input_chars = 800_000
    mock_settings.rag_top_k = 5
    mock_settings.llm_concurrency = 4

    bad_response = json.dumps({
        "summary": "Test",
        "claims": [{"statement": "s", "supportingEvidenceRefs": ["FAKE-REF"]}],
        "usedEvidenceRefs": ["FAKE-REF"],
        "needsHumanReview": True,
    })

    pipeline = _build_pipeline()
    pipeline._prompt_builder.build = MagicMock(return_value=[{"role": "user", "content": "test"}])
    pipeline._call_llm = AsyncMock(side_effect=[
        (bad_response, TokenUsage(prompt=100, completion=50)),
        (_GOOD_LLM_RESPONSE, TokenUsage(prompt=100, completion=50)),
    ])

    request = _make_request()
    result = await pipeline.execute(request)

    assert result.status == TaskStatus.COMPLETED
    assert result.audit.retryCount == 1


@pytest.mark.asyncio
@patch("app.pipeline.task_pipeline.settings")
async def test_retry_on_empty_response_then_success(mock_settings):
    """1차 빈 응답 → 2차 성공."""
    mock_settings.llm_mode = "mock"
    mock_settings.llm_max_retries = 2
    mock_settings.llm_max_input_chars = 800_000
    mock_settings.rag_top_k = 5
    mock_settings.llm_concurrency = 4

    pipeline = _build_pipeline()
    pipeline._prompt_builder.build = MagicMock(return_value=[{"role": "user", "content": "test"}])
    pipeline._call_llm = AsyncMock(side_effect=[
        ("", TokenUsage(prompt=100, completion=0)),
        (_GOOD_LLM_RESPONSE, TokenUsage(prompt=100, completion=50)),
    ])

    request = _make_request()
    result = await pipeline.execute(request)

    assert result.status == TaskStatus.COMPLETED
    assert result.audit.retryCount == 1


@pytest.mark.asyncio
@patch("app.pipeline.task_pipeline.settings")
async def test_all_retries_exhausted(mock_settings):
    """3회 모두 실패 → 최종 실패, retryCount=2."""
    mock_settings.llm_mode = "mock"
    mock_settings.llm_max_retries = 2
    mock_settings.llm_max_input_chars = 800_000
    mock_settings.rag_top_k = 5
    mock_settings.llm_concurrency = 4

    pipeline = _build_pipeline()
    pipeline._prompt_builder.build = MagicMock(return_value=[{"role": "user", "content": "test"}])
    pipeline._call_llm = AsyncMock(return_value=(
        "not json", TokenUsage(prompt=100, completion=50),
    ))

    request = _make_request()
    result = await pipeline.execute(request)

    assert result.status == TaskStatus.VALIDATION_FAILED
    assert result.failureCode == FailureCode.INVALID_SCHEMA
    assert result.audit.retryCount == 2
    # 3회 시도 토큰 누적
    assert result.audit.tokenUsage.prompt == 300


@pytest.mark.asyncio
@patch("app.pipeline.task_pipeline.settings")
async def test_no_retry_on_http_error(mock_settings):
    """LlmTimeoutError → 즉시 실패, 재시도 없음."""
    mock_settings.llm_mode = "mock"
    mock_settings.llm_max_retries = 2
    mock_settings.llm_max_input_chars = 800_000
    mock_settings.rag_top_k = 5
    mock_settings.llm_concurrency = 4

    pipeline = _build_pipeline()
    pipeline._prompt_builder.build = MagicMock(return_value=[{"role": "user", "content": "test"}])
    pipeline._call_llm = AsyncMock(side_effect=LlmTimeoutError())

    request = _make_request()
    result = await pipeline.execute(request)

    assert result.status == TaskStatus.TIMEOUT
    assert result.failureCode == FailureCode.TIMEOUT
    assert result.retryable is True
    # LLM 1번만 호출됨
    assert pipeline._call_llm.call_count == 1


@pytest.mark.asyncio
@patch("app.pipeline.task_pipeline.settings")
async def test_http_429_returns_llm_overloaded(mock_settings):
    """429 과부하 → LLM_OVERLOADED, retryable=True."""
    mock_settings.llm_mode = "mock"
    mock_settings.llm_max_retries = 2
    mock_settings.llm_max_input_chars = 800_000
    mock_settings.rag_top_k = 5
    mock_settings.llm_concurrency = 4

    pipeline = _build_pipeline()
    pipeline._prompt_builder.build = MagicMock(return_value=[{"role": "user", "content": "test"}])
    pipeline._call_llm = AsyncMock(side_effect=LlmHttpError(429))

    request = _make_request()
    result = await pipeline.execute(request)

    assert result.status == TaskStatus.MODEL_ERROR
    assert result.failureCode == FailureCode.LLM_OVERLOADED
    assert result.retryable is True
    assert pipeline._call_llm.call_count == 1


@pytest.mark.asyncio
@patch("app.pipeline.task_pipeline.settings")
async def test_http_500_returns_model_unavailable(mock_settings):
    """500 에러 → MODEL_UNAVAILABLE, retryable=False."""
    mock_settings.llm_mode = "mock"
    mock_settings.llm_max_retries = 2
    mock_settings.llm_max_input_chars = 800_000
    mock_settings.rag_top_k = 5
    mock_settings.llm_concurrency = 4

    pipeline = _build_pipeline()
    pipeline._prompt_builder.build = MagicMock(return_value=[{"role": "user", "content": "test"}])
    pipeline._call_llm = AsyncMock(side_effect=LlmHttpError(500))

    request = _make_request()
    result = await pipeline.execute(request)

    assert result.status == TaskStatus.MODEL_ERROR
    assert result.failureCode == FailureCode.MODEL_UNAVAILABLE
    assert result.retryable is False


@pytest.mark.asyncio
@patch("app.pipeline.task_pipeline.settings")
async def test_unavailable_returns_model_unavailable_retryable(mock_settings):
    """LlmUnavailableError → MODEL_UNAVAILABLE, retryable=True."""
    mock_settings.llm_mode = "mock"
    mock_settings.llm_max_retries = 2
    mock_settings.llm_max_input_chars = 800_000
    mock_settings.rag_top_k = 5
    mock_settings.llm_concurrency = 4

    pipeline = _build_pipeline()
    pipeline._prompt_builder.build = MagicMock(return_value=[{"role": "user", "content": "test"}])
    pipeline._call_llm = AsyncMock(side_effect=LlmUnavailableError())

    request = _make_request()
    result = await pipeline.execute(request)

    assert result.status == TaskStatus.MODEL_ERROR
    assert result.failureCode == FailureCode.MODEL_UNAVAILABLE
    assert result.retryable is True


@pytest.mark.asyncio
@patch("app.pipeline.task_pipeline.settings")
async def test_token_usage_accumulated(mock_settings):
    """재시도 시 토큰 사용량 누적 확인."""
    mock_settings.llm_mode = "mock"
    mock_settings.llm_max_retries = 2
    mock_settings.llm_max_input_chars = 800_000
    mock_settings.rag_top_k = 5
    mock_settings.llm_concurrency = 4

    pipeline = _build_pipeline()
    pipeline._prompt_builder.build = MagicMock(return_value=[{"role": "user", "content": "test"}])
    pipeline._call_llm = AsyncMock(side_effect=[
        ("bad json", TokenUsage(prompt=100, completion=30)),
        ("still bad", TokenUsage(prompt=110, completion=40)),
        (_GOOD_LLM_RESPONSE, TokenUsage(prompt=120, completion=50)),
    ])

    request = _make_request()
    result = await pipeline.execute(request)

    assert result.status == TaskStatus.COMPLETED
    assert result.audit.retryCount == 2
    assert result.audit.tokenUsage.prompt == 330  # 100+110+120
    assert result.audit.tokenUsage.completion == 120  # 30+40+50


@pytest.mark.asyncio
@patch("app.pipeline.task_pipeline.settings")
async def test_retry_count_zero_on_first_success(mock_settings):
    """첫 시도 성공 → retryCount=0."""
    mock_settings.llm_mode = "mock"
    mock_settings.llm_max_retries = 2
    mock_settings.llm_max_input_chars = 800_000
    mock_settings.rag_top_k = 5
    mock_settings.llm_concurrency = 4

    pipeline = _build_pipeline()
    pipeline._prompt_builder.build = MagicMock(return_value=[{"role": "user", "content": "test"}])
    pipeline._call_llm = AsyncMock(return_value=(
        _GOOD_LLM_RESPONSE, TokenUsage(prompt=100, completion=50),
    ))

    request = _make_request()
    result = await pipeline.execute(request)

    assert result.status == TaskStatus.COMPLETED
    assert result.audit.retryCount == 0


@pytest.mark.asyncio
@patch("app.pipeline.task_pipeline.settings")
async def test_max_retries_zero_disables_retry(mock_settings):
    """max_retries=0 → 1회만 시도, 실패 시 즉시 반환."""
    mock_settings.llm_mode = "mock"
    mock_settings.llm_max_retries = 0
    mock_settings.llm_max_input_chars = 800_000
    mock_settings.rag_top_k = 5
    mock_settings.llm_concurrency = 4

    pipeline = _build_pipeline()
    pipeline._prompt_builder.build = MagicMock(return_value=[{"role": "user", "content": "test"}])
    pipeline._call_llm = AsyncMock(return_value=(
        "not json", TokenUsage(prompt=100, completion=50),
    ))

    request = _make_request()
    result = await pipeline.execute(request)

    assert result.status == TaskStatus.VALIDATION_FAILED
    assert result.failureCode == FailureCode.INVALID_SCHEMA
    assert result.audit.retryCount == 0
    assert pipeline._call_llm.call_count == 1
