"""Aggregate per-variant summaries into one comparison table."""
from __future__ import annotations

import json
from pathlib import Path

PROBE_DIR = Path(__file__).resolve().parent
RUNS_DIR = PROBE_DIR / "runs"

VARIANT_ORDER = [
    "v0_baseline",
    "v1_auto",
    "v2_temp03",
    "v3_no_thinking",
    "v4_single_tool",
    "v5_min_prompt",
    "v6_small_max",
]

VARIANT_LABEL = {
    "v0_baseline": "V0 baseline (current config)",
    "v1_auto": "V1 tool_choice=auto control",
    "v2_temp03": "V2 temperature=0.3",
    "v3_no_thinking": "V3 enable_thinking=false",
    "v4_single_tool": "V4 single tool (list_files only)",
    "v5_min_prompt": "V5 minimal system prompt",
    "v6_small_max": "V6 max_tokens=2048",
}


def load(variant: str) -> dict | None:
    p = RUNS_DIR / f"{variant}_summary.json"
    if not p.exists():
        return None
    return json.loads(p.read_text())


def main() -> None:
    print("# tool_choice=required failure rate experiment results\n")
    print("| Variant | N | failures | rate | finish_reasons | avg comp tokens (fail) | avg reasoning len (fail) |")
    print("|---|---:|---:|---:|---|---:|---:|")
    for v in VARIANT_ORDER:
        d = load(v)
        if not d:
            print(f"| {VARIANT_LABEL[v]} | — | — | — | (not run yet) | — | — |")
            continue
        s = d["summary"]
        fr = ", ".join(f"{k}:{v_}" for k, v_ in s["finish_reasons"].items())
        ct = s["avg_completion_tokens_failure"]
        rl = s["avg_reasoning_len_failure"]
        ct_str = f"{ct:.0f}" if ct is not None else "—"
        rl_str = f"{rl:.0f}" if rl is not None else "—"
        print(f"| {VARIANT_LABEL[v]} | {s['n']} | {s['failure_count']} | {s['failure_rate']:.2f} | {fr} | {ct_str} | {rl_str} |")

    print()
    # Per-variant detail listing
    for v in VARIANT_ORDER:
        d = load(v)
        if not d:
            continue
        print(f"\n## {VARIANT_LABEL[v]}\n")
        attempts = d["attempts"]
        print("| # | tcLen | finish | content | reasoning | comp_tok | http | err |")
        print("|---:|---:|---|---:|---:|---:|---:|---|")
        for a in attempts:
            err = (a.get("error") or "").replace("|", "/")[:60]
            print(f"| {a['attempt_idx']} | {a['tool_calls_len']} | {a['finish_reason']} | {a['content_len']} | {a['reasoning_len']} | {a['completion_tokens']} | {a['http_status']} | {err} |")


if __name__ == "__main__":
    main()
