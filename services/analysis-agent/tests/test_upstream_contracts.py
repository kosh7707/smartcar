"""S4/S5 upstream 응답 계약 테스트.

upstream 서비스의 응답 형태가 변경되면 이 테스트에서 감지한다.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from agent_shared.schemas.upstream import (
    CodeFunction,
    KbSearchHit,
    SastFinding,
    ScaLibrary,
)


# ─── SastFinding 계약 ───


class TestSastFindingContract:
    def test_full_payload(self):
        raw = {
            "ruleId": "CWE-120",
            "message": "Buffer overflow in strcpy call",
            "file": "src/main.c",
            "line": 42,
            "severity": "high",
            "tool": "cppcheck",
            "metadata": {"cwe": ["CWE-120"]},
        }
        f = SastFinding.model_validate(raw)
        assert f.ruleId == "CWE-120"
        assert f.severity == "high"
        assert f.metadata["cwe"] == ["CWE-120"]

    def test_missing_optional_fields_graceful(self):
        raw = {"ruleId": "R001", "message": "test"}
        f = SastFinding.model_validate(raw)
        assert f.file == ""
        assert f.line == 0
        assert f.metadata == {}

    def test_completely_empty_payload(self):
        f = SastFinding.model_validate({})
        assert f.ruleId == ""
        assert f.message == ""

    def test_field_rename_detection(self):
        """upstream이 ruleId → rule_id로 바꾸면 ruleId가 빈 문자열이 된다."""
        raw = {"rule_id": "CWE-120", "message": "test"}
        f = SastFinding.model_validate(raw)
        assert f.ruleId == ""  # 기존 필드명 없음 → 기본값


# ─── CodeFunction 계약 ───


class TestCodeFunctionContract:
    def test_full_payload(self):
        raw = {"name": "main", "file": "src/main.c", "line": 10, "origin": None}
        f = CodeFunction.model_validate(raw)
        assert f.name == "main"

    def test_missing_name(self):
        raw = {"file": "lib/util.c", "line": 5}
        f = CodeFunction.model_validate(raw)
        assert f.name == ""

    def test_third_party_origin(self):
        raw = {"name": "ssl_init", "file": "vendor/ssl.c", "origin": "openssl"}
        f = CodeFunction.model_validate(raw)
        assert f.origin == "openssl"


# ─── KbSearchHit 계약 ───


class TestKbSearchHitContract:
    def test_full_payload(self):
        raw = {"id": "hit-001", "score": 0.95, "content": "CWE-120 info", "source": "nvd"}
        h = KbSearchHit.model_validate(raw)
        assert h.id == "hit-001"
        assert h.score == 0.95

    def test_missing_id(self):
        raw = {"score": 0.5, "content": "test"}
        h = KbSearchHit.model_validate(raw)
        assert h.id == ""

    def test_field_rename_detection(self):
        raw = {"hit_id": "hit-002", "score": 0.8}
        h = KbSearchHit.model_validate(raw)
        assert h.id == ""  # 기존 필드명 없음 → 기본값


# ─── ScaLibrary 계약 ───


class TestScaLibraryContract:
    def test_full_payload(self):
        raw = {"name": "openssl", "version": "1.1.1", "license": "Apache-2.0"}
        lib = ScaLibrary.model_validate(raw)
        assert lib.name == "openssl"
        assert lib.version == "1.1.1"

    def test_missing_version(self):
        raw = {"name": "zlib"}
        lib = ScaLibrary.model_validate(raw)
        assert lib.version == ""
