"""V1ResponseParser 단위 테스트."""

from __future__ import annotations

import pytest

from app.pipeline.response_parser import V1ResponseParser


@pytest.fixture
def parser() -> V1ResponseParser:
    return V1ResponseParser()


# ── 정상 JSON 파싱 ──────────────────────────────────────


def test_parse_valid_json(parser: V1ResponseParser) -> None:
    """유효한 JSON 문자열 → dict."""
    raw = '{"summary": "ok", "claims": []}'
    result = parser.parse(raw)
    assert result is not None
    assert result["summary"] == "ok"
    assert result["claims"] == []


# ── code fence 파싱 ─────────────────────────────────────


def test_parse_json_code_fence(parser: V1ResponseParser) -> None:
    """```json ... ``` 감싸진 JSON → dict."""
    raw = '```json\n{"a": 1}\n```'
    result = parser.parse(raw)
    assert result is not None
    assert result["a"] == 1


# ── 비JSON → None ──────────────────────────────────────


def test_parse_invalid_json(parser: V1ResponseParser) -> None:
    """파싱 불가능한 텍스트 → None."""
    result = parser.parse("This is just plain garbage text, not JSON at all.")
    assert result is None


# ── strict=False: 문자열 내 raw newline 허용 ───────────


def test_parse_strict_false_newlines(parser: V1ResponseParser) -> None:
    """JSON 문자열 안에 리터럴 개행문자가 있어도 파싱 성공 (strict=False)."""
    raw = '{"detail": "line1\nline2\ttab"}'
    result = parser.parse(raw)
    assert result is not None
    assert "line1" in result["detail"]
    assert "line2" in result["detail"]


# ── <think> 태그 제거 ──────────────────────────────────


def test_parse_with_think_tags(parser: V1ResponseParser) -> None:
    """<think>...</think> 태그가 있어도 JSON 파싱 성공."""
    raw = '<think>Let me reason about this...</think>{"a": 1, "b": 2}'
    result = parser.parse(raw)
    assert result is not None
    assert result["a"] == 1
    assert result["b"] == 2


def test_parse_with_unclosed_think_tag(parser: V1ResponseParser) -> None:
    """닫히지 않은 <think> 뒤 JSON도 안전하게 복구."""
    raw = '<think>Let me reason about this...\n{"a": 1, "b": 2}'
    result = parser.parse(raw)
    assert result is not None
    assert result["a"] == 1
    assert result["b"] == 2


def test_parse_fenced_json_with_trailing_prose(parser: V1ResponseParser) -> None:
    """코드펜스 뒤 설명문이 붙어도 펜스 안 JSON 복구."""
    raw = 'notes\n```json\n{"a": 1}\n```\nextra prose'
    result = parser.parse(raw)
    assert result is not None
    assert result["a"] == 1


# ── 리스트 반환 시 None ────────────────────────────────


def test_parse_non_dict_json(parser: V1ResponseParser) -> None:
    """JSON이지만 dict가 아닌 경우 → None."""
    raw = '[1, 2, 3]'
    result = parser.parse(raw)
    assert result is None
