"""FilePolicy — 정책 엔진 테스트."""
import os
import pytest
from app.policy.file_policy import FilePolicy


@pytest.fixture
def policy(tmp_path):
    project = tmp_path / "project"
    project.mkdir()
    return FilePolicy(str(project))


class TestCanRead:
    def test_read_project_file(self, policy):
        assert policy.can_read("src/main.cpp") is True

    def test_read_nested(self, policy):
        assert policy.can_read("lib/utils/helper.h") is True

    def test_read_traversal_blocked(self, policy):
        assert policy.can_read("../../../etc/passwd") is False

    def test_read_build_dir(self, policy):
        assert policy.can_read("build-aegis/script.sh") is True


class TestCanWrite:
    def test_write_build_dir(self, policy):
        assert policy.can_write("aegis-build.sh") is True

    def test_write_nested_build_dir(self, policy):
        assert policy.can_write("subdir/toolchain.cmake") is True

    def test_write_traversal_blocked(self, policy):
        assert policy.can_write("../src/main.cpp") is False

    def test_write_absolute_path_blocked(self, policy):
        assert policy.can_write("/tmp/evil.sh") is False


class TestCanEdit:
    def test_edit_not_created(self, policy):
        assert policy.can_edit("aegis-build.sh") is False

    def test_edit_after_create(self, policy):
        policy.record_created("aegis-build.sh")
        assert policy.can_edit("aegis-build.sh") is True

    def test_edit_different_file(self, policy):
        policy.record_created("aegis-build.sh")
        assert policy.can_edit("other.sh") is False

    def test_edit_traversal_blocked(self, policy):
        policy.record_created("../src/main.cpp")
        # 정규화 후 build_dir 밖이므로 can_edit은 False
        assert policy.can_edit("../src/main.cpp") is False


class TestCanDelete:
    def test_delete_not_created(self, policy):
        assert policy.can_delete("aegis-build.sh") is False

    def test_delete_after_create(self, policy):
        policy.record_created("aegis-build.sh")
        assert policy.can_delete("aegis-build.sh") is True


class TestRecordCreated:
    def test_record_and_query(self, policy):
        policy.record_created("toolchain.cmake")
        assert policy.can_edit("toolchain.cmake") is True
        assert len(policy.created_files) == 1

    def test_record_multiple(self, policy):
        policy.record_created("a.sh")
        policy.record_created("b.sh")
        assert len(policy.created_files) == 2

    def test_record_deleted(self, policy):
        policy.record_created("temp.sh")
        assert policy.can_delete("temp.sh") is True
        policy.record_deleted("temp.sh")
        assert policy.can_delete("temp.sh") is False
        assert len(policy.created_files) == 0
