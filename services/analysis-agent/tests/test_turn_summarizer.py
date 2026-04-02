"""TurnSummarizer 단위 테스트."""

import pytest

from agent_shared.llm.turn_summarizer import TurnSummarizer


@pytest.mark.asyncio
async def test_short_conversation_unchanged():
    s = TurnSummarizer()
    msgs = [
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "usr"},
        {"role": "assistant", "content": "ok"},
    ]
    result = await s.summarize(msgs, keep_last_n=4)
    assert len(result) == 3


@pytest.mark.asyncio
async def test_long_conversation_truncated():
    s = TurnSummarizer()
    msgs = [
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "msg1"},
        {"role": "assistant", "content": "msg2"},
        {"role": "user", "content": "msg3"},
        {"role": "assistant", "content": "msg4"},
        {"role": "user", "content": "msg5"},
        {"role": "assistant", "content": "msg6"},
    ]
    result = await s.summarize(msgs, keep_last_n=2)
    # system + 생략 안내 + last 2
    assert len(result) == 4
    assert result[0]["role"] == "system"
    assert result[1]["role"] == "system"
    assert "컨텍스트 압축" in result[1]["content"]
    assert result[2]["content"] == "msg5"
    assert result[3]["content"] == "msg6"


@pytest.mark.asyncio
async def test_preserves_system_prompt():
    s = TurnSummarizer()
    msgs = [
        {"role": "system", "content": "important system"},
    ] + [{"role": "user", "content": f"m{i}"} for i in range(10)]
    result = await s.summarize(msgs, keep_last_n=3)
    assert result[0]["content"] == "important system"


@pytest.mark.asyncio
async def test_tool_pairs_preserved():
    """tool_call/tool 쌍이 깨지지 않고 보존되는지 검증."""
    s = TurnSummarizer()
    msgs = [
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "task"},
        # turn 1: assistant → 2 tool results
        {"role": "assistant", "content": None, "tool_calls": [
            {"id": "1", "type": "function", "function": {"name": "read_file", "arguments": "{}"}},
            {"id": "2", "type": "function", "function": {"name": "read_file", "arguments": "{}"}},
        ]},
        {"role": "tool", "tool_call_id": "1", "content": "file content 1"},
        {"role": "tool", "tool_call_id": "2", "content": "file content 2"},
        # turn 2: assistant → 1 tool result
        {"role": "assistant", "content": None, "tool_calls": [
            {"id": "3", "type": "function", "function": {"name": "write_file", "arguments": "{}"}},
        ]},
        {"role": "tool", "tool_call_id": "3", "content": "ok"},
        # turn 3: final content
        {"role": "assistant", "content": "final report"},
    ]
    # keep_last_n=2 → cut_idx=6, messages[6]=tool → 후퇴 → messages[5]=assistant
    result = await s.summarize(msgs, keep_last_n=2)
    assert result[0]["role"] == "system"
    assert result[1]["role"] == "system"
    assert "컨텍스트 압축" in result[1]["content"]
    # turn 2 의 assistant(tool_calls) + tool(ok) 가 함께 보존
    assert result[2]["role"] == "assistant"
    assert result[2].get("tool_calls") is not None
    assert result[3]["role"] == "tool"
    assert result[3]["content"] == "ok"
    # turn 3
    assert result[4]["role"] == "assistant"
    assert result[4]["content"] == "final report"


@pytest.mark.asyncio
async def test_no_compaction_when_all_tools():
    """모든 body가 하나의 tool_call/tool 쌍이면 압축 불가 → 원본 반환."""
    s = TurnSummarizer()
    msgs = [
        {"role": "system", "content": "sys"},
        {"role": "assistant", "content": None, "tool_calls": [{"id": "1"}]},
        {"role": "tool", "tool_call_id": "1", "content": "r1"},
        {"role": "tool", "tool_call_id": "2", "content": "r2"},
    ]
    result = await s.summarize(msgs, keep_last_n=1)
    # 후퇴 시 prefix 경계 도달 → 원본 반환
    assert len(result) == len(msgs)


# ── claw-code 패턴 추출 함수 테스트 ──

from agent_shared.llm.turn_summarizer import (
    _extract_file_references,
    _extract_highlights,
    _infer_pending_work,
    _collect_recent_user_requests,
)


class TestExtractFileReferences:
    def test_extracts_file_paths(self):
        msgs = [
            {"role": "user", "content": "src/main.c 파일을 확인해주세요"},
            {"role": "assistant", "content": "lib/utils/parser.h 를 분석합니다"},
        ]
        refs = _extract_file_references(msgs)
        assert "src/main.c" in refs
        assert "lib/utils/parser.h" in refs

    def test_extracts_from_tool_calls(self):
        msgs = [
            {"role": "assistant", "content": None, "tool_calls": [
                {"id": "1", "function": {"name": "read_file", "arguments": '{"path": "app/core/agent_loop.py"}'}}
            ]},
        ]
        refs = _extract_file_references(msgs)
        assert "app/core/agent_loop.py" in refs

    def test_max_8_files(self):
        content = " ".join(f"dir/file{i}.c" for i in range(20))
        msgs = [{"role": "user", "content": content}]
        refs = _extract_file_references(msgs)
        assert len(refs) <= 8

    def test_filters_non_code_extensions(self):
        msgs = [{"role": "user", "content": "path/to/image.png and src/main.c"}]
        refs = _extract_file_references(msgs)
        assert "src/main.c" in refs
        assert not any("png" in r for r in refs)


class TestInferPendingWork:
    def test_detects_todo(self):
        msgs = [
            {"role": "assistant", "content": "TODO: 나머지 테스트 작성"},
        ]
        result = _infer_pending_work(msgs)
        assert len(result) == 1
        assert "TODO" in result[0]

    def test_detects_korean_keywords(self):
        msgs = [
            {"role": "user", "content": "남은 작업을 처리해주세요"},
        ]
        result = _infer_pending_work(msgs)
        assert len(result) == 1

    def test_max_3_items(self):
        msgs = [{"role": "user", "content": f"next step {i}"} for i in range(10)]
        result = _infer_pending_work(msgs)
        assert len(result) <= 3

    def test_truncates_long_text(self):
        msgs = [{"role": "user", "content": "TODO: " + "x" * 200}]
        result = _infer_pending_work(msgs)
        assert len(result[0]) <= 165  # 160 + "…" + some margin

    def test_empty_for_no_keywords(self):
        msgs = [{"role": "user", "content": "일반적인 메시지"}]
        result = _infer_pending_work(msgs)
        assert result == []


class TestCollectRecentUserRequests:
    def test_collects_user_messages(self):
        msgs = [
            {"role": "user", "content": "첫 번째 요청"},
            {"role": "assistant", "content": "응답"},
            {"role": "user", "content": "두 번째 요청"},
        ]
        result = _collect_recent_user_requests(msgs, limit=3)
        assert len(result) == 2
        assert result[0] == "첫 번째 요청"
        assert result[1] == "두 번째 요청"

    def test_excludes_system_messages(self):
        msgs = [
            {"role": "user", "content": "[시스템] 예산 경고"},
            {"role": "user", "content": "실제 요청"},
        ]
        result = _collect_recent_user_requests(msgs, limit=3)
        assert len(result) == 1
        assert result[0] == "실제 요청"

    def test_respects_limit(self):
        msgs = [{"role": "user", "content": f"요청 {i}"} for i in range(10)]
        result = _collect_recent_user_requests(msgs, limit=2)
        assert len(result) == 2

    def test_chronological_order(self):
        msgs = [
            {"role": "user", "content": "먼저"},
            {"role": "user", "content": "나중에"},
        ]
        result = _collect_recent_user_requests(msgs, limit=3)
        assert result[0] == "먼저"
        assert result[1] == "나중에"


@pytest.mark.asyncio
async def test_compaction_includes_new_sections():
    """압축 결과에 참조 파일, 미완료 작업, 최근 사용자 요청 섹션이 포함된다."""
    s = TurnSummarizer()
    msgs = [
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "src/main.c 파일을 분석해줘"},
        {"role": "assistant", "content": "분석합니다"},
        {"role": "user", "content": "TODO: lib/utils.h도 확인 필요"},
        {"role": "assistant", "content": "확인하겠습니다"},
        {"role": "user", "content": "다음 단계로 넘어가자"},
        {"role": "assistant", "content": "진행합니다"},
        {"role": "user", "content": "최종 결과"},
        {"role": "assistant", "content": "완료"},
    ]
    result = await s.summarize(msgs, keep_last_n=2)
    # system + summary + last 2 messages
    summary_msg = result[1]
    content = summary_msg["content"]
    assert "## 참조 파일" in content
    assert "src/main.c" in content
    assert "## 미완료 작업" in content
    assert "## 최근 사용자 요청" in content


@pytest.mark.asyncio
async def test_continuation_preamble():
    """압축 요약에 continuation preamble이 포함된다."""
    s = TurnSummarizer()
    msgs = [
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "msg1"},
        {"role": "assistant", "content": "msg2"},
        {"role": "user", "content": "msg3"},
        {"role": "assistant", "content": "msg4"},
        {"role": "user", "content": "msg5"},
        {"role": "assistant", "content": "msg6"},
    ]
    result = await s.summarize(msgs, keep_last_n=2)
    summary_content = result[1]["content"]
    assert "바로 이어서 작업하라" in summary_content
    assert "요약을 반복" in summary_content
    assert "최근 메시지는 원문 그대로 보존" in summary_content


class TestExtractHighlights:
    def test_extracts_sections_and_items(self):
        summary = (
            "이전 컨텍스트가 압축되었습니다.\n"
            "[컨텍스트 압축: 이전 5개 메시지 요약]\n"
            "\n"
            "## 도구 호출 이력\n"
            "- read_file({\"path\": \"src/main.c\"}) → 성공\n"
            "- knowledge.search({\"query\": \"CWE-78\"}) → 성공 [eref-knowledge-CWE-78]\n"
            "\n"
            "## 수집된 Evidence Refs\n"
            "- eref-knowledge-CWE-78, eref-sast-cmd-injection\n"
            "\n"
            "최근 메시지는 원문 그대로 보존되었습니다."
        )
        highlights = _extract_highlights(summary)
        assert any("도구 호출 이력" in h for h in highlights)
        assert any("read_file" in h for h in highlights)
        assert any("Evidence Refs" in h for h in highlights)

    def test_excludes_preamble_and_marker(self):
        summary = (
            "이전 컨텍스트가 압축되었습니다.\n"
            "요약을 반복하거나 확인하지 마라.\n"
            "[컨텍스트 압축: 이전 3개 메시지 요약]\n"
            "## 핵심\n"
            "- 중요한 내용\n"
        )
        highlights = _extract_highlights(summary)
        assert not any("이전 컨텍스트가" in h for h in highlights)
        assert not any("[컨텍스트 압축" in h for h in highlights)
        assert any("핵심" in h for h in highlights)

    def test_max_15_items(self):
        lines = ["## 섹션"] + [f"- 항목 {i}" for i in range(30)]
        summary = "\n".join(lines)
        highlights = _extract_highlights(summary)
        assert len(highlights) <= 15

    def test_truncates_long_items(self):
        summary = "## 섹션\n- " + "x" * 200
        highlights = _extract_highlights(summary)
        assert len(highlights[1]) <= 125  # 120 + "…" + margin


@pytest.mark.asyncio
async def test_recompaction_separates_prev_and_new():
    """재압축 시 이전 요약의 핵심이 '이전 압축 요약 (핵심)' 섹션에 분리된다."""
    s = TurnSummarizer()

    # 첫 압축
    msgs1 = [
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "src/main.c 파일을 분석해줘"},
        {"role": "assistant", "content": "분석 진행"},
        {"role": "user", "content": "다음 파일도 확인 필요"},
        {"role": "assistant", "content": "진행"},
        {"role": "user", "content": "결과를 알려줘"},
        {"role": "assistant", "content": "완료"},
    ]
    result1 = await s.summarize(msgs1, keep_last_n=2)
    first_summary = result1[1]["content"]
    # 파일 참조 또는 사용자 요청이 있으면 됨
    assert "최근 사용자 요청" in first_summary

    # 두 번째 압축 (첫 압축 결과 위에 추가 대화)
    msgs2 = [
        result1[0],  # system
        result1[1],  # 첫 압축 요약
        *result1[2:],  # 보존된 메시지
        {"role": "user", "content": "lib/utils.h 확인"},
        {"role": "assistant", "content": "확인 완료"},
        {"role": "user", "content": "TODO: 나머지 처리"},
        {"role": "assistant", "content": "처리"},
    ]
    result2 = await s.summarize(msgs2, keep_last_n=2)
    second_summary = result2[1]["content"]

    # 이전 요약의 핵심이 분리되어 포함
    assert "이전 압축 요약 (핵심)" in second_summary
    # 새 컨텍스트의 정보도 포함
    assert "바로 이어서 작업하라" in second_summary
