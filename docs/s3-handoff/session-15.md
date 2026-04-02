# S3 세션 15 — 2026-03-31 ~ 2026-04-01

## 세션 요약

Analysis Agent Phase 2 도구 확충 + evidence 환각 제거 + NDJSON 하트비트 스트리밍 적용. RE100 전체 프로젝트 테스트 완료.

---

## 완료된 작업

### 1. Evidence Ref 환각 제거 (경고 0건 달성)

**근본 원인 2가지 수정:**
- `agent_loop.py:156-161`: 도구 실행 결과에 `new_evidence_refs`를 content에 append → LLM이 정확한 refId를 볼 수 있게 됨
- `evidence_sanitizer.py` (신규): 환각 refId를 fuzzy match로 교정하거나 제거하는 후처리기

**관련 파일:**
- `app/core/agent_loop.py` — tool result에 evidence ref 주입
- `app/validators/evidence_sanitizer.py` — **신규** 환각 교정기 (difflib.SequenceMatcher, threshold 0.6)
- `app/core/result_assembler.py` — validation 전에 sanitizer 실행
- `app/routers/tasks.py` — generate-poc에도 sanitizer 적용
- `tests/test_evidence_validator.py` — **신규** 10개 테스트
- `tests/test_evidence_sanitizer.py` — **신규** 10개 테스트
- `tests/test_evidence_hallucination.py` — **신규** 4개 통합 테스트

**주의**: allowed_refs가 비어있을 때 모든 refs를 제거하도록 수정됨 (RE100 gateway 테스트에서 발견)

### 2. Phase 2 도구 확충 (4개 → 6개 + 기존 1개 보강)

| 도구 | tier | 상태 | 파일 |
|------|------|------|------|
| `code.read_file` | CHEAP | **신규** | `app/tools/implementations/read_file_tool.py` |
| `code_graph.callees` | CHEAP | **신규** | `app/tools/implementations/codegraph_callees_tool.py` |
| `build.metadata` | CHEAP | **신규** | `app/tools/implementations/metadata_tool.py` |
| `knowledge.search` | CHEAP | **보강** — `exclude_ids` 파라미터 추가 | `app/tools/implementations/knowledge_tool.py` |

**등록**: `app/routers/tasks.py`에 스키마 + 구현체 등록 완료.
**프롬프트**: `app/core/phase_one.py` 시스템 프롬프트에 모든 도구 설명 + 사용 지침 추가.

### 3. 코드그래프 한계 프롬프트 반영 (S4 WR 처리)

`phase_one.py`에 코드그래프 한계 컨텍스트 추가:
- 함수 포인터 경유 → `code.read_file`로 확인 지시
- 복잡한 매크로 → `code.read_file`로 확인 지시
- C++ virtual call → `code.read_file`로 확인 지시

### 4. NDJSON 하트비트 스트리밍 적용

S4가 `POST /v1/scan`에 NDJSON 스트리밍 구현 완료 (v0.8.0). S3 소비 구현:

**파일**: `app/tools/implementations/sast_tool.py` (전면 개조)
- `httpx.AsyncClient.stream()` + `aiter_lines()` 사용
- `Accept: application/x-ndjson` 헤더
- progress/heartbeat 이벤트 로깅
- 60초 inactivity timeout (`asyncio.wait_for`)
- 동기 fallback 유지 (Content-Type이 ndjson이 아니면)
- `tests/test_sast_tool.py` — **신규** 6개 테스트

### 5. LLM 타임아웃 병렬 부하 반영 (S7 WR 처리)

`agent-shared/llm/caller.py` adaptive timeout 파라미터 조정:
- `_TOKENS_PER_SECOND`: 10.0 → **7.0** (병렬 4요청 시 감속)
- `_PREFILL_PER_1K_TOKENS`: 10.0 → **15.0**
- `_MAX_TIMEOUT`: 600.0 → **900.0**

### 6. RE100 전체 프로젝트 테스트

`scripts/re100-full-test.sh` — 4개 프로젝트 병렬 Build → Analyze → PoC + 마크다운 보고서 생성.

**결과** (reports/re100-20260331-213401/):

| 프로젝트 | Analyze | Claims | PoC | 검증 |
|----------|:-------:|:------:|:---:|:----:|
| certificate-maker | OK | 0 | - | valid |
| gateway | OK | 2 | 2/2 | valid |
| gateway-test | OK | 0 | - | valid |
| gateway-webserver | OK | 0 | - | valid |

**발견된 문제**: gateway-webserver, gateway-test, gateway에서 SAST 실패 (S4 타임아웃).
→ 하트비트 스트리밍으로 해결 예정.

### 7. roadmap 업데이트

`docs/s3-handoff/roadmap.md` 백로그 4번(evidence ref 환각) 완료 표시.

---

## 미완료 작업 (다음 세션 필수)

### A. S4 하트비트 고도화 WR 대기 중

**WR 파일**: `docs/work-requests/s3-to-s4-heartbeat-progress-metrics.md`

S4에 요청한 6개 사항:
1. heartbeat에 `progress` 필드 추가 (activeTool, filesCompleted, filesTotal, findingsCount, currentFile)
2. heartbeat에 `status` 필드 추가 (`queued` / `running`)
3. False Alive 방지 (하트비트가 워커 생존에 연동)
4. Stall 시 부분 결과 전송 (`toolResults[*].status: "killed"`)
5. 동시성 세마포어 (`AEGIS_SAST_CONCURRENCY`)
6. API 계약서 갱신

**S3 대응 (S4 갱신 후)**:
- `sast_tool.py`에 stall 감지 로직 추가 (연속 3회 progress 동일 → stall)
- `status: "queued"` 처리 (stall 판정 비활성화)
- killed 도구 caveats 주입

### B. RE100 재테스트 (하트비트 고도화 후)

하트비트 진행 지표 + 동시성 제어가 적용된 후 RE100 4개 프로젝트 재테스트.
현재 SAST 실패한 3개 프로젝트(gateway, gateway-webserver, gateway-test)가 성공하는지 확인.

### C. 인수인계서 갱신

`docs/s3-handoff/README.md` 갱신 필요:
- Phase 2 도구 6개 반영 (현재 문서는 4개 기준)
- NDJSON 스트리밍 SAST 호출 반영
- evidence sanitizer 반영
- RE100 테스트 스크립트 추가

### D. 커밋

이번 세션의 모든 변경사항이 **미커밋** 상태. 사용자에게 커밋 요청 필요.

---

## 파일 변경 목록 (S3 소유)

### 신규 파일
- `app/validators/evidence_sanitizer.py`
- `app/tools/implementations/read_file_tool.py`
- `app/tools/implementations/codegraph_callees_tool.py`
- `app/tools/implementations/metadata_tool.py`
- `tests/test_evidence_validator.py`
- `tests/test_evidence_sanitizer.py`
- `tests/test_evidence_hallucination.py`
- `tests/test_read_file_tool.py`
- `tests/test_codegraph_callees_tool.py`
- `tests/test_metadata_tool.py`
- `tests/test_sast_tool.py`
- `scripts/re100-full-test.sh`
- `docs/s3-handoff/session-15.md` (이 파일)

### 수정 파일
- `app/core/agent_loop.py` — evidence ref 주입
- `app/core/phase_one.py` — 프롬프트 갱신 (도구 6개 + 코드그래프 한계)
- `app/core/result_assembler.py` — sanitizer 통합
- `app/routers/tasks.py` — 도구 등록 + sanitizer + 타임아웃 간소화
- `app/tools/implementations/sast_tool.py` — NDJSON 스트리밍 전환
- `app/tools/implementations/knowledge_tool.py` — exclude_ids 추가
- `tests/test_llm_caller.py` — adaptive timeout 기대값 갱신
- `docs/s3-handoff/roadmap.md` — 백로그 4번 완료

### agent-shared (S3 소유)
- `agent_shared/llm/caller.py` — adaptive timeout 병렬 부하 반영

---

## 단위 테스트 현황

- Analysis Agent: **194/194 passed** (신규 39개 포함)
- Build Agent: **207/207 passed** (회귀 없음)
