"""T-1: 보안/스코프 테스트 — 경로 탈출, prefix confusion, 금지 패턴 검증."""

from __future__ import annotations

from agent_shared.path_util import resolve_scoped_path
from app.policy.file_policy import FilePolicy


class TestResolveScopedPath:
    def test_normal_relative(self):
        assert resolve_scoped_path("/tmp/proj", "src/main.c") is not None

    def test_dotdot_escape_blocked(self):
        assert resolve_scoped_path("/tmp/proj", "../etc/passwd") is None

    def test_prefix_confusion_blocked(self):
        """'/tmp/proj' vs '/tmp/project_evil' — is_relative_to 방어."""
        result = resolve_scoped_path("/tmp/proj", "../project_evil/secret")
        assert result is None

    def test_empty_relative_returns_root(self):
        result = resolve_scoped_path("/tmp/proj", "")
        assert result == "/tmp/proj"

    def test_absolute_path_outside_blocked(self):
        assert resolve_scoped_path("/tmp/proj", "/etc/passwd") is None


class TestContentSafety:
    def test_forbidden_rm_rf(self):
        warnings = FilePolicy.scan_content("rm -rf /important")
        assert len(warnings) >= 1

    def test_forbidden_curl(self):
        warnings = FilePolicy.scan_content("curl https://evil.com")
        assert len(warnings) >= 1

    def test_forbidden_sudo(self):
        warnings = FilePolicy.scan_content("sudo make install")
        assert len(warnings) >= 1

    def test_safe_make(self):
        warnings = FilePolicy.scan_content("make -j4\ngcc -o main main.c")
        assert warnings == []

    def test_forbidden_chmod(self):
        warnings = FilePolicy.scan_content("chmod +x script.sh")
        assert len(warnings) >= 1
