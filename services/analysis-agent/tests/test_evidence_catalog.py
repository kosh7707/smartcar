from __future__ import annotations

from agent_shared.schemas.agent import ToolCallRequest, ToolResult
from app.core.evidence_catalog import EvidenceCatalog
from app.core.phase_one_types import Phase1Result


def test_catalog_indexes_request_and_phase1_sast_metadata():
    catalog = EvidenceCatalog()
    catalog.ingest_phase1_result(Phase1Result(
        sast_findings=[{
            "ruleId": "static-tool:rule-1",
            "message": "Potential issue (CWE-120).",
            "location": {"file": "src/main.c", "line": 12},
            "metadata": {"cweId": "CWE-120", "name": "buffer"},
        }],
    ))

    entry = catalog.get("eref-sast-static-tool:rule-1")

    assert entry is not None
    assert entry.category == "sast"
    assert entry.file == "src/main.c"
    assert entry.line == 12
    assert entry.cwe_id == "CWE-120"


def test_catalog_ingests_tool_result_semantics_without_bundle_decision_api():
    catalog = EvidenceCatalog()
    call = ToolCallRequest(
        id="tc1",
        name="code_graph.callers",
        arguments={"function_name": "dangerous_call"},
    )
    result = ToolResult(
        tool_call_id="tc1",
        name="code_graph.callers",
        success=True,
        content="- caller (src/main.c:29)",
        new_evidence_refs=["eref-caller-dangerous_call"],
    )

    catalog.ingest_tool_result(call, result)
    entry = catalog.get("eref-caller-dangerous_call")

    assert entry is not None
    assert entry.category == "caller"
    assert entry.function == "dangerous_call"
    assert entry.file == "src/main.c"
    assert entry.line == 29
    assert not hasattr(catalog, "command_injection_bundle")
    assert not hasattr(catalog, "has_command_injection_signal")


def test_catalog_renders_evidence_refs_from_metadata_entries():
    catalog = EvidenceCatalog()
    catalog.ingest_tool_result(
        ToolCallRequest(id="read1", name="code.read_file", arguments={"path": "src/main.c"}),
        ToolResult(
            tool_call_id="read1",
            name="code.read_file",
            success=True,
            content="int main(void) { return 0; } // src/main.c:1",
            new_evidence_refs=["eref-file-main"],
        ),
    )

    refs = catalog.as_evidence_refs()

    assert refs == [{
        "refId": "eref-file-main",
        "artifactType": "source",
        "locator": {"file": "src/main.c", "line": 1},
    }]
