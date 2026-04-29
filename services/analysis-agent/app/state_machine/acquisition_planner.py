from __future__ import annotations

import json
import re
from dataclasses import dataclass

from app.core.evidence_catalog import EvidenceCatalog
from app.schemas.response import Claim
from app.types import ClaimStatus


@dataclass(frozen=True)
class PlannedAction:
    tool_name: str
    arguments: dict
    rationale: str
    target_slot: str

    @property
    def dedup_key(self) -> str:
        args = json.dumps(self.arguments, sort_keys=True, ensure_ascii=False)
        return f"{self.tool_name}:{args}"


def plan_next_action(
    claim: Claim,
    available_tools: set[str],
    used_actions: set[str],
    *,
    catalog: EvidenceCatalog | None = None,
) -> PlannedAction | None:
    """Suggest one deterministic evidence acquisition action for an under-evidenced claim."""
    if claim.status != ClaimStatus.UNDER_EVIDENCED:
        return None

    for slot in claim.missingEvidence:
        action = _plan_for_slot(claim, slot, available_tools, catalog=catalog)
        if action is None:
            continue
        if action.dedup_key in used_actions:
            continue
        return action
    return None


def _plan_for_slot(
    claim: Claim,
    slot: str,
    available_tools: set[str],
    *,
    catalog: EvidenceCatalog | None,
) -> PlannedAction | None:
    normalized = slot.lower()
    if normalized in {"threat_knowledge", "knowledge_context", "exploitability_condition"}:
        if "knowledge.search" not in available_tools:
            return None
        return PlannedAction(
            tool_name="knowledge.search",
            arguments={"query": _knowledge_query(claim), "top_k": 5},
            rationale=f"Acquire knowledge context for missing evidence slot `{slot}`.",
            target_slot=slot,
        )
    if normalized in {"caller_chain", "caller_path"}:
        if "code_graph.callers" not in available_tools:
            return None
        function = _function_from_claim_or_catalog(claim, catalog)
        if not function:
            return None
        return PlannedAction(
            tool_name="code_graph.callers",
            arguments={"function_name": function},
            rationale=f"Acquire caller chain for `{function}`.",
            target_slot=slot,
        )
    if normalized in {"callee_chain", "callee_path"}:
        if "code_graph.callees" not in available_tools:
            return None
        function = _function_from_claim_or_catalog(claim, catalog)
        if not function:
            return None
        return PlannedAction(
            tool_name="code_graph.callees",
            arguments={"function_name": function},
            rationale=f"Acquire callee chain for `{function}`.",
            target_slot=slot,
        )
    if normalized == "source_slice":
        if "code.read_file" not in available_tools:
            return None
        file_path = _file_from_claim_or_catalog(claim, catalog)
        if not file_path:
            return None
        return PlannedAction(
            tool_name="code.read_file",
            arguments={"path": file_path},
            rationale=f"Read source slice for missing evidence slot `{slot}`.",
            target_slot=slot,
        )
    if normalized == "sast_finding" and "sast.scan" in available_tools:
        return PlannedAction(
            tool_name="sast.scan",
            arguments={},
            rationale="Acquire deterministic SAST finding evidence.",
            target_slot=slot,
        )
    return None


def _knowledge_query(claim: Claim) -> str:
    text = " ".join(part or "" for part in (claim.statement, claim.detail))
    match = re.search(r"CWE-\d+", text, flags=re.IGNORECASE)
    if match:
        return match.group(0).upper()
    if claim.requiredEvidence:
        return f"{claim.statement} {' '.join(claim.requiredEvidence)}".strip()
    return claim.statement or "vulnerability evidence"


def _function_from_claim_or_catalog(claim: Claim, catalog: EvidenceCatalog | None) -> str | None:
    for value in (claim.location, claim.statement, claim.detail):
        if not value:
            continue
        match = re.search(r"\bfunction[:=]\s*([A-Za-z_][\w:]*)", value)
        if match:
            return match.group(1)
    if catalog is None:
        return None
    for ref_id in claim.supportingEvidenceRefs:
        entry = catalog.get(ref_id)
        if entry and entry.function:
            return entry.function
    return None


def _file_from_claim_or_catalog(claim: Claim, catalog: EvidenceCatalog | None) -> str | None:
    if claim.location:
        match = re.search(r"([\w./-]+\.(?:c|cc|cpp|cxx|h|hpp))", claim.location)
        if match:
            return match.group(1)
    if catalog is None:
        return None
    for ref_id in claim.supportingEvidenceRefs:
        entry = catalog.get(ref_id)
        if entry and entry.file:
            return entry.file
    return None
