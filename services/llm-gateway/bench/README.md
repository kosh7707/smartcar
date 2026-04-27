# S7 Qwen Benchmark Harness

Text-only benchmark harness for comparing three S7 replacement candidates:

- `Qwen/Qwen3.5-122B-A10B-GPTQ-Int4` — previous S7 baseline
- `Qwen/Qwen3.6-35B-A3B` — former Qwen3.6 MoE comparison candidate; not current live serving
- `Qwen/Qwen3.6-27B` — current quality-first default; original dense checkpoint, not `Qwen/Qwen3.6-27B-FP8`

Current serving identity:
- DGX live serving must report `id=root=Qwen/Qwen3.6-27B` and `max_model_len=131072` from `/v1/models`.
- Treat any `Qwen/Qwen3.6-27B-FP8` result as historical/invalid for current replacement decisions unless explicitly reintroduced by a new plan.
- The current recipe uses no `--quantization` override.

Source plan:
- `.omx/plans/prd-s7-qwen-benchmark.md`
- `.omx/plans/test-spec-s7-qwen-benchmark.md`

## Modes

| Mode | Purpose | Decision weight |
|---|---|---|
| `quality` | Primary reasoning/coding/instruction/long-context quality | primary |
| `strict-format` | JSON/tool-call/format stability | diagnostic |
| `gateway-contract` | S7 Gateway contract diagnostics | diagnostic |
| `serving-diagnostics` | latency/tok/s/concurrency health | secondary |
| `all` | Runs fixture tasks plus serving diagnostics | mixed summary |

## Suites

| Suite | Purpose |
|---|---|
| `quick` | Minimal smoke and format checks |
| `standard` | Original lightweight comparison suite |
| `hard` | More discriminative math/science/coding/long-context suite for model replacement decisions |
| `long` | Long-context extension of the standard suite |

## Request paths

- `direct`: sends OpenAI-compatible requests to `/v1/chat/completions`; preferred for primary model-quality comparison.
- `gateway`: sends through S7 `/v1/chat`; useful for operational diagnostics because Gateway may override the model profile.

The runner always queries `/v1/models` and records the actual served model. `--model-label` is only a human label.

## Model lifecycle policy

A scored comparison run is valid only if each target model is loaded through a clean lifecycle:

1. stop and remove the previous model container/process,
2. launch the intended target recipe,
3. wait for `/health` and `/v1/models`,
4. verify the served model id/root/max context matches `--expected-model`,
5. capture vLLM/container/driver/model-load/KV-cache evidence,
6. capture resource-use evidence before warmup, during the scored run, and after completion,
7. run non-scored warmup prompts with the same request shape as the benchmark slice,
8. start scored benchmark requests only after warmup succeeds.

For primary quality runs, warmup must use thinking mode and the same sampling profile as the scored tasks. Runs that skip cleanup, served-model proof, resource-use capture, or warmup should be treated as invalid for replacement decisions.

Resource evidence should include GPU name/count, driver/CUDA/container image, vLLM model-load memory, available KV-cache memory, GPU KV-cache token capacity, max concurrency estimate, CPU/RAM snapshots, `docker stats` container CPU/memory during the run, benchmark concurrency, and explicit `unavailable` markers for counters the DGX platform does not expose.

## Thinking-mode policy

Decisive quality fixtures run with Qwen thinking explicitly enabled. This matches the replacement goal of measuring stable high-quality reasoning, not direct-response instruct behavior. The scorer normalizes completed Qwen `<think>...</think>` blocks and grades only the final answer so deployments with and without vLLM reasoning-parser extraction can be compared consistently.

If non-thinking/direct-response checks are added later, keep them isolated as diagnostic workload slices and do not mix them into the primary `qualityScore`.

Qwen3.6 can spend hundreds or thousands of tokens in thinking before emitting the final answer, so thinking-mode fixtures intentionally use larger `max_tokens` budgets than direct-response smoke tests. A run that stops inside thinking is marked malformed instead of counted as a quality answer.

`qualityScore` is computed only from decisive `quality` records. Strict-format, tool-call, custom S7, and serving diagnostics remain visible in the summary but do not drive the primary replacement score.

## Hard-suite scoring notes

The `hard` suite is intended to break the original score saturation. It includes:

- math exact-answer fixtures,
- GPQA/MMLU-Pro-style science multiple-choice fixtures,
- nested instruction-following constraints,
- multi-needle long-context retrieval/synthesis,
- coding fixtures scored by hidden tests in an OS-level `bwrap` sandbox.

Coding tasks never execute generated Python in the harness process. They run in a short-lived bubblewrap sandbox with isolated namespaces, read-only system binds, a tmpfs `/tmp`, and a timeout. If `bwrap` is unavailable, coding tasks fail closed as malformed instead of falling back to unsafe in-process execution.

Existing `raw.jsonl` files can be re-scored after scorer changes:

```bash
.venv/bin/python -m bench.rescore \
  --suite hard \
  --raw bench/results/qwen36-27b-origin-hard-notthinking-20260423T144131Z/raw.jsonl \
  --summary bench/results/qwen36-27b-origin-hard-notthinking-20260423T144131Z/summary.json \
  --output-dir bench/results/qwen36-27b-origin-hard-notthinking-rescored
```

## Example

List the default target roster:

```bash
cd services/llm-gateway
.venv/bin/python -m bench.targets
```

Run the same suite for each served model after switching the DGX endpoint to that model:

```bash
cd services/llm-gateway
.venv/bin/python -m bench.runner \
  --base-url http://10.126.37.19:8000 \
  --request-path direct \
  --suite hard \
  --mode all \
  --model-label qwen36-27b \
  --expected-model Qwen/Qwen3.6-27B \
  --output-dir bench/results/qwen36-27b-quick
```

Compare two completed summaries:

```bash
.venv/bin/python -m bench.compare \
  --baseline bench/results/qwen35-standard/summary.json \
  --candidate bench/results/qwen36-standard/summary.json \
  --output-dir bench/results/compare-qwen36-vs-qwen35
```

Rank all three completed summaries:

```bash
.venv/bin/python -m bench.compare \
  --summary qwen35-122b=bench/results/qwen35-standard/summary.json \
  --summary qwen36-35b-a3b=bench/results/qwen36-35b-standard/summary.json \
  --summary qwen36-27b=bench/results/qwen36-27b-standard/summary.json \
  --output-dir bench/results/compare-qwen-three-way
```

## Results policy

`bench/results/` is git-ignored. Commit curated summaries only when intentionally needed.

## Public benchmark wrappers

The initial harness keeps public benchmark wrappers optional/isolated. It ships deterministic public-inspired local fixtures so the harness can run without adding heavyweight dependencies. Official adapters for BFCL, LiveCodeBench, BigCodeBench, RULER, or IFEval can be added later behind this result schema.
