from __future__ import annotations

from app.core.evidence_catalog import EvidenceCatalog, EvidenceCatalogEntry
from app.schemas.response import Claim
from app.state_machine.acquisition_planner import plan_next_action
from app.types import ClaimStatus


def test_route_threat_knowledge_to_knowledge_search():
    claim = Claim(
        statement="CWE-78 command injection",
        detail="needs threat context",
        status=ClaimStatus.UNDER_EVIDENCED,
        missingEvidence=["threat_knowledge"],
    )

    action = plan_next_action(claim, {"knowledge.search"}, set())

    assert action is not None
    assert action.tool_name == "knowledge.search"
    assert action.arguments == {"query": "CWE-78", "top_k": 5}
    assert action.target_slot == "threat_knowledge"


def test_route_caller_chain_only_with_resolvable_function():
    claim = Claim(
        statement="popen sink",
        detail="caller chain missing",
        location="main.cpp:35",
        status=ClaimStatus.UNDER_EVIDENCED,
        missingEvidence=["caller_chain"],
    )

    assert plan_next_action(claim, {"code_graph.callers"}, set()) is None

    catalog = EvidenceCatalog()
    catalog.add(EvidenceCatalogEntry(
        ref_id="eref-local-function",
        evidence_class="local",
        function="run_command",
    ))
    claim.supportingEvidenceRefs.append("eref-local-function")

    action = plan_next_action(claim, {"code_graph.callers"}, set(), catalog=catalog)

    assert action is not None
    assert action.tool_name == "code_graph.callers"
    assert action.arguments == {"function_name": "run_command"}


def test_callee_path_routes_to_code_graph_callees():
    catalog = EvidenceCatalog()
    catalog.add(EvidenceCatalogEntry(
        ref_id="eref-local-function",
        evidence_class="local",
        function="validate_request",
    ))
    claim = Claim(
        statement="validation callee path missing",
        detail="function: validate_request should call safe helpers",
        supportingEvidenceRefs=["eref-local-function"],
        status=ClaimStatus.UNDER_EVIDENCED,
        missingEvidence=["callee_path"],
    )

    action = plan_next_action(claim, {"code_graph.callees"}, set(), catalog=catalog)

    assert action is not None
    assert action.tool_name == "code_graph.callees"
    assert action.arguments == {"function_name": "validate_request"}
    assert action.target_slot == "callee_path"


def test_callee_path_no_action_without_callees_tool():
    claim = Claim(
        statement="function: validate_request",
        status=ClaimStatus.UNDER_EVIDENCED,
        missingEvidence=["callee_path"],
    )

    assert plan_next_action(claim, {"code_graph.callers"}, set()) is None


def test_unavailable_tool_filters_out_action():
    claim = Claim(
        statement="CWE-78 command injection",
        status=ClaimStatus.UNDER_EVIDENCED,
        missingEvidence=["threat_knowledge"],
    )

    assert plan_next_action(claim, set(), set()) is None


def test_dedup_avoids_repeated_identical_action():
    claim = Claim(
        statement="CWE-78 command injection",
        status=ClaimStatus.UNDER_EVIDENCED,
        missingEvidence=["threat_knowledge"],
    )
    first = plan_next_action(claim, {"knowledge.search"}, set())

    assert first is not None
    assert plan_next_action(claim, {"knowledge.search"}, {first.dedup_key}) is None


def test_candidate_claim_without_transition_gets_no_plan():
    claim = Claim(
        statement="CWE-78 command injection",
        status=ClaimStatus.CANDIDATE,
        missingEvidence=[],
    )

    assert plan_next_action(claim, {"knowledge.search"}, set()) is None


def test_needs_human_review_claim_gets_no_automatic_plan_even_with_missing_evidence():
    claim = Claim(
        statement="CWE-78 command injection",
        status=ClaimStatus.NEEDS_HUMAN_REVIEW,
        missingEvidence=["threat_knowledge"],
    )

    assert plan_next_action(claim, {"knowledge.search"}, set()) is None
