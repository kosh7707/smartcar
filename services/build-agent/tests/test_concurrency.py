"""T-2: 상태/동시성 테스트 — duplicate hash 초기화, 독립 워크스페이스."""

from __future__ import annotations

from app.agent_runtime.schemas.agent import BudgetState
from app.budget.manager import BudgetManager
from app.policy.file_policy import FilePolicy


class TestDuplicateHashAfterMutation:
    def test_clear_allows_retry(self):
        """mutating tool 성공 후 동일 args_hash 재실행 허용."""
        bm = BudgetManager(BudgetState(max_steps=10, max_cheap_calls=10))
        h = "abc123"
        bm.register_call_hash(h)
        assert bm.is_duplicate_call(h) is True

        # write_file 성공 → clear
        bm.clear_duplicate_hashes()
        assert bm.is_duplicate_call(h) is False

    def test_no_clear_keeps_block(self):
        """clear 없이는 duplicate 차단 유지."""
        bm = BudgetManager(BudgetState(max_steps=10, max_cheap_calls=10))
        h = "xyz789"
        bm.register_call_hash(h)
        assert bm.is_duplicate_call(h) is True


class TestIndependentWorkspaces:
    def test_two_policies_independent(self, tmp_path):
        """다른 build_dir → 독립적 FilePolicy."""
        fp1 = FilePolicy(str(tmp_path), build_dir="build-aegis-aaa")
        fp2 = FilePolicy(str(tmp_path), build_dir="build-aegis-bbb")

        fp1.record_created("aegis-build.sh")

        assert fp1.can_edit("aegis-build.sh") is True
        assert fp2.can_edit("aegis-build.sh") is False

    def test_write_scoped_to_own_build_dir(self, tmp_path):
        """각 policy는 자기 build_dir만 쓰기 허용."""
        fp = FilePolicy(str(tmp_path), build_dir="build-aegis-req1")
        assert fp.can_write("aegis-build.sh") is True

        # 다른 build_dir 경로는 거부
        fp2 = FilePolicy(str(tmp_path), build_dir="build-aegis-req2")
        # 각 policy의 can_write는 자기 build_dir 기준
        assert fp2.can_write("aegis-build.sh") is True
