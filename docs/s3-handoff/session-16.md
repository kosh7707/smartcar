# S3 세션 16 — 2026-04-02

## 세션 요약

인수인계서 + API 계약서 + 기능 명세 문서 전면 갱신. S4 하트비트 WR 미처리 확인.

---

## 완료된 작업

### 1. 기능 명세 갱신 (`docs/specs/analysis-agent.md`)

- Phase 2 도구 테이블: 2종 → **6종** (code_graph.callees, code_graph.search, code.read_file, build.metadata 추가)
- Phase 2 다이어그램 도구 목록 갱신
- 5.1 SAST 스캔: NDJSON 스트리밍 프로토콜 상세 추가
- 구현체 테이블: 5종 → **9종** (신규 도구 파일 4개 추가)
- Evidence Sanitizer 신규 섹션 추가 (fuzzy matching, threshold 0.6)
- 9절 agentAudit: model_name, prompt_version, total_prompt_tokens, total_completion_tokens 필드 추가

### 2. API 계약서 갱신 (`docs/api/analysis-agent-api.md`)

- agentAudit 필드 테이블 신규: 8개 필드 상세 문서화 (기존 4개 + 신규 4개)
- 성공 응답 JSON 예시: agentAudit 확장 (model_name, prompt_version, total_*_tokens, trace 예시)
- health 예시: .env 런타임 예산값으로 수정 (maxSteps: 6→12, cheap: 3→6, medium: 2→4)

### 3. 인수인계서 갱신 (`docs/s3-handoff/README.md`)

- Phase 1/2 아키텍처 다이어그램: NDJSON 명시, Phase 2 도구 6종 목록
- 주요 컴포넌트 섹션 신설: Evidence Sanitizer, SAST NDJSON 스트리밍, RE100 테스트 스크립트
- 분할 문서 + 관리 문서: 세션 범위 5~14 → 5~16

### 4. 로드맵 갱신 (`docs/s3-handoff/roadmap.md`)

- 세션 16 완료 항목 표시
- 다음 세션 목표 세션 17로 이동
- 완료된 백로그 정리 (API agentAudit, evidence 환각)

### 5. S4 하트비트 고도화 WR 처리

**S4가 v0.9.0에서 6가지 요청 모두 처리 완료** (`s4-to-s3-heartbeat-progress-response.md`):

| 요청 | S4 처리 결과 |
|------|-------------|
| heartbeat progress 필드 | ✅ activeTools, completedTools, findingsCount, filesCompleted, filesTotal, currentFile |
| heartbeat status 필드 | ✅ `queued` / `running` |
| False Alive 방지 | ✅ 기존 메커니즘 충분 (proc.communicate 즉시 리턴) |
| Stall 시 부분 결과 | ✅ 기존 failed/partial로 동작 |
| 동시성 세마포어 | ✅ SAST_MAX_CONCURRENT_SCANS=2, queued heartbeat 연동 |
| API 계약서 갱신 | ✅ sast-runner-api.md NDJSON 섹션 갱신 |

**S3 측 구현 완료:**
- `sast_tool.py`: heartbeat status/progress 파싱, queued 시 stall 비활성화, running 시 filesCompleted 3회 연속 동일 → stall 감지(로깅), failed/partial 도구 `_sast_caveats` 추출
- `phase_one.py`: failed 상태 도구도 sast_partial_tools에 포함, caveats 메시지 개선
- `tests/test_sast_tool.py`: 4개 신규 테스트 (queued, stall 감지, progress 전진, failed 도구)

### 6. S5 KB degraded 필드 활용 (`s5-to-s3-kb-api-degraded-field.md`)

S5가 KB API에 `degraded` 필드(bool)를 추가. Neo4j 미연결 시 그래프 보강 없는 벡터 전용 검색을 나타냄.

**S3 활용 구현:**
- `phase_one.py`: `_run_threat_query()`에서 `/v1/search/batch` 응답의 `degraded` 캡처 → `Phase1Result.kb_degraded`
- `phase_one.py`: Phase 2 프롬프트 위협 지식 섹션에 degraded 경고 주입 (그래프 관계 누락 가능성, caveats 명시 지시)
- `knowledge_tool.py`: Phase 2 도구 호출 시 `degraded: true`이면 `_kb_warning` 메시지 추가 → LLM이 한계를 인식

### 7. 백로그 WR 삭제

- `s3-to-s3-session15-backlog.md` 삭제 (처리 완료)
- `s4-to-s3-heartbeat-progress-response.md` 삭제 (S3 구현 완료)
- `s5-to-s3-kb-api-degraded-field.md` 삭제 (S3 활용 완료)

---

## 미완료 작업 (다음 세션)

### A. RE100 재테스트

S4 하트비트 고도화 + S3 stall 감지 적용 후 4개 프로젝트 재실행. SAST 실패 3개(gateway, gateway-webserver, gateway-test) 해결 확인.

### B. 커밋

세션 15 코드 + 세션 16 문서/코드 = **미커밋**. 사용자에게 요청 필요.

---

## 파일 변경 목록 (S3 소유)

### 수정 파일

- `docs/specs/analysis-agent.md` — 도구 6종, NDJSON, sanitizer, audit 필드
- `docs/api/analysis-agent-api.md` — agentAudit 필드, health 예시
- `docs/s3-handoff/README.md` — 도구 6종, NDJSON, sanitizer, 날짜
- `docs/s3-handoff/roadmap.md` — 세션 16 완료, 세션 17 목표
- `app/tools/implementations/sast_tool.py` — stall 감지, queued 처리, failed 도구 caveats
- `app/tools/implementations/knowledge_tool.py` — degraded 필드 → LLM 경고 메시지 추가
- `app/core/phase_one.py` — failed 도구 포함, caveats 개선, kb_degraded 캡처 + 프롬프트 주입
- `tests/test_sast_tool.py` — 4개 신규 (총 10개)

### 신규 파일

- `docs/s3-handoff/session-16.md` — 이 파일

### 삭제 파일

- `docs/work-requests/s3-to-s3-session15-backlog.md` — 처리 완료
- `docs/work-requests/s4-to-s3-heartbeat-progress-response.md` — 처리 완료
- `docs/work-requests/s5-to-s3-kb-api-degraded-field.md` — 활용 완료

## 단위 테스트 현황

- Analysis Agent: **198/198 passed** (신규 4개 포함)
- Build Agent: **207/207 passed** (회귀 없음)
