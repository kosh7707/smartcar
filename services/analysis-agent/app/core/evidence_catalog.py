"""Evidence catalog for S3 evidence-ref metadata."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from dataclasses import field
from typing import Literal

from app.agent_runtime.schemas.agent import ToolCallRequest, ToolResult
from app.core.phase_one_types import Phase1Result
from app.schemas.request import EvidenceRef, TaskRequest

EvidenceCategory = Literal[
    "sast",
    "source",
    "caller",
    "callee",
    "knowledge",
    "metadata",
    "request",
    "unknown",
]

EvidenceClass = Literal["local", "knowledge", "derived", "operational", "unclassified"]

_SINK_PATTERNS = {
    "access": r"\baccess\b",
    "alloca": r"\balloca\b",
    "exec": r"\bexec(?:ve|v|le|lp|l|p)?\b",
    "getenv": r"\bgetenv\b",
    "gets": r"\bgets\b",
    "memcpy": r"\bmemcpy\b",
    "memmove": r"\bmemmove\b",
    "mkstemp": r"\bmkstemp\b",
    "mktemp": r"\bmktemp\b",
    "popen": r"\bpopen\b",
    "readlink": r"\breadlink\b",
    "scanf": r"\bscanf\b",
    "sprintf": r"\bsprintf\b",
    "strcat": r"\bstrcat\b",
    "strcpy": r"\bstrcpy\b",
    "system": r"\bsystem\b",
}


@dataclass(frozen=True)
class EvidenceCatalogEntry:
    ref_id: str
    category: EvidenceCategory = "unknown"
    source_tool: str | None = None
    tool_arguments: dict | None = None
    artifact_type: str | None = None
    file: str | None = None
    line: int | None = None
    function: str | None = None
    sink: str | None = None
    rule_id: str | None = None
    cwe_id: str | None = None
    summary: str | None = None
    callees: tuple[str, ...] = field(default_factory=tuple)
    evidence_class: EvidenceClass = "unclassified"
    roles: tuple[str, ...] = field(default_factory=tuple)
    source_local_refs: tuple[str, ...] = field(default_factory=tuple)
    origin_service: str | None = None
    operational_status: str | None = None
    project_id: str | None = None
    revision: str | None = None
    build_snapshot: str | None = None

    @property
    def can_support_claim(self) -> bool:
        if self.evidence_class == "local":
            return True
        if self.evidence_class == "derived" and self.source_local_refs:
            return True
        return False


class EvidenceCatalog:
    """Append-only evidence metadata indexed by refId."""

    def __init__(self) -> None:
        self._entries: dict[str, EvidenceCatalogEntry] = {}

    def add(self, entry: EvidenceCatalogEntry) -> None:
        if not entry.ref_id:
            return
        self._entries[entry.ref_id] = entry

    def entries(self) -> list[EvidenceCatalogEntry]:
        return list(self._entries.values())

    def ref_ids(self) -> list[str]:
        return list(self._entries)

    def get(self, ref_id: str) -> EvidenceCatalogEntry | None:
        return self._entries.get(ref_id)

    def final_ref_ids(self) -> set[str]:
        return {entry.ref_id for entry in self.entries() if entry.can_support_claim}

    def contextual_ref_ids(self) -> set[str]:
        return {entry.ref_id for entry in self.entries() if entry.evidence_class == "knowledge"}

    def unclassified_ref_ids(self) -> set[str]:
        return {entry.ref_id for entry in self.entries() if entry.evidence_class == "unclassified"}

    def local_ref_ids(self) -> set[str]:
        return {entry.ref_id for entry in self.entries() if entry.evidence_class == "local"}

    def ingest_request(self, request: TaskRequest) -> None:
        for ref in request.evidenceRefs:
            self.add(_entry_from_request_ref(ref))

    def ingest_phase1_result(self, result: Phase1Result) -> None:
        for index, finding in enumerate(result.sast_findings):
            self.add(_entry_from_sast_finding(finding, index))

        for index, caller in enumerate(result.dangerous_callers):
            self.add(_entry_from_dangerous_caller(caller, index))

    def ingest_tool_result(self, call: ToolCallRequest, result: ToolResult) -> None:
        for ref_id in result.new_evidence_refs:
            self.add(_entry_from_tool_result(call, result, ref_id))

    def as_evidence_refs(self) -> list[dict]:
        refs: list[dict] = []
        for entry in self.entries():
            locator: dict = {}
            if entry.file:
                locator["file"] = entry.file
            if entry.line:
                locator["line"] = entry.line
            refs.append({
                "refId": entry.ref_id,
                "artifactType": entry.artifact_type or entry.category,
                "locator": locator,
            })
        return refs



def _entry_from_request_ref(ref: EvidenceRef) -> EvidenceCatalogEntry:
    locator = ref.locator if isinstance(ref.locator, dict) else {}
    return EvidenceCatalogEntry(
        ref_id=ref.refId,
        category="request",
        artifact_type=ref.artifactType,
        file=_str_or_none(locator.get("file") or locator.get("path")),
        line=_int_or_none(locator.get("line") or locator.get("startLine") or locator.get("fromLine")),
        summary=f"request evidence {ref.refId}",
        evidence_class=_class_from_request_ref(ref),
        roles=_roles_from_request_ref(ref),
        origin_service="request",
    )


def _entry_from_sast_finding(finding: dict, index: int) -> EvidenceCatalogEntry:
    metadata = finding.get("metadata", {}) if isinstance(finding, dict) else {}
    loc = finding.get("location", {}) if isinstance(finding, dict) else {}
    rule_id = _str_or_none(finding.get("ruleId")) or f"finding-{index}"
    ref_id = f"eref-sast-{rule_id}"
    cwe = _str_or_none(metadata.get("cweId"))
    if not cwe:
        raw_cwes = metadata.get("cwe")
        if isinstance(raw_cwes, list) and raw_cwes:
            cwe = _str_or_none(raw_cwes[0])
    sink = _infer_sink(" ".join([
        str(rule_id),
        str(finding.get("message", "")),
        str(metadata.get("name", "")),
        str(metadata.get("context", "")),
    ]))
    return EvidenceCatalogEntry(
        ref_id=ref_id,
        category="sast",
        artifact_type="sast-finding",
        file=_str_or_none(loc.get("file")),
        line=_int_or_none(loc.get("line")),
        sink=sink,
        rule_id=rule_id,
        cwe_id=cwe,
        summary=_truncate(f"{finding.get('message', '')} {metadata.get('context', '')}"),
        evidence_class="local",
        roles=tuple(role for role in ("sast_finding", "source_location" if loc.get("file") else "", "sink_or_dangerous_api" if sink else "") if role),
        origin_service="s4",
    )



def _entry_from_dangerous_caller(caller: dict, index: int) -> EvidenceCatalogEntry:
    name = _str_or_none(caller.get("name") or caller.get("function")) or f"caller-{index}"
    file = _str_or_none(caller.get("file"))
    line = _int_or_none(caller.get("line"))
    return EvidenceCatalogEntry(
        ref_id=_safe_ref_id(f"eref-caller-{name}-{file or 'unknown'}-{line or index}"),
        category="caller",
        artifact_type="code-graph",
        file=file,
        line=line,
        function=name,
        sink=_infer_sink(json.dumps(caller, ensure_ascii=False)),
        summary=_truncate(json.dumps(caller, ensure_ascii=False)),
        evidence_class="local",
        roles=("caller_chain", "function_symbol"),
        origin_service="s5",
    )


def _entry_from_tool_result(call: ToolCallRequest, result: ToolResult, ref_id: str) -> EvidenceCatalogEntry:
    content = result.content or ""
    category: EvidenceCategory = "unknown"
    if call.name == "code_graph.callers":
        category = "caller"
    elif call.name in {"code_graph.callees", "code_graph.search"}:
        category = "callee"
    elif call.name == "code.read_file":
        category = "source"
    elif call.name == "knowledge.search":
        category = "knowledge"
    elif call.name == "build.metadata":
        category = "metadata"
    elif call.name == "sast.scan":
        category = "sast"

    file, line = _extract_file_line(content)
    sink = _infer_sink(" ".join([call.name, json.dumps(call.arguments, ensure_ascii=False), content]))
    cwe = _extract_cwe(content)
    evidence_class, roles = _class_and_roles_from_tool(call.name, category, file=file, sink=sink)
    return EvidenceCatalogEntry(
        ref_id=ref_id,
        category=category,
        source_tool=call.name,
        tool_arguments=dict(call.arguments),
        artifact_type=category,
        file=file,
        line=line,
        function=_str_or_none(call.arguments.get("function_name") or call.arguments.get("function")),
        sink=sink,
        cwe_id=cwe,
        summary=_truncate(content),
        evidence_class=evidence_class,
        roles=roles,
        origin_service=_origin_from_tool(call.name),
    )


def _class_from_request_ref(ref: EvidenceRef) -> EvidenceClass:
    artifact = (ref.artifactType or "").lower()
    locator = ref.locator if isinstance(ref.locator, dict) else {}
    if any(token in artifact for token in ("cwe", "cve", "capec", "attack", "knowledge", "threat")):
        return "knowledge"
    if any(token in artifact for token in ("request", "objective", "constraint")):
        return "operational"
    if any(token in artifact for token in ("sast", "source", "file", "function", "build", "artifact")):
        return "local"
    if locator.get("file") or locator.get("path") or locator.get("line"):
        return "local"
    return "unclassified"


def _roles_from_request_ref(ref: EvidenceRef) -> tuple[str, ...]:
    artifact = (ref.artifactType or "").lower()
    roles: list[str] = []
    if "sast" in artifact:
        roles.append("sast_finding")
    if "source" in artifact or "file" in artifact:
        roles.append("source_location")
    if "build" in artifact:
        roles.append("build_context")
    if any(token in artifact for token in ("cwe", "cve", "capec", "attack", "knowledge", "threat")):
        roles.append("knowledge_context")
    return tuple(dict.fromkeys(roles))


def _class_and_roles_from_tool(
    tool_name: str,
    category: EvidenceCategory,
    *,
    file: str | None,
    sink: str | None,
) -> tuple[EvidenceClass, tuple[str, ...]]:
    if category == "knowledge":
        return "knowledge", ("knowledge_context",)
    if category in {"sast", "source", "caller", "callee"}:
        roles: list[str] = []
        if category == "sast":
            roles.append("sast_finding")
        if file:
            roles.append("source_location")
        if category == "source":
            roles.append("source_slice")
        if category == "caller":
            roles.append("caller_chain")
        if category == "callee" or sink:
            roles.append("sink_or_dangerous_api")
        return "local", tuple(dict.fromkeys(roles))
    if category == "metadata":
        return "local", ("build_context", "target_metadata")
    return "unclassified", ()


def _origin_from_tool(tool_name: str) -> str | None:
    if tool_name.startswith("code_graph") or tool_name == "knowledge.search":
        return "s5"
    if tool_name in {"sast.scan", "build.metadata"}:
        return "s4"
    if tool_name == "code.read_file":
        return "s3"
    return None


def _infer_sink(text: str) -> str | None:
    lowered = text.lower()
    for sink, pattern in _SINK_PATTERNS.items():
        if re.search(pattern, lowered):
            return sink
    return None


def _extract_cwe(text: str) -> str | None:
    match = re.search(r"CWE-\\d+", text)
    return match.group(0) if match else None


def _extract_file_line(text: str) -> tuple[str | None, int | None]:
    match = re.search(r"([\w./-]+\.(?:c|cc|cpp|cxx|h|hpp)):(\d+)", text)
    if not match:
        return None, None
    return match.group(1), int(match.group(2))


def _safe_ref_id(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.:/-]+", "-", value).strip("-")


def _str_or_none(value) -> str | None:
    return value if isinstance(value, str) and value else None


def _int_or_none(value) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _truncate(value: str, limit: int = 1200) -> str:
    return value[:limit]
