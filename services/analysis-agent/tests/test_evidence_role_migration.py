from app.agent_runtime.schemas.agent import ToolCallRequest, ToolResult
from app.core.evidence_catalog import EvidenceCatalog, EvidenceCatalogEntry
from app.validators.evidence_validator import EvidenceValidator


def test_knowledge_ref_is_contextual_and_rejected_as_claim_support():
    catalog = EvidenceCatalog()
    catalog.ingest_tool_result(
        ToolCallRequest(id="k1", name="knowledge.search", arguments={"query": "CWE-78"}),
        ToolResult(tool_call_id="k1", name="knowledge.search", success=True, content="CWE background", new_evidence_refs=["eref-knowledge-CWE-78"]),
    )
    parsed = {
        "usedEvidenceRefs": ["eref-knowledge-CWE-78"],
        "claims": [{"supportingEvidenceRefs": ["eref-knowledge-CWE-78"]}],
    }

    valid, errors = EvidenceValidator().validate(
        parsed,
        {"eref-knowledge-CWE-78"},
        evidence_catalog=catalog,
    )

    assert valid is False
    assert any("local/derived-local이 아닌 refId" in error for error in errors)


def test_derived_ref_requires_source_local_refs_to_support_claim():
    catalog = EvidenceCatalog()
    catalog.add(EvidenceCatalogEntry(ref_id="eref-derived-missing", evidence_class="derived"))
    catalog.add(EvidenceCatalogEntry(
        ref_id="eref-derived-local",
        evidence_class="derived",
        source_local_refs=("eref-source-main",),
    ))
    parsed = {
        "usedEvidenceRefs": ["eref-derived-local"],
        "claims": [{"supportingEvidenceRefs": ["eref-derived-local"]}],
    }

    valid, errors = EvidenceValidator().validate(
        parsed,
        {"eref-derived-missing", "eref-derived-local"},
        evidence_catalog=catalog,
    )

    assert valid is True
    assert errors == []

    parsed["claims"][0]["supportingEvidenceRefs"] = ["eref-derived-missing"]
    parsed["usedEvidenceRefs"] = ["eref-derived-missing"]
    valid, errors = EvidenceValidator().validate(
        parsed,
        {"eref-derived-missing", "eref-derived-local"},
        evidence_catalog=catalog,
    )

    assert valid is False
    assert "eref-derived-missing" in "; ".join(errors)
