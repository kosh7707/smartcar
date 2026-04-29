from __future__ import annotations

import pytest

from app.pipeline.response_parser import V1ResponseParser


@pytest.fixture
def parser() -> V1ResponseParser:
    return V1ResponseParser()


def test_parse_strips_paired_thinking(parser: V1ResponseParser) -> None:
    result = parser.parse('<think>reasoning</think>{"summary":"ok","claims":[]}')
    assert result == {"summary": "ok", "claims": []}


def test_parse_recovers_json_after_unclosed_thinking(parser: V1ResponseParser) -> None:
    result = parser.parse('<think>reasoning that never closes\n{"summary":"ok","claims":[]}')
    assert result == {"summary": "ok", "claims": []}


def test_parse_recovers_fenced_json_with_trailing_prose(parser: V1ResponseParser) -> None:
    raw = 'prefix\n```json\n{"summary":"ok","claims":[]}\n```\ntrailing prose'
    result = parser.parse(raw)
    assert result == {"summary": "ok", "claims": []}


def test_parse_recovers_first_json_object_with_trailing_prose(parser: V1ResponseParser) -> None:
    result = parser.parse('{"summary":"ok","claims":[]}\nextra explanation')
    assert result == {"summary": "ok", "claims": []}


def test_parse_invalid_non_recoverable_text_returns_none(parser: V1ResponseParser) -> None:
    assert parser.parse('plain text without an object') is None
