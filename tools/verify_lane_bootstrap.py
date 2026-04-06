#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BOOTSTRAP_DOC = ROOT / "docs" / "AEGIS.md"
START_MARKER = "<!-- LANE_BOOTSTRAP_MAP:START -->"
END_MARKER = "<!-- LANE_BOOTSTRAP_MAP:END -->"
EXPECTED_LANES = ["S1", "S1-QA", "S2", "S3", "S4", "S5", "S6", "S7"]


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    sys.exit(1)


def extract_map(text: str) -> dict:
    pattern = re.compile(
        re.escape(START_MARKER) + r"\s*```json\s*(\{.*?\})\s*```\s*" + re.escape(END_MARKER),
        re.S,
    )
    match = pattern.search(text)
    if not match:
        fail("lane bootstrap JSON map markers missing from docs/AEGIS.md")
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError as exc:
        fail(f"lane bootstrap JSON map invalid: {exc}")


def main() -> None:
    if not BOOTSTRAP_DOC.exists():
        fail("docs/AEGIS.md missing")

    text = BOOTSTRAP_DOC.read_text(encoding="utf-8")
    data = extract_map(text)
    if data.get("precedence_rule") != "last-token-wins":
        fail("precedence_rule must be last-token-wins")
    if data.get("idempotent_on_same_lane") is not True:
        fail("idempotent_on_same_lane must be true")

    lanes = data.get("lanes")
    if not isinstance(lanes, dict):
        fail("lanes map missing")

    for lane in EXPECTED_LANES:
        if lane not in lanes:
            fail(f"missing lane entry: {lane}")
        entry = lanes[lane]
        handoff = entry.get("wiki_handoff")
        if not handoff:
            fail(f"{lane} missing wiki_handoff")
        if not Path(handoff).exists():
            fail(f"{lane} wiki_handoff does not exist: {handoff}")
        owned = entry.get("owned_code_paths", [])
        if not isinstance(owned, list):
            fail(f"{lane} owned_code_paths must be a list")
        for owned_path in owned:
            if not Path(owned_path).exists():
                fail(f"{lane} owned code path does not exist: {owned_path}")
    for needle in [
        "Read this file first.",
        "the last explicit lane token wins",
        "suppress duplicate bootstrap work",
        "If no lane is declared, do not force a lane bootstrap.",
    ]:
        if needle not in text:
            fail(f"docs/AEGIS.md missing routing rule: {needle}")

    print("PASS: lane bootstrap router is explicit, deterministic, and points to existing targets")


if __name__ == "__main__":
    main()
