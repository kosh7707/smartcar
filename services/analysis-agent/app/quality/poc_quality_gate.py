from __future__ import annotations

import ast
import base64
import re

from app.schemas.response import Claim, QualityGateItem, QualityGateResult
from app.types import QualityOutcome

_UNSAFE_MARKERS = (
    "rm -rf",
    "format disk",
    "delete all",
    "exfiltrate",
    "무차별 삭제",
    "curl | sh",
    "wget | sh",
    "mkfs",
    "dd if=",
)
_SHELL_ESCAPE_MARKERS = (
    "shell=true",
    "sh -c",
    "bash -c",
    "base64 -d",
    "base64 --decode",
    "eval(",
)
_BASE64_LIKELY = re.compile(
    r"(?<![A-Za-z0-9+/_=-])([A-Za-z0-9+/_-]{8,}={0,2})(?![A-Za-z0-9+/_=-])"
)
_QUOTE_ESCAPE_MARKERS = ("$(", "$ifs", "${ifs}")
_BACKTICK_ESCAPE = re.compile(
    r"`[^`]*(?:[$;&|]|\b(?:base64|bash|curl|eval|rm|sh|wget)\b)[^`]*`",
    flags=re.IGNORECASE,
)
_COMMAND_INJECTION_MARKERS = (
    "popen",
    "system(",
    "command injection",
    "cwe-78",
    "shell command",
)


def evaluate_poc_quality(
    *,
    claims: list[Claim],
    caveats: list[str] | None = None,
) -> QualityGateResult:
    """Classify PoC consumability/safety without fabricating exploit success."""
    caveats = caveats or []
    if not claims:
        return QualityGateResult(
            outcome=QualityOutcome.REJECTED,
            failedItems=[QualityGateItem(
                id="poc-claim-bound",
                repairable=True,
                requiredEvidenceSlots=["claim-bound PoC detail"],
                detail="PoC output did not include a structured claim.",
            )],
            repairHint="Return at least one structured claim whose detail contains a non-destructive PoC bound to the input claim.",
            caveats=caveats,
        )

    raw_detail_blob = " ".join([claim.detail or "" for claim in claims] + caveats)
    detail_blob = raw_detail_blob.lower()
    if any(marker in detail_blob for marker in _UNSAFE_MARKERS):
        return QualityGateResult(
            outcome=QualityOutcome.REJECTED,
            failedItems=[QualityGateItem(
                id="poc-safety",
                repairable=False,
                requiredEvidenceSlots=["non-destructive reproduction steps"],
                detail="PoC contains potentially destructive instructions.",
            )],
            repairHint="Remove destructive instructions and replace them with harmless validation such as a randomized echo/canary.",
            caveats=caveats,
        )

    decoded_chunks = _decoded_base64_chunks(raw_detail_blob)
    if (
        decoded_chunks
        or any(marker in detail_blob for marker in _SHELL_ESCAPE_MARKERS)
        or _quote_escape_present(detail_blob)
        or _contains_destructive_python_call(detail_blob)
    ):
        return QualityGateResult(
            outcome=QualityOutcome.REJECTED,
            failedItems=[QualityGateItem(
                id="poc-structural-safety",
                repairable=False,
                requiredEvidenceSlots=["non-shell, non-destructive execution path"],
                detail="PoC uses shell/base64/quote-escape/eval/destructive execution structure.",
            )],
            repairHint="Avoid encoded payloads, quote escapes, eval, shell=True, and shell wrapper patterns; express the PoC as explicit non-destructive steps.",
            caveats=caveats,
        )

    if any(marker in detail_blob for marker in _COMMAND_INJECTION_MARKERS) and "canary" not in detail_blob:
        return QualityGateResult(
            outcome=QualityOutcome.REJECTED,
            failedItems=[QualityGateItem(
                id="poc-randomized-canary",
                repairable=True,
                requiredEvidenceSlots=["randomized non-destructive canary"],
                detail="Command-injection PoC must include a randomized non-destructive canary.",
            )],
            repairHint="Add a randomized non-destructive canary and describe how observing that canary proves reachability without running harmful commands.",
            caveats=caveats,
        )

    if caveats:
        return QualityGateResult(
            outcome=QualityOutcome.ACCEPTED_WITH_CAVEATS,
            caveats=caveats,
        )

    return QualityGateResult(outcome=QualityOutcome.ACCEPTED, caveats=caveats)


def _contains_destructive_python_call(text: str) -> bool:
    code_blocks = re.findall(r"```(?:python)?\s*(.*?)```", text, flags=re.DOTALL)
    for block in code_blocks:
        try:
            tree = ast.parse(block)
        except SyntaxError:
            continue
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                name = _call_name(node.func)
                if name in {
                    "os.system",
                    "subprocess.call",
                    "subprocess.run",
                    "subprocess.Popen",
                }:
                    for keyword in node.keywords:
                        if keyword.arg == "shell" and isinstance(keyword.value, ast.Constant) and keyword.value.value is True:
                            return True
                    for arg in node.args:
                        if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                            lowered = arg.value.lower()
                            if any(
                                marker in lowered
                                for marker in _UNSAFE_MARKERS + _SHELL_ESCAPE_MARKERS
                            ):
                                return True
    return False


def _decoded_base64_chunks(text: str) -> list[str]:
    chunks: list[str] = []
    for token in _BASE64_LIKELY.findall(text):
        normalized = token.strip()
        if len(normalized) < 8:
            continue
        padding = "=" * (-len(normalized) % 4)
        try:
            decoded = base64.b64decode(
                (normalized + padding).encode("ascii"),
                altchars=b"-_",
                validate=False,
            ).decode("utf-8", errors="ignore")
        except Exception:
            continue
        lowered = decoded.lower()
        if any(marker in lowered for marker in _UNSAFE_MARKERS + _SHELL_ESCAPE_MARKERS):
            chunks.append(decoded)
    return chunks


def _quote_escape_present(text: str) -> bool:
    lowered = text.lower()
    return any(marker in lowered for marker in _QUOTE_ESCAPE_MARKERS) or bool(_BACKTICK_ESCAPE.search(text))


def _call_name(node: ast.AST) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        parent = _call_name(node.value)
        return f"{parent}.{node.attr}" if parent else node.attr
    return ""
