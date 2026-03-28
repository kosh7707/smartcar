# S3 세션 로그

> 이 파일은 S3(Analysis Agent + Build Agent) 세션별 수정 이력을 기록한다.
> 최신 항목이 맨 위.

---

## 세션 13: 외부 피드백 전수 반영 (2026-03-28, 완료)

외부 리뷰어 피드백(`docs/외부피드백/26.03.26/S3_agent_architecture_feedback.md`) P0~P1~서브시스템~테스트 **17건 전수 반영**. 기존 P0 4건(경로 스코프, 중복 차단, 스크립트 안전성, chmod 해소)은 2026-03-27 완료. 이번 세션에서 미처리 13건 추가 완료.

**P0 (잔여 2건)**:
- **P0-3 evidence refs 검증**: ResultAssembler의 `allowed_refs`에 `session.trace[].new_evidence_refs` 합집합 포함. 도구가 생성한 refs(`eref-build-success`, `eref-sast-*` 등)가 검증에서 거부되지 않음
- **P0-5 동시 요청 격리**: `build-aegis/` → `build-aegis-{requestId[:8]}/` request-scoped 워크스페이스. 시스템 프롬프트·도구 description·FilePolicy 전부 동기화. KB 코드 그래프 + project memory에 `revisionHint` 전달 (additive)

**P1 (4건)**:
- **P1-4.1 prompt 토큰 추적**: BudgetState에 `total_prompt_tokens` / `max_prompt_tokens` 추가. `record_tokens()`에서 양쪽 누적. 80% 초과 시 경고 로그
- **P1-4.2 구조화 상태 요약**: TurnSummarizer에 `state_summary` 파라미터 추가. Build Agent `build_state_summary()`가 compaction 시 files_read_count, build_attempts, last_build_success, tools_attempted 주입
- **P1-4.3 프롬프트 상충 해소**: "최소 1회 도구 호출 강제" + "1회 후 보고서만" 모순 → "불확실성 기반 호출, 최대 2회" 전환
- **P1-4.5 turn numbering**: ToolTraceStep.turn_number가 `session.turn_count` 대신 `turn` (이미 +1 된 값) 사용. off-by-one 해소

**서브시스템 (8건)**:
- **SS-1 도구 메타데이터**: ToolSchema에 `side_effect` 필드 추가 (ToolSideEffect: PURE/READ/WRITE/EXECUTE). Build Router의 `_MUTATING_TOOLS` 하드코딩 → `schema.side_effect == WRITE` 조건 전환
- **SS-2 LLM 빈 응답**: content 분기에서 `final_content.strip()` 비면 `TaskFailureResponse(MODEL_UNAVAILABLE, retryable=True)` 반환
- **SS-3 코드 그래프 필터**: `startswith("src/")` → `_CODEGRAPH_EXCLUDE_DIRS` 제외 기반 필터 (test, vendor, external 등)
- **SS-4 truncation 정책화**: CVE 20개, CWE 10개 하드코딩 → `config.phase1_max_cve_libraries` / `phase1_max_threat_cwes` + 잘림 로그
- **SS-5 위험 함수 regex**: `if func in msg` substring → `re.compile(rf"\b{func}\b")` word boundary. "system-wide" → "system" false positive 제거
- **SS-6 revision hint**: `_fetch_project_memory()`에 `revision` 쿼리 파라미터 추가 (additive, S5 미지원 시 무시)
- **SS-7 빌드 템플릿**: Phase 0에 `generate_initial_script()` 추가. cmake/make/autotools → 템플릿 스크립트 반환, unknown/shell → None
- **SS-8 계약 테스트**: `upstream.py` Pydantic adapter (SastFinding, CodeFunction, KbSearchHit, ScaLibrary) + 계약 테스트 12건. `f['ruleId']` 등 unsafe dict access 제거
- **P1-4.4 upstream 계약 강화**: sast_tool, codegraph_phase1_tool, knowledge_tool의 raw dict 접근 → Pydantic model_validate 전환

**WR 처리**:
- S5 → S3: `/v1/graph/stats` edgeTypes 추가 통보 (코드 변경 불필요, 삭제 완료)
- S2 → S3: Agent 응답에 `modelName`/`promptVersion` 추가 요청 → `AgentAuditInfo`에 `model_name`/`prompt_version` 필드 추가 완료

**문서 갱신**: 인수인계서 분할 구조 전환 (S2 WR 대응), 명세서 3건 업데이트

**테스트 (+37건)**:
- Analysis Agent: 134 → 149 passed
- Build Agent: 177 → 199 passed (env-dependent 5건 제외)

---

## 세션 12: Build Agent v3 + 외부 피드백 P0 수정 (2026-03-27, 완료)

**Build Agent v3 고도화 (2026-03-26)**:
- **list_files 도구 신설**: 프로젝트 디렉토리 트리 반환. 140회 read_file → 1회 list_files로 구조 파악 효율화
- **Phase 0 결정론적 사전 분석**: LLM 루프 전에 빌드 시스템(cmake/make/autotools/shell), SDK, 언어, 기존 스크립트를 자동 탐지. 시스템 프롬프트에 결과 주입
- **BuildErrorClassifier**: try_build 실패 시 9개 카테고리로 에러 분류 + 결정론적 복구 제안. LLM이 구조화된 진단을 보고 복구 결정
- **컨텍스트 압축**: TurnSummarizer 활성화 (16K 토큰 임계치). tool_call/tool 쌍 보존. read_file 50KB → 8KB + 절삭 공지
- **S4 v0.6.0 options.tools 대응**: Phase 1에 `sastTools` 파라미터 경로 개방
- **테스트**: 146 → 185 passed (+39)

**외부 피드백 P0 수정 (2026-03-27)**:
- **경로 스코프 통합**: `resolve_scoped_path()` 공통 유틸 신설 (agent-shared). Path.resolve() + is_relative_to()로 prefix confusion 방지
- **중복 호출 차단 수정**: mutating tool 성공 후 duplicate hash 초기화
- **스크립트 내용 안전성**: write_file/edit_file 시 금지 패턴 스캔 + _content_warnings
- **MessageManager API 보완**: add_user_message() 추가
- **TurnSummarizer 역할 수정**: 생략 메시지 role user → system
- **토큰 추정 보강**: tool_calls JSON 크기 포함
- **chmod 모순 해소**: "bash script.sh로 실행" 변경

---

## 세션 11: Build Agent v2 재설계 + 외부 리뷰 (2026-03-25, 완료)

- Build Agent v2 재설계: 정책 엔진, edit/delete 도구, try_build v2, 서브프로젝트 스코핑
- agent-shared 패키지 추출
- Build Agent 테스트 2 → 102 tests
- FailureCode 세분화

---

## 세션 10: Build Agent 분리 + 프로젝트 메모리 (2026-03-24, 완료)

- Build Agent 서비스 분리 (:8003)
- 프로젝트 메모리 연동
- Analysis Agent 원상복구 (deep-analyze + generate-poc만)

---

## 세션 9: 프롬프트 고도화 + Observability v2 (2026-03-23, 완료)

- 프롬프트 도구 사용 재조정, adaptive timeout 보정
- targetPath traversal 차단, origin 메타데이터 활용
- generate-poc 전용 핸들러

---

## 세션 8: Claim.detail + PoC + Adaptive Timeout (2026-03-21, 완료)

- Claim.detail 필드, generate-poc taskType
- 토큰 예산 대폭 상향, adaptive timeout
- Phase 1 pre-computed 모드, circuit breaker 503

---

## 세션 7: 에이전트 루프 버그 수정 + 도구 전환 (2026-03-20, 완료)

- code_graph.callers 전환, 에이전트 루프 턴 기반 종료
- LLM 모델 122B GPTQ-Int4 전환, CVE batch-lookup 수정

---

## 세션 6: Phase 1 확장 + 시스템 프롬프트 재설계 (2026-03-19, 완료)

- CVE 실시간 조회, KB 위협 조회, 위험 함수 호출자
- S7 분리 + Agent LLM 호출 Gateway 경유 전환

---

## 세션 5: 에이전트 통합 로깅 + Neo4j GraphRAG + Phase 1/2 (2026-03-18, 완료)

- 에이전트 통합 로깅 (14파일), Neo4j GraphRAG, 하이브리드 검색
- Phase 1/2 분리, SCA 라이브러리 분석, dangerous-callers API
