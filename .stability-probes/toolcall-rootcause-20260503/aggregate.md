# tool_choice=required failure rate experiment results

| Variant | N | failures | rate | finish_reasons | avg comp tokens (fail) | avg reasoning len (fail) |
|---|---:|---:|---:|---|---:|---:|
| V0 baseline (current config) | 15 | 14 | 0.93 | tool_calls:15 | 81 | 117 |
| V1 tool_choice=auto control | 10 | 0 | 0.00 | tool_calls:10 | — | — |
| V2 temperature=0.3 | 10 | 10 | 1.00 | tool_calls:10 | 94 | 121 |
| V3 enable_thinking=false | 10 | 0 | 0.00 | tool_calls:10 | — | — |
| V4 single tool (list_files only) | 10 | 9 | 0.90 | tool_calls:10 | 118 | 149 |
| V5 minimal system prompt | 10 | 7 | 0.70 | tool_calls:10 | 455 | 1680 |
| V6 max_tokens=2048 | 10 | 9 | 0.90 | tool_calls:10 | 86 | 117 |


## V0 baseline (current config)

| # | tcLen | finish | content | reasoning | comp_tok | http | err |
|---:|---:|---|---:|---:|---:|---:|---|
| 1 | 0 | tool_calls | 0 | 121 | 94 | 200 |  |
| 2 | 1 | tool_calls | 0 | 105 | 51 | 200 |  |
| 3 | 0 | tool_calls | 0 | 121 | 94 | 200 |  |
| 4 | 0 | tool_calls | 0 | 121 | 94 | 200 |  |
| 5 | 0 | tool_calls | 0 | 121 | 94 | 200 |  |
| 6 | 0 | tool_calls | 0 | 87 | 88 | 200 |  |
| 7 | 0 | tool_calls | 0 | 117 | 93 | 200 |  |
| 8 | 0 | tool_calls | 0 | 117 | 59 | 200 |  |
| 9 | 0 | tool_calls | 0 | 117 | 59 | 200 |  |
| 10 | 0 | tool_calls | 0 | 121 | 94 | 200 |  |
| 11 | 0 | tool_calls | 0 | 121 | 94 | 200 |  |
| 12 | 0 | tool_calls | 0 | 117 | 59 | 200 |  |
| 13 | 0 | tool_calls | 0 | 121 | 60 | 200 |  |
| 14 | 0 | tool_calls | 0 | 121 | 60 | 200 |  |
| 15 | 0 | tool_calls | 0 | 121 | 94 | 200 |  |

## V1 tool_choice=auto control

| # | tcLen | finish | content | reasoning | comp_tok | http | err |
|---:|---:|---|---:|---:|---:|---:|---|
| 1 | 1 | tool_calls | 0 | 121 | 94 | 200 |  |
| 2 | 1 | tool_calls | 0 | 315 | 164 | 200 |  |
| 3 | 1 | tool_calls | 0 | 121 | 94 | 200 |  |
| 4 | 1 | tool_calls | 0 | 121 | 94 | 200 |  |
| 5 | 1 | tool_calls | 0 | 117 | 59 | 200 |  |
| 6 | 1 | tool_calls | 0 | 118 | 60 | 200 |  |
| 7 | 1 | tool_calls | 0 | 121 | 94 | 200 |  |
| 8 | 1 | tool_calls | 0 | 121 | 60 | 200 |  |
| 9 | 1 | tool_calls | 0 | 121 | 94 | 200 |  |
| 10 | 1 | tool_calls | 0 | 117 | 59 | 200 |  |

## V2 temperature=0.3

| # | tcLen | finish | content | reasoning | comp_tok | http | err |
|---:|---:|---|---:|---:|---:|---:|---|
| 1 | 0 | tool_calls | 0 | 121 | 94 | 200 |  |
| 2 | 0 | tool_calls | 0 | 121 | 94 | 200 |  |
| 3 | 0 | tool_calls | 0 | 121 | 94 | 200 |  |
| 4 | 0 | tool_calls | 0 | 121 | 94 | 200 |  |
| 5 | 0 | tool_calls | 0 | 121 | 94 | 200 |  |
| 6 | 0 | tool_calls | 0 | 121 | 94 | 200 |  |
| 7 | 0 | tool_calls | 0 | 121 | 94 | 200 |  |
| 8 | 0 | tool_calls | 0 | 121 | 94 | 200 |  |
| 9 | 0 | tool_calls | 0 | 121 | 94 | 200 |  |
| 10 | 0 | tool_calls | 0 | 121 | 94 | 200 |  |

## V3 enable_thinking=false

| # | tcLen | finish | content | reasoning | comp_tok | http | err |
|---:|---:|---|---:|---:|---:|---:|---|
| 1 | 1 | tool_calls | 0 | 0 | 22 | 200 |  |
| 2 | 1 | tool_calls | 0 | 0 | 30 | 200 |  |
| 3 | 1 | tool_calls | 0 | 0 | 61 | 200 |  |
| 4 | 1 | tool_calls | 0 | 0 | 33 | 200 |  |
| 5 | 1 | tool_calls | 0 | 0 | 30 | 200 |  |
| 6 | 3 | tool_calls | 0 | 0 | 106 | 200 |  |
| 7 | 1 | tool_calls | 0 | 0 | 30 | 200 |  |
| 8 | 1 | tool_calls | 0 | 0 | 30 | 200 |  |
| 9 | 1 | tool_calls | 0 | 0 | 36 | 200 |  |
| 10 | 1 | tool_calls | 0 | 0 | 30 | 200 |  |

## V4 single tool (list_files only)

| # | tcLen | finish | content | reasoning | comp_tok | http | err |
|---:|---:|---|---:|---:|---:|---:|---|
| 1 | 0 | tool_calls | 0 | 87 | 88 | 200 |  |
| 2 | 1 | tool_calls | 0 | 315 | 115 | 200 |  |
| 3 | 0 | tool_calls | 0 | 114 | 93 | 200 |  |
| 4 | 0 | tool_calls | 0 | 41 | 86 | 200 |  |
| 5 | 0 | tool_calls | 0 | 121 | 94 | 200 |  |
| 6 | 0 | tool_calls | 0 | 117 | 93 | 200 |  |
| 7 | 0 | tool_calls | 0 | 117 | 93 | 200 |  |
| 8 | 0 | tool_calls | 0 | 315 | 159 | 200 |  |
| 9 | 0 | tool_calls | 0 | 319 | 146 | 200 |  |
| 10 | 0 | tool_calls | 0 | 106 | 212 | 200 |  |

## V5 minimal system prompt

| # | tcLen | finish | content | reasoning | comp_tok | http | err |
|---:|---:|---|---:|---:|---:|---:|---|
| 1 | 1 | tool_calls | 0 | 248 | 105 | 200 |  |
| 2 | 1 | tool_calls | 0 | 1238 | 362 | 200 |  |
| 3 | 0 | tool_calls | 0 | 1711 | 436 | 200 |  |
| 4 | 0 | tool_calls | 0 | 250 | 107 | 200 |  |
| 5 | 0 | tool_calls | 0 | 4422 | 1154 | 200 |  |
| 6 | 0 | tool_calls | 0 | 1503 | 428 | 200 |  |
| 7 | 0 | tool_calls | 0 | 231 | 105 | 200 |  |
| 8 | 0 | tool_calls | 0 | 283 | 113 | 200 |  |
| 9 | 1 | tool_calls | 0 | 427 | 127 | 200 |  |
| 10 | 0 | tool_calls | 0 | 3362 | 844 | 200 |  |

## V6 max_tokens=2048

| # | tcLen | finish | content | reasoning | comp_tok | http | err |
|---:|---:|---|---:|---:|---:|---:|---|
| 1 | 0 | tool_calls | 0 | 121 | 94 | 200 |  |
| 2 | 0 | tool_calls | 0 | 121 | 60 | 200 |  |
| 3 | 0 | tool_calls | 0 | 121 | 94 | 200 |  |
| 4 | 0 | tool_calls | 0 | 121 | 60 | 200 |  |
| 5 | 0 | tool_calls | 0 | 125 | 94 | 200 |  |
| 6 | 1 | tool_calls | 0 | 335 | 141 | 200 |  |
| 7 | 0 | tool_calls | 0 | 121 | 94 | 200 |  |
| 8 | 0 | tool_calls | 0 | 121 | 94 | 200 |  |
| 9 | 0 | tool_calls | 0 | 117 | 93 | 200 |  |
| 10 | 0 | tool_calls | 0 | 87 | 88 | 200 |  |
