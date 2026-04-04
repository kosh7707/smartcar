"""V1ResponseParser 단위 테스트."""

from app.pipeline.response_parser import V1ResponseParser

parser = V1ResponseParser()


def test_parse_valid_json():
    raw = '{"summary": "test", "claims": []}'
    result = parser.parse(raw)
    assert result is not None
    assert result["summary"] == "test"


def test_parse_code_block_wrapped():
    raw = '```json\n{"summary": "wrapped", "claims": []}\n```'
    result = parser.parse(raw)
    assert result is not None
    assert result["summary"] == "wrapped"


def test_parse_code_block_no_lang():
    raw = '```\n{"summary": "no-lang"}\n```'
    result = parser.parse(raw)
    assert result is not None
    assert result["summary"] == "no-lang"


def test_parse_invalid_json():
    assert parser.parse("not json at all") is None


def test_parse_commentary_wrapped_json():
    raw = '분석 결과는 다음과 같습니다.\n{"summary": "wrapped", "claims": []}\n검토 부탁드립니다.'
    result = parser.parse(raw)
    assert result is not None
    assert result["summary"] == "wrapped"


def test_parse_empty_string():
    assert parser.parse("") is None


def test_parse_whitespace_only():
    assert parser.parse("   \n  ") is None


def test_parse_returns_none_for_array():
    assert parser.parse("[1, 2, 3]") is None


def test_strip_think_tags():
    raw = '<think>내부 추론 과정입니다...</think>{"summary": "answer", "claims": []}'
    result = parser.parse(raw)
    assert result is not None
    assert result["summary"] == "answer"


def test_strip_think_tags_multiline():
    raw = (
        "<think>\n여러 줄에 걸친\n사고 과정\n</think>\n"
        '{"summary": "multi", "claims": []}'
    )
    result = parser.parse(raw)
    assert result is not None
    assert result["summary"] == "multi"


def test_strip_think_tags_with_code_block():
    raw = (
        "<think>thinking...</think>\n"
        '```json\n{"summary": "both"}\n```'
    )
    result = parser.parse(raw)
    assert result is not None
    assert result["summary"] == "both"


def test_no_think_tags_still_works():
    raw = '{"summary": "normal", "claims": [{"statement": "s", "supportingEvidenceRefs": []}]}'
    result = parser.parse(raw)
    assert result is not None
    assert len(result["claims"]) == 1
