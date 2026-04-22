from __future__ import annotations

from agent_shared.schemas.agent import ToolCallRequest, ToolResult
from app.core.evidence_catalog import EvidenceCatalog
from app.core.phase_one_types import Phase1Result


def test_catalog_classifies_phase1_command_injection_bundle():
    catalog = EvidenceCatalog()
    catalog.ingest_phase1_result(Phase1Result(
        sast_findings=[{
            "ruleId": "flawfinder:shell/popen",
            "message": "This causes a new program to execute and is difficult to use safely (CWE-78).",
            "location": {"file": "main.cpp", "line": 35},
            "metadata": {"name": "popen", "cweId": "CWE-78", "context": 'FILE *p = popen(cmd.c_str(), "r");'},
        }],
        code_functions=[
            {"name": "run", "file": "main.cpp", "line": 29, "calls": ["fgets", "pclose", "popen"]},
            {"name": "prompt", "file": "main.cpp", "line": 69, "calls": ["getline", "trim"]},
            {"name": "create_ca", "file": "main.cpp", "line": 143, "calls": ["run", "to_string"]},
            {"name": "main", "file": "main.cpp", "line": 257, "calls": ["prompt", "create_ca"]},
        ],
    ))
    catalog.ingest_tool_result(
        ToolCallRequest(id="read1", name="code.read_file", arguments={"path": "main.cpp"}),
        ToolResult(
            tool_call_id="read1",
            name="code.read_file",
            success=True,
            content='std::getline(std::cin, cn); std::string cmd = "openssl -subj /CN=" + cn; FILE *p = popen(cmd.c_str(), "r"); // main.cpp:35',
            new_evidence_refs=["eref-file-main.cpp"],
        ),
    )

    bundle = catalog.command_injection_bundle()

    assert bundle.complete is True
    assert bundle.sink == "popen"
    assert bundle.location == "main.cpp:35"
    assert "eref-sast-flawfinder:shell/popen" in bundle.refs
    assert any(ref.startswith("eref-codefunc-run") for ref in bundle.refs)
    assert any(ref.startswith("eref-caller-create_ca") for ref in bundle.refs)


def test_catalog_ingests_tool_result_semantics():
    catalog = EvidenceCatalog()
    call = ToolCallRequest(
        id="tc1",
        name="code_graph.callers",
        arguments={"function_name": "popen"},
    )
    result = ToolResult(
        tool_call_id="tc1",
        name="code_graph.callers",
        success=True,
        content="- run (main.cpp:29)\n- create_ca (main.cpp:143)",
        new_evidence_refs=["eref-caller-run"],
    )

    catalog.ingest_tool_result(call, result)
    entry = catalog.get("eref-caller-run")

    assert entry is not None
    assert entry.category == "caller"
    assert entry.sink == "popen"
    assert entry.function == "popen"
    assert entry.file == "main.cpp"
    assert entry.line == 29


def test_catalog_requires_source_and_caller_for_complete_bundle():
    catalog = EvidenceCatalog()
    catalog.ingest_phase1_result(Phase1Result(
        sast_findings=[{
            "ruleId": "flawfinder:shell/popen",
            "message": "CWE-78 popen",
            "location": {"file": "main.cpp", "line": 35},
            "metadata": {"name": "popen", "cweId": "CWE-78"},
        }],
        code_functions=[],
    ))

    bundle = catalog.command_injection_bundle()

    assert bundle.complete is False
    assert "caller" in bundle.reason
    assert "user_input_path" in bundle.reason


def test_catalog_does_not_treat_constant_command_popen_as_user_input_path():
    catalog = EvidenceCatalog()
    catalog.ingest_phase1_result(Phase1Result(
        sast_findings=[{
            "ruleId": "flawfinder:shell/popen",
            "message": "CWE-78 popen",
            "location": {"file": "main.cpp", "line": 35},
            "metadata": {"name": "popen", "cweId": "CWE-78"},
        }],
        code_functions=[
            {"name": "run", "file": "main.cpp", "line": 29, "calls": ["popen"]},
            {"name": "banner", "file": "main.cpp", "line": 249, "calls": ["run"]},
        ],
    ))

    bundle = catalog.command_injection_bundle()

    assert bundle.complete is False
    assert "user_input_path" in bundle.reason


def test_catalog_does_not_treat_user_named_caller_as_input_path():
    catalog = EvidenceCatalog()
    catalog.ingest_phase1_result(Phase1Result(
        sast_findings=[{
            "ruleId": "flawfinder:shell/popen",
            "message": "CWE-78 popen",
            "location": {"file": "main.cpp", "line": 35},
            "metadata": {"name": "popen", "cweId": "CWE-78"},
        }],
        code_functions=[
            {"name": "run", "file": "main.cpp", "line": 29, "calls": ["popen"]},
            {"name": "user_status", "file": "main.cpp", "line": 80, "calls": ["run"]},
            {"name": "input_status", "file": "main.cpp", "line": 88, "calls": ["run"]},
        ],
    ))

    bundle = catalog.command_injection_bundle()

    assert bundle.complete is False
    assert "user_input_path" in bundle.reason


def test_catalog_requires_input_path_connected_to_sink_path():
    catalog = EvidenceCatalog()
    catalog.ingest_phase1_result(Phase1Result(
        sast_findings=[{
            "ruleId": "flawfinder:shell/popen",
            "message": "CWE-78 popen",
            "location": {"file": "main.cpp", "line": 35},
            "metadata": {"name": "popen", "cweId": "CWE-78"},
        }],
        code_functions=[
            {"name": "run", "file": "main.cpp", "line": 29, "calls": ["popen"]},
            {"name": "banner", "file": "main.cpp", "line": 249, "calls": ["run"]},
            {"name": "prompt", "file": "main.cpp", "line": 69, "calls": ["getline"]},
            {"name": "main", "file": "main.cpp", "line": 257, "calls": ["prompt"]},
        ],
    ))

    bundle = catalog.command_injection_bundle()

    assert bundle.complete is False
    assert "user_input_path" in bundle.reason


def test_catalog_includes_same_path_source_ref_that_proves_input_path():
    catalog = EvidenceCatalog()
    catalog.ingest_phase1_result(Phase1Result(
        sast_findings=[{
            "ruleId": "flawfinder:shell/popen",
            "message": "CWE-78 popen",
            "location": {"file": "main.cpp", "line": 35},
            "metadata": {"name": "popen", "cweId": "CWE-78"},
        }],
        code_functions=[
            {"name": "run", "file": "main.cpp", "line": 29, "calls": ["popen"]},
            {"name": "create_ca", "file": "main.cpp", "line": 143, "calls": ["run"]},
        ],
    ))
    for i in range(4):
        catalog.ingest_tool_result(
            ToolCallRequest(id=f"read-unrelated-{i}", name="code.read_file", arguments={"path": f"unrelated{i}.cpp"}),
            ToolResult(
                tool_call_id=f"read-unrelated-{i}",
                name="code.read_file",
                success=True,
                content=f'std::string cmd = "openssl version"; FILE *p = popen(cmd.c_str(), "r"); // unrelated{i}.cpp:10',
                new_evidence_refs=[f"eref-file-unrelated-{i}"],
            ),
        )
    catalog.ingest_tool_result(
        ToolCallRequest(id="read-main", name="code.read_file", arguments={"path": "main.cpp"}),
        ToolResult(
            tool_call_id="read-main",
            name="code.read_file",
            success=True,
            content='std::getline(std::cin, cn); std::string cmd = "openssl -subj /CN=" + cn; FILE *p = popen(cmd.c_str(), "r"); // main.cpp:35',
            new_evidence_refs=["eref-file-main.cpp"],
        ),
    )

    bundle = catalog.command_injection_bundle()

    assert bundle.complete is True
    assert "eref-file-main.cpp" in bundle.refs


def test_catalog_requires_separate_source_leg_beyond_sast():
    catalog = EvidenceCatalog()
    catalog.ingest_phase1_result(Phase1Result(
        sast_findings=[{
            "ruleId": "flawfinder:shell/popen",
            "message": "CWE-78 popen",
            "location": {"file": "main.cpp", "line": 35},
            "metadata": {"name": "popen", "cweId": "CWE-78"},
        }],
        code_functions=[
            {"name": "prompt", "file": "main.cpp", "line": 69, "calls": ["getline"]},
            {"name": "create_ca", "file": "main.cpp", "line": 143, "calls": ["run"]},
        ],
    ))

    bundle = catalog.command_injection_bundle()

    assert bundle.complete is False
    assert "source" in bundle.reason


def test_catalog_rejects_unrelated_file_category_presence_as_complete_bundle():
    catalog = EvidenceCatalog()
    catalog.ingest_phase1_result(Phase1Result(
        sast_findings=[{
            "ruleId": "flawfinder:shell/popen",
            "message": "CWE-78 popen",
            "location": {"file": "main.cpp", "line": 35},
            "metadata": {"name": "popen", "cweId": "CWE-78"},
        }],
        code_functions=[
            {"name": "run", "file": "source.cpp", "line": 29, "calls": ["popen"]},
            {"name": "create_ca", "file": "caller.cpp", "line": 143, "calls": ["run"]},
        ],
    ))
    catalog.ingest_tool_result(
        ToolCallRequest(id="read-third", name="code.read_file", arguments={"path": "third.cpp"}),
        ToolResult(
            tool_call_id="read-third",
            name="code.read_file",
            success=True,
            content='std::getline(std::cin, cn); std::string cmd = "openssl -subj /CN=" + cn; FILE *p = popen(cmd.c_str(), "r"); // third.cpp:35',
            new_evidence_refs=["eref-file-third.cpp"],
        ),
    )

    bundle = catalog.command_injection_bundle()

    assert bundle.complete is False
    assert "coherent_path" in bundle.reason


def test_catalog_rejects_source_and_caller_coherent_on_non_sast_file():
    catalog = EvidenceCatalog()
    catalog.ingest_phase1_result(Phase1Result(
        sast_findings=[{
            "ruleId": "flawfinder:shell/popen",
            "message": "CWE-78 popen",
            "location": {"file": "main.cpp", "line": 35},
            "metadata": {"name": "popen", "cweId": "CWE-78"},
        }],
        code_functions=[
            {"name": "run", "file": "third.cpp", "line": 29, "calls": ["popen"]},
            {"name": "create_ca", "file": "third.cpp", "line": 143, "calls": ["run"]},
        ],
    ))
    catalog.ingest_tool_result(
        ToolCallRequest(id="read-third", name="code.read_file", arguments={"path": "third.cpp"}),
        ToolResult(
            tool_call_id="read-third",
            name="code.read_file",
            success=True,
            content='std::getline(std::cin, cn); std::string cmd = "openssl -subj /CN=" + cn; FILE *p = popen(cmd.c_str(), "r"); // third.cpp:35',
            new_evidence_refs=["eref-file-third.cpp"],
        ),
    )

    bundle = catalog.command_injection_bundle()

    assert bundle.complete is False
    assert "coherent_path" in bundle.reason


def test_catalog_treats_exec_sink_as_command_injection_bundle():
    catalog = EvidenceCatalog()
    catalog.ingest_phase1_result(Phase1Result(
        sast_findings=[{
            "ruleId": "flawfinder:shell/exec",
            "message": "CWE-78 exec sink",
            "location": {"file": "main.cpp", "line": 40},
            "metadata": {"name": "exec", "cweId": "CWE-78"},
        }],
        code_functions=[
            {"name": "run", "file": "main.cpp", "line": 29, "calls": ["exec"]},
            {"name": "create_ca", "file": "main.cpp", "line": 143, "calls": ["run"]},
        ],
    ))
    catalog.ingest_tool_result(
        ToolCallRequest(id="read-main", name="code.read_file", arguments={"path": "main.cpp"}),
        ToolResult(
            tool_call_id="read-main",
            name="code.read_file",
            success=True,
            content='std::getline(std::cin, cn); std::string cmd = "openssl -subj /CN=" + cn; exec(cmd.c_str()); // main.cpp:40',
            new_evidence_refs=["eref-file-main.cpp"],
        ),
    )

    bundle = catalog.command_injection_bundle()

    assert bundle.complete is True
    assert bundle.sink == "exec"
