from __future__ import annotations

from bench.models import BenchTask

SIMPLE_THINKING_MAX_TOKENS = 2048
COMPLEX_THINKING_MAX_TOKENS = 4096
HARD_SIMPLE_MAX_TOKENS = 3072
HARD_COMPLEX_MAX_TOKENS = 6144


def _long_context_needle(repeats: int = 1800) -> str:
    filler = "Vehicle telemetry line: speed=0 rpm=0 diagnostic_status=nominal. "
    return filler * repeats + "\nSECRET_TOKEN: ZX-9142\n" + filler * repeats


def _multi_needle_context(repeats: int = 180) -> str:
    blocks = []
    for idx in range(repeats):
        blocks.append(f"Telemetry block {idx:03d}: pressure nominal, vector checksum {idx * 17 % 101}.")
        if idx == 31:
            blocks.append("NEEDLE_ALPHA: orchard-418")
        if idx == 97:
            blocks.append("NEEDLE_BETA: harbor-733")
        if idx == 151:
            blocks.append("NEEDLE_GAMMA: delta between beta and alpha numeric suffixes is 315")
    return "\n".join(blocks)


def _hard_messages(content: str) -> list[dict[str, str]]:
    return [
        {
            "role": "system",
            "content": (
                "You are taking a deterministic text-only benchmark. Keep internal reasoning concise, "
                "finish before the token budget, and make the final answer exactly match the requested format."
            ),
        },
        {"role": "user", "content": content},
    ]


def builtin_tasks(suite: str = "quick") -> list[BenchTask]:
    """Return text-only local benchmark fixtures.

    The initial harness intentionally uses deterministic public-inspired/local
    fixtures so it can run without pulling heavyweight public benchmark deps.
    Official adapters can be added later behind isolated wrappers.
    """
    if suite not in {"quick", "standard", "long", "hard"}:
        raise ValueError(f"unknown suite: {suite}")

    tasks = [
        BenchTask(
            id="ifeval_exact_bench_ok",
            family="instruction_format",
            mode="quality",
            source_kind="public-inspired-local",
            messages=[{"role": "user", "content": "Return exactly this token and nothing else: BENCH_OK"}],
            scorer="exact",
            expected={"text": "BENCH_OK"},
            max_tokens=SIMPLE_THINKING_MAX_TOKENS,
            enable_thinking=True,
        ),
        BenchTask(
            id="reasoning_grid_count",
            family="reasoning",
            mode="quality",
            source_kind="public-inspired-local",
            messages=[{
                "role": "user",
                "content": (
                    "There are 3 rows and 4 columns of sensors, one at every row-column position. "
                    "Two corner sensors fail. How many working sensors remain? "
                    "Answer with only the integer."
                ),
            }],
            scorer="exact",
            expected={"text": "10"},
            max_tokens=COMPLEX_THINKING_MAX_TOKENS,
            enable_thinking=True,
        ),
        BenchTask(
            id="coding_parse_can_id",
            family="coding_reasoning",
            mode="quality",
            source_kind="public-inspired-local",
            messages=[{
                "role": "user",
                "content": (
                    "Write a Python function parse_can_id(frame: str) -> int that extracts "
                    "the hexadecimal CAN id from strings like '0x7DF [8] 02 01 00'. "
                    "Return only the function code."
                ),
            }],
            scorer="contains_all",
            expected={"substrings": ["def parse_can_id", "int(", "16"]},
            max_tokens=COMPLEX_THINKING_MAX_TOKENS,
            enable_thinking=True,
        ),
        BenchTask(
            id="strict_json_minimal",
            family="instruction_format",
            mode="strict-format",
            source_kind="public-inspired-local",
            messages=[{"role": "user", "content": "Return a JSON object with key ok set to true and no other keys."}],
            scorer="json_fields",
            expected={"fields": {"ok": True}, "allowExtra": False},
            response_format={"type": "json_object"},
            enable_thinking=True,
            max_tokens=SIMPLE_THINKING_MAX_TOKENS,
            decisive=False,
        ),
        BenchTask(
            id="tool_call_risk_label",
            family="tool_calling",
            mode="strict-format",
            source_kind="public-inspired-local",
            messages=[{"role": "user", "content": "Call the classify_risk function with severity high."}],
            tools=[{
                "type": "function",
                "function": {
                    "name": "classify_risk",
                    "description": "Classify a security finding risk level.",
                    "parameters": {
                        "type": "object",
                        "properties": {"severity": {"type": "string"}},
                        "required": ["severity"],
                    },
                },
            }],
            tool_choice="auto",
            scorer="tool_call",
            expected={"name": "classify_risk", "arguments": {"severity": "high"}},
            max_tokens=SIMPLE_THINKING_MAX_TOKENS,
            enable_thinking=True,
            decisive=False,
        ),
        BenchTask(
            id="s7_evidence_json",
            family="custom_s7_reasoning",
            mode="strict-format",
            source_kind="custom-s7-diagnostic",
            messages=[{
                "role": "user",
                "content": (
                    "Given evidence ref eref-001 for source line 'memcpy(buf, data, len)' "
                    "where len is not bounds-checked, return a JSON object with keys "
                    "summary and usedEvidenceRefs. usedEvidenceRefs must be [\"eref-001\"]. "
                    "The final response must be only the JSON object."
                ),
            }],
            scorer="evidence_json",
            expected={"allowedRefs": ["eref-001"], "requiredRefs": ["eref-001"], "requiredFields": ["summary", "usedEvidenceRefs"]},
            response_format={"type": "json_object"},
            enable_thinking=True,
            max_tokens=COMPLEX_THINKING_MAX_TOKENS,
            decisive=False,
        ),
    ]

    if suite in {"standard", "long"}:
        tasks.extend([
            BenchTask(
                id="long_context_needle_8kish",
                family="long_context",
                mode="quality",
                source_kind="public-inspired-local",
                messages=[{"role": "user", "content": _long_context_needle(260) + "\nWhat is the SECRET_TOKEN? Return only the token."}],
                scorer="exact",
                expected={"text": "ZX-9142"},
                max_tokens=COMPLEX_THINKING_MAX_TOKENS,
                enable_thinking=True,
            ),
            BenchTask(
                id="repeat_consistency_token",
                family="instruction_format",
                mode="quality",
                source_kind="public-inspired-local",
                messages=[{"role": "user", "content": "Return exactly: CONSISTENT_17"}],
                scorer="exact",
                expected={"text": "CONSISTENT_17"},
                max_tokens=SIMPLE_THINKING_MAX_TOKENS,
                enable_thinking=True,
                repeat=3,
            ),
        ])

    if suite == "hard":
        return hard_tasks()

    if suite == "long":
        tasks.append(
            BenchTask(
                id="long_context_needle_64kish",
                family="long_context",
                mode="quality",
                source_kind="public-inspired-local",
                messages=[{"role": "user", "content": _long_context_needle(2100) + "\nWhat is the SECRET_TOKEN? Return only the token."}],
                scorer="exact",
                expected={"text": "ZX-9142"},
                max_tokens=COMPLEX_THINKING_MAX_TOKENS,
                enable_thinking=True,
            )
        )

    return tasks


def hard_tasks() -> list[BenchTask]:
    """Return a discriminative text-only suite inspired by public hard evals."""
    return [
        BenchTask(
            id="hard_math_crt",
            family="math_reasoning",
            mode="quality",
            source_kind="public-inspired-local",
            messages=_hard_messages("Find the smallest positive integer n such that n ≡ 2 (mod 7), n ≡ 3 (mod 11), and n ≡ 4 (mod 13). Answer with only the integer."),
            scorer="exact",
            expected={"text": "212"},
            max_tokens=HARD_SIMPLE_MAX_TOKENS,
            enable_thinking=True,
        ),
        BenchTask(
            id="hard_math_recurrence",
            family="math_reasoning",
            mode="quality",
            source_kind="public-inspired-local",
            messages=_hard_messages("Let a0=2, a1=5, and a_n = 3*a_{n-1} - 2*a_{n-2} for n>=2. What is a8? Answer with only the integer."),
            scorer="exact",
            expected={"text": "767"},
            max_tokens=HARD_SIMPLE_MAX_TOKENS,
            enable_thinking=True,
        ),
        BenchTask(
            id="hard_math_inclusion_exclusion",
            family="math_reasoning",
            mode="quality",
            source_kind="public-inspired-local",
            messages=_hard_messages("How many integers from 1 through 1000 are divisible by 6 or 10, but not divisible by 15? Answer with only the integer."),
            scorer="exact",
            expected={"text": "200"},
            max_tokens=HARD_SIMPLE_MAX_TOKENS,
            enable_thinking=True,
        ),
        BenchTask(
            id="gpqa_style_chem_equilibrium",
            family="science_reasoning",
            mode="quality",
            source_kind="public-inspired-local",
            messages=_hard_messages(
                "Multiple choice. For a closed vessel at constant temperature containing N2O4(g) ⇌ 2 NO2(g), "
                "the equilibrium mixture is compressed to half its volume and then allowed to re-equilibrate. "
                "Which statement is correct? A) The reaction quotient immediately decreases and the system shifts right. "
                "B) The reaction quotient immediately increases and the system shifts left. "
                "C) The reaction quotient is unchanged and no shift occurs. D) The system shifts right because pressure favors more moles. "
                "Answer with only the letter."
            ),
            scorer="multiple_choice",
            expected={"choice": "B"},
            max_tokens=HARD_SIMPLE_MAX_TOKENS,
            enable_thinking=True,
        ),
        BenchTask(
            id="gpqa_style_physics_capacitor",
            family="science_reasoning",
            mode="quality",
            source_kind="public-inspired-local",
            messages=_hard_messages(
                "Multiple choice. A parallel-plate capacitor is disconnected from a battery after being charged. "
                "A dielectric with relative permittivity k is inserted fully between the plates. What happens? "
                "A) Charge decreases and voltage is unchanged. B) Charge is unchanged and voltage decreases by factor k. "
                "C) Charge is unchanged and voltage increases by factor k. D) Energy stored increases by factor k. "
                "Answer with only the letter."
            ),
            scorer="multiple_choice",
            expected={"choice": "B"},
            max_tokens=HARD_SIMPLE_MAX_TOKENS,
            enable_thinking=True,
        ),
        BenchTask(
            id="hard_instruction_nested_constraints",
            family="instruction_format",
            mode="quality",
            source_kind="public-inspired-local",
            messages=_hard_messages(
                "Return exactly five comma-separated lowercase words in alphabetical order. "
                "Use only animal names. The third word must have exactly five letters. "
                "The first letters of the five words must spell abcde. Return only the comma-separated list."
            ),
            scorer="csv_constraints",
            expected={
                "count": 5,
                "starts": "abcde",
                "sorted": True,
                "thirdLen": 5,
                "allowedWords": ["ant", "ape", "bear", "camel", "crane", "dog", "dingo", "eel", "emu"],
            },
            max_tokens=HARD_SIMPLE_MAX_TOKENS,
            enable_thinking=True,
        ),
        BenchTask(
            id="hard_long_context_multi_needle",
            family="long_context",
            mode="quality",
            source_kind="public-inspired-local",
            messages=_hard_messages(
                _multi_needle_context()
                + "\nUsing the three NEEDLE lines only, return exactly: alpha=<ALPHA>; beta=<BETA>; delta=<DELTA>"
            ),
            scorer="exact",
            expected={"text": "alpha=orchard-418; beta=harbor-733; delta=315"},
            max_tokens=HARD_COMPLEX_MAX_TOKENS,
            enable_thinking=True,
        ),
        BenchTask(
            id="hard_code_longest_bounded_span",
            family="coding_execution",
            mode="quality",
            source_kind="public-inspired-local",
            messages=_hard_messages(
                "Write a Python function longest_bounded_span(nums: list[int], limit: int) -> int. "
                "It must return the length of the longest contiguous subarray where max(subarray)-min(subarray) <= limit. "
                "Return only the complete function code with no markdown and no explanation."
            ),
            scorer="python_function_bwrap",
            expected={
                "function": "longest_bounded_span",
                "tests": [
                    {"args": [[8, 2, 4, 7], 4], "expected": 2},
                    {"args": [[10, 1, 2, 4, 7, 2], 5], "expected": 4},
                    {"args": [[4, 2, 2, 2, 4, 4, 2, 2], 0], "expected": 3},
                ],
            },
            max_tokens=HARD_COMPLEX_MAX_TOKENS,
            enable_thinking=True,
        ),
        BenchTask(
            id="hard_code_checkpoint_paths",
            family="coding_execution",
            mode="quality",
            source_kind="public-inspired-local",
            messages=_hard_messages(
                "Write a Python function count_checkpoint_paths(grid: list[str]) -> int. "
                "A path starts at top-left and ends at bottom-right, moves only right or down, cannot step on '#', "
                "and must visit exactly one cell marked 'C'. Return the number of valid paths. Return only complete function code with no markdown."
            ),
            scorer="python_function_bwrap",
            expected={
                "function": "count_checkpoint_paths",
                "tests": [
                    {"args": [["..", "C."]], "expected": 1},
                    {"args": [["C.", ".."]], "expected": 2},
                    {"args": [["..", ".C"]], "expected": 2},
                    {"args": [["C#", ".."]], "expected": 1},
                ],
            },
            max_tokens=HARD_COMPLEX_MAX_TOKENS,
            enable_thinking=True,
        ),
        BenchTask(
            id="hard_code_token_bucket",
            family="coding_execution",
            mode="quality",
            source_kind="public-inspired-local",
            messages=_hard_messages(
                "Write a Python function count_accepted(request_times: list[int], capacity: int, refill_interval: int) -> int. "
                "The bucket starts full. Before each request at time t, add floor((t-last_time)/refill_interval) tokens capped at capacity, "
                "where last_time is the previous request time. Accept a request iff a token is available and consume one token. "
                "Return the number accepted. Return only complete function code with no markdown."
            ),
            scorer="python_function_bwrap",
            expected={
                "function": "count_accepted",
                "tests": [
                    {"args": [[0, 1, 2], 2, 5], "expected": 2},
                    {"args": [[0, 5, 10], 1, 5], "expected": 3},
                    {"args": [[0, 1, 6, 7, 12], 2, 5], "expected": 4},
                ],
            },
            max_tokens=HARD_COMPLEX_MAX_TOKENS,
            enable_thinking=True,
        ),
    ]
