"""Phase1Executor 단위 테스트 — 결정론적 도구 실행 + KB 연동."""
import json

import httpx
import pytest
from unittest.mock import AsyncMock, MagicMock

from app.core.phase_one import Phase1Executor, Phase1Result, build_phase2_prompt
from app.schemas.agent import ToolResult


# ───────────────────────────────────────────────
# _extract_cwe_ids
# ───────────────────────────────────────────────

class TestExtractCweIds:
    def test_from_rule_id(self):
        findings = [{"ruleId": "flawfinder:CWE-78", "message": ""}]
        assert Phase1Executor._extract_cwe_ids(findings) == {"CWE-78"}

    def test_from_message(self):
        findings = [{"ruleId": "", "message": "race condition (CWE-362, CWE-20)"}]
        result = Phase1Executor._extract_cwe_ids(findings)
        assert "CWE-362" in result
        assert "CWE-20" in result

    def test_dedup(self):
        findings = [
            {"ruleId": "CWE-78", "message": "CWE-78 injection"},
            {"ruleId": "", "message": "also CWE-78"},
        ]
        assert Phase1Executor._extract_cwe_ids(findings) == {"CWE-78"}

    def test_empty(self):
        assert Phase1Executor._extract_cwe_ids([]) == set()

    def test_no_cwe(self):
        findings = [{"ruleId": "bugprone-easily-swappable", "message": "parameters swapped"}]
        assert Phase1Executor._extract_cwe_ids(findings) == set()


# ───────────────────────────────────────────────
# _extract_dangerous_funcs
# ───────────────────────────────────────────────

class TestExtractDangerousFuncs:
    def test_matches_known_funcs(self):
        findings = [
            {"message": "popen() is dangerous"},
            {"message": "getenv() untrustable input"},
        ]
        result = Phase1Executor._extract_dangerous_funcs(findings)
        assert "popen" in result
        assert "getenv" in result

    def test_no_match(self):
        findings = [{"message": "variable is unused"}]
        assert Phase1Executor._extract_dangerous_funcs(findings) == set()

    def test_case_insensitive(self):
        findings = [{"message": "POPEN used in code"}]
        result = Phase1Executor._extract_dangerous_funcs(findings)
        assert "popen" in result


# ───────────────────────────────────────────────
# _run_threat_query
# ───────────────────────────────────────────────

class TestRunThreatQuery:
    @pytest.mark.asyncio
    async def test_success(self):
        executor = Phase1Executor(kb_endpoint="http://localhost:8002")
        result = Phase1Result(
            sast_findings=[{"ruleId": "CWE-78", "message": "command injection"}],
        )

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {
            "hits": [{"id": "CWE-78", "source": "CWE", "title": "OS Command Injection"}],
        }
        executor._kb_client.post = AsyncMock(return_value=mock_resp)

        result = await executor._run_threat_query(result)

        assert len(result.threat_context) == 1
        assert result.threat_context[0]["id"] == "CWE-78"
        assert result.threat_query_duration_ms >= 0
        await executor.aclose()

    @pytest.mark.asyncio
    async def test_kb_down_graceful(self):
        executor = Phase1Executor(kb_endpoint="http://localhost:8002")
        result = Phase1Result(
            sast_findings=[{"ruleId": "CWE-78", "message": "injection"}],
        )

        executor._kb_client.post = AsyncMock(side_effect=httpx.ConnectError("refused"))

        result = await executor._run_threat_query(result)

        assert result.threat_context == []
        await executor.aclose()


# ───────────────────────────────────────────────
# _run_cve_lookup
# ───────────────────────────────────────────────

class TestRunCveLookup:
    @pytest.mark.asyncio
    async def test_success(self):
        executor = Phase1Executor(kb_endpoint="http://localhost:8002")
        result = Phase1Result(
            sca_libraries=[
                {"name": "mosquitto", "version": "2.0.22", "repoUrl": "https://github.com/eclipse/mosquitto.git"},
            ],
        )

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {
            "results": [{
                "library": "mosquitto",
                "version": "2.0.22",
                "cves": [
                    {"id": "CVE-2021-34434", "version_match": True, "severity": 7.5},
                    {"id": "CVE-2023-99999", "version_match": False, "severity": 5.0},
                ],
            }],
        }
        executor._kb_client.post = AsyncMock(return_value=mock_resp)

        result = await executor._run_cve_lookup(result)

        assert len(result.cve_lookup) == 2
        matched = [c for c in result.cve_lookup if c.get("version_match") is True]
        assert len(matched) == 1
        assert matched[0]["id"] == "CVE-2021-34434"
        assert matched[0]["_library"] == "mosquitto"
        await executor.aclose()

    @pytest.mark.asyncio
    async def test_kb_down_graceful(self):
        executor = Phase1Executor(kb_endpoint="http://localhost:8002")
        result = Phase1Result(
            sca_libraries=[{"name": "openssl", "version": "1.1.1"}],
        )

        executor._kb_client.post = AsyncMock(side_effect=httpx.ConnectError("refused"))

        result = await executor._run_cve_lookup(result)

        assert result.cve_lookup == []
        await executor.aclose()

    @pytest.mark.asyncio
    async def test_no_libraries_skips(self):
        executor = Phase1Executor(kb_endpoint="http://localhost:8002")
        result = Phase1Result(sca_libraries=[])

        result = await executor._run_cve_lookup(result)

        assert result.cve_lookup == []
        await executor.aclose()


# ───────────────────────────────────────────────
# _run_dangerous_callers
# ───────────────────────────────────────────────

class TestRunDangerousCallers:
    @pytest.mark.asyncio
    async def test_success(self):
        executor = Phase1Executor(kb_endpoint="http://localhost:8002")
        result = Phase1Result(
            sast_findings=[{"ruleId": "", "message": "popen() used for command execution"}],
        )

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {
            "results": [
                {"name": "postJson", "file": "src/http_client.cpp", "line": 8, "dangerous_calls": ["popen"]},
            ],
        }
        executor._kb_client.post = AsyncMock(return_value=mock_resp)

        result = await executor._run_dangerous_callers(result, "test-project")

        assert len(result.dangerous_callers) == 1
        assert result.dangerous_callers[0]["name"] == "postJson"
        await executor.aclose()


# ───────────────────────────────────────────────
# build_phase2_prompt
# ───────────────────────────────────────────────

class TestBuildPhase2Prompt:
    def test_mission_structure(self):
        """시스템 프롬프트에 임무 중심 4단계 구조가 포함된다."""
        result = Phase1Result()
        system, user = build_phase2_prompt(result, {"objective": "test"})

        assert "당신의 임무" in system
        assert "보고서 스키마" in system
        assert "규칙" in system
        # "JSON만 출력하라"가 임무 설명보다 앞에 오지 않음
        mission_pos = system.index("당신의 임무")
        schema_pos = system.index("보고서 스키마")
        assert mission_pos < schema_pos

    def test_includes_threat_context(self):
        """위협 지식이 프롬프트에 포함된다."""
        result = Phase1Result(
            threat_context=[
                {"id": "CWE-78", "source": "CWE", "title": "OS Command Injection", "threat_category": "Injection"},
            ],
        )
        _, user = build_phase2_prompt(result, {"objective": "test"})

        assert "위협 지식" in user
        assert "CWE-78" in user
        assert "OS Command Injection" in user

    def test_includes_version_matched_cves(self):
        """version_match가 true인 CVE만 프롬프트에 포함된다."""
        result = Phase1Result(
            cve_lookup=[
                {"id": "CVE-2021-001", "version_match": True, "_library": "curl", "_version": "7.68", "title": "vuln1", "severity": 9.8},
                {"id": "CVE-2023-999", "version_match": False, "_library": "curl", "_version": "7.68", "title": "vuln2"},
            ],
        )
        _, user = build_phase2_prompt(result, {"objective": "test"})

        assert "CVE-2021-001" in user
        assert "CVE-2023-999" not in user
        assert "버전 매칭 완료" in user

    def test_includes_dangerous_callers(self):
        """위험 함수 호출자가 프롬프트에 포함된다."""
        result = Phase1Result(
            dangerous_callers=[
                {"name": "postJson", "file": "src/http_client.cpp", "line": 8, "dangerous_calls": ["popen"]},
            ],
        )
        _, user = build_phase2_prompt(result, {"objective": "test"})

        assert "위험 함수 호출자" in user
        assert "postJson" in user
        assert "popen" in user
