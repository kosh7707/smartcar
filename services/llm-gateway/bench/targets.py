from __future__ import annotations

import json
from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class BenchmarkTarget:
    label: str
    model_id: str
    role: str
    notes: str


DEFAULT_TARGETS = [
    BenchmarkTarget(
        label="qwen35-122b",
        model_id="Qwen/Qwen3.5-122B-A10B-GPTQ-Int4",
        role="baseline",
        notes="Previous S7 operational/default baseline; DGX cache removed after 27B cutover.",
    ),
    BenchmarkTarget(
        label="qwen36-35b-a3b",
        model_id="Qwen/Qwen3.6-35B-A3B",
        role="candidate",
        notes="Former Qwen3.6 MoE comparison candidate; not live after quality-first 27B cutover and DGX cache cleanup.",
    ),
    BenchmarkTarget(
        label="qwen36-27b",
        model_id="Qwen/Qwen3.6-27B",
        role="candidate",
        notes="Current S7 quality-first default; original dense Qwen3.6 27B checkpoint, not Qwen3.6-27B-FP8, no quantization override.",
    ),
]


def find_target(label: str) -> BenchmarkTarget:
    for target in DEFAULT_TARGETS:
        if target.label == label:
            return target
    raise KeyError(f"unknown benchmark target label: {label}")


def main() -> int:
    print(json.dumps([asdict(target) for target in DEFAULT_TARGETS], ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
