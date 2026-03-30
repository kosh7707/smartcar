# 세션 13: 외부 피드백 전수 반영 (2026-03-28, 완료)

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
