"""ToolHook 프레임워크 단위 테스트."""

from app.agent_runtime.tools.hooks import (
    AuditLogHook,
    HookResult,
    HookRunner,
    merge_hook_feedback,
    truncate_tool_result,
)


class TestHookResult:
    def test_allowed(self):
        r = HookResult.allowed()
        assert r.allow is True
        assert not r.is_denied()

    def test_allowed_with_message(self):
        r = HookResult.allowed("info")
        assert r.allow is True
        assert r.messages == ["info"]

    def test_denied(self):
        r = HookResult.denied("not allowed")
        assert r.is_denied()
        assert "not allowed" in r.messages


class TestHookRunner:
    def test_empty_runner_allows(self):
        runner = HookRunner()
        result = runner.run_pre_hooks("any_tool", {})
        assert result.allow is True

    def test_pre_hook_deny_stops_execution(self):
        class DenyHook:
            def pre_tool_use(self, name, args):
                return HookResult.denied(f"denied: {name}")
            def post_tool_use(self, name, args, output, is_error):
                return HookResult.allowed()

        runner = HookRunner()
        runner.register(DenyHook())
        result = runner.run_pre_hooks("dangerous_tool", {})
        assert result.is_denied()
        assert "denied: dangerous_tool" in result.messages

    def test_multiple_hooks_messages_collected(self):
        class HookA:
            def pre_tool_use(self, name, args):
                return HookResult.allowed("hook_a")
            def post_tool_use(self, name, args, output, is_error):
                return HookResult.allowed()

        class HookB:
            def pre_tool_use(self, name, args):
                return HookResult.allowed("hook_b")
            def post_tool_use(self, name, args, output, is_error):
                return HookResult.allowed()

        runner = HookRunner()
        runner.register(HookA())
        runner.register(HookB())
        result = runner.run_pre_hooks("tool", {})
        assert result.allow is True
        assert "hook_a" in result.messages
        assert "hook_b" in result.messages

    def test_post_hook_deny(self):
        class PostDenyHook:
            def pre_tool_use(self, name, args):
                return HookResult.allowed()
            def post_tool_use(self, name, args, output, is_error):
                if is_error:
                    return HookResult.denied("error detected")
                return HookResult.allowed()

        runner = HookRunner()
        runner.register(PostDenyHook())
        result = runner.run_post_hooks("tool", {}, "err", True)
        assert result.is_denied()

    def test_hook_count(self):
        runner = HookRunner()
        assert runner.hook_count == 0
        runner.register(AuditLogHook())
        assert runner.hook_count == 1


class TestAuditLogHook:
    def test_always_allows(self):
        hook = AuditLogHook()
        pre = hook.pre_tool_use("read_file", {"path": "test.c"})
        assert pre.allow is True
        post = hook.post_tool_use("read_file", {"path": "test.c"}, "content", False)
        assert post.allow is True


class TestMergeHookFeedback:
    def test_no_messages_returns_original(self):
        assert merge_hook_feedback([], "output", False) == "output"

    def test_appends_feedback(self):
        result = merge_hook_feedback(["warning"], "output", False)
        assert "output" in result
        assert "Hook feedback:" in result
        assert "warning" in result

    def test_denied_label(self):
        result = merge_hook_feedback(["blocked"], "", True)
        assert "Hook feedback (denied):" in result
        assert "blocked" in result


class TestTruncateToolResult:
    def test_short_content_unchanged(self):
        assert truncate_tool_result("short", max_chars=100) == "short"

    def test_exact_limit_unchanged(self):
        content = "x" * 8000
        assert truncate_tool_result(content) == content

    def test_over_limit_truncated(self):
        content = "x" * 10000
        result = truncate_tool_result(content, max_chars=8000)
        assert len(result) < len(content)
        assert "truncated" in result
        assert "원본 10000자" in result
        assert "8000자 표시" in result

    def test_custom_limit(self):
        content = "abcdefghij"  # 10 chars
        result = truncate_tool_result(content, max_chars=5)
        assert result.startswith("abcde")
        assert "truncated" in result
