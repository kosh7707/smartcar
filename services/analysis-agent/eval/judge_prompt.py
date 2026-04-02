"""judge_prompt.py — Claude-as-Judge 프롬프트 생성기.

평가 결과 JSON을 읽어 Claude에게 보여줄 구조화된 프롬프트를 생성한다.
생성된 프롬프트를 Claude Code 세션에 붙여넣으면 detail 품질 채점이 수행된다.

Usage:
    python -m eval.judge_prompt eval/results/baseline-v1.json
    python -m eval.judge_prompt eval/results/baseline-v1.json --output judge.md
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

_GOLDEN_DIR = Path(__file__).parent / "golden" / "cases"


def generate_judge_prompt(
    eval_result_path: str,
    golden_dir: str = "",
    focus_cases: list[str] | None = None,
) -> str:
    """평가 결과 → Claude-as-Judge 프롬프트 텍스트."""
    gdir = Path(golden_dir) if golden_dir else _GOLDEN_DIR
    eval_data = json.loads(Path(eval_result_path).read_text())

    # 골든 케이스 로드 (ID → dict)
    golden_map: dict[str, dict] = {}
    for p in gdir.glob("*.json"):
        g = json.loads(p.read_text())
        golden_map[g["id"]] = g

    sections = [_HEADER]

    for entry in eval_data.get("results", []):
        gid = entry["golden_id"]
        if focus_cases and gid not in focus_cases:
            continue

        golden = golden_map.get(gid)
        if not golden:
            continue

        eval_result = entry.get("eval_result", {})
        raw_response = entry.get("raw_response")

        sections.append(_format_case(golden, eval_result, raw_response))

    sections.append(_FOOTER)
    return "\n".join(sections)


_HEADER = """\
# AEGIS Analysis Agent 품질 평가 (Claude-as-Judge)

당신은 자동차 임베디드 보안 분석 에이전트의 출력 품질을 평가하는 심사관입니다.

각 케이스에 대해 **5개 차원**을 1-5점으로 평가하라:

| 차원 | 설명 | 1점 | 5점 |
|------|------|-----|-----|
| **기술 정확성** | claim이 기술적으로 맞는가 | 완전히 틀림 | 정확하고 정밀함 |
| **분석 깊이** | 공격 경로, 코드 흐름, 영향 설명 | 피상적 1줄 | 공격 시나리오+코드 경로+영향 완비 |
| **실행 가능성** | 보안 엔지니어가 조치 가능한가 | 모호하여 조치 불가 | 구체적 수정 방안 포함 |
| **심각도 보정** | severity가 적절한가 | 심각도 완전 오판 | 근거와 함께 적절한 판단 |
| **완전성** | 실제 취약점 발견, FP 회피 | 주요 취약점 놓침 or FP 다수 | 모든 취약점 발견, FP 0 |

---
"""

_FOOTER = """\
---

## 종합 평가

위 케이스들을 종합하여:
1. **가장 잘한 점** (강점)
2. **가장 부족한 점** (개선 필요)
3. **전체 등급** (A/B/C/D/F)
4. **다음 세션에서 개선할 프롬프트 방향** (구체적 제안)
"""


def _format_case(golden: dict, eval_result: dict, raw_response: dict | None) -> str:
    """단일 케이스의 평가 섹션을 포맷한다."""
    gid = golden["id"]
    desc = golden.get("description", "")
    source = golden.get("input", {}).get("source_code", "(소스 없음)")
    sast = json.dumps(golden.get("input", {}).get("sast_findings", []), ensure_ascii=False, indent=2)
    expected = golden.get("expected", {})

    # 에이전트 출력
    if raw_response:
        result = raw_response.get("result", {})
        agent_output = json.dumps(result, ensure_ascii=False, indent=2)
    else:
        agent_output = "(에이전트 응답 없음 — 실행 오류)"

    # 자동 채점 결과
    metrics = eval_result.get("metrics", {})
    composite = eval_result.get("composite_score", 0)
    metrics_summary = (
        f"Recall: {metrics.get('recall', 0):.2f}, "
        f"Precision: {metrics.get('precision', 0):.2f}, "
        f"FP Rejection: {metrics.get('fp_rejection', 0):.2f}, "
        f"Severity: {metrics.get('severity_accuracy', 0):.2f}, "
        f"Composite: {composite:.2f}"
    )

    # must_find / must_reject 요약
    must_find_text = "\n".join(
        f"  - {mf.get('cwe', '?')}: {', '.join(mf.get('keywords', []))}"
        for mf in expected.get("must_find", [])
    ) or "  (없음)"
    must_reject_text = "\n".join(
        f"  - {mr.get('cwe', '?')}: {mr.get('reason', '?')}"
        for mr in expected.get("must_reject", [])
    ) or "  (없음)"

    return f"""\
## Case: {gid}
> {desc}

### 소스코드
```c
{source}
```

### SAST 입력
```json
{sast}
```

### 기대 결과
- **반드시 찾아야 할 것:**
{must_find_text}
- **반드시 거부해야 할 것 (FP):**
{must_reject_text}
- **예상 severity:** {expected.get('severity_range', ['?'])}

### 에이전트 출력
```json
{agent_output}
```

### 자동 채점
{metrics_summary}

### 당신의 평가
| 차원 | 점수 (1-5) | 근거 |
|------|-----------|------|
| 기술 정확성 | /5 | |
| 분석 깊이 | /5 | |
| 실행 가능성 | /5 | |
| 심각도 보정 | /5 | |
| 완전성 | /5 | |

---
"""


def main():
    parser = argparse.ArgumentParser(description="AEGIS Claude-as-Judge Prompt Generator")
    parser.add_argument("eval_result", help="Eval results JSON path")
    parser.add_argument("--golden-dir", default="")
    parser.add_argument("--output", default="", help="Save prompt to file (default: stdout)")
    parser.add_argument("--case", action="append", default=None, help="Focus on specific cases")
    args = parser.parse_args()

    prompt = generate_judge_prompt(
        args.eval_result,
        golden_dir=args.golden_dir,
        focus_cases=args.case,
    )

    if args.output:
        Path(args.output).write_text(prompt)
        print(f"Judge prompt saved: {args.output}")
    else:
        print(prompt)


if __name__ == "__main__":
    main()
