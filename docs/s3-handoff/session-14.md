# 세션 14: 에이전트 E2E 통합 테스트 (2026-03-28~31, 완료)

코드 점검 → E2E 통합 테스트(v1~v4) → WR 교환 → warning 개선 → 최종 검증 완료.

**코드 점검 (사전)**:
- **revision_hint NameError**: `_run_individual_tools()` 시그니처에 파라미터 누락 → 추가
- **generate_initial_script() 미연동**: Phase 0 cmake/make/autotools 템플릿 → `tasks.py` 연동 + 시스템 프롬프트 힌트
- **S4 partial 상태**: Phase1Result에 `sast_partial_tools`/`sast_timed_out_files` 추가, Phase 2 프롬프트에 경고 주입
- **인수인계서 구조**: `session-log.md` → `session-{N}.md` 분할 (AEGIS.md 규칙 준수)

**E2E 테스트 스크립트**:
- `scripts/e2e.sh` 신규 — 6개 모드 (build, analyze, poc, build-analyze, analyze-poc, all)
- KB `/v1/ready` 게이트 추가 (S5 WR 대응)

**통합 테스트 발견 버그 6건**:
- `toolResults` dict 순회 오류 (`.values()` 수정) — S4 WR로 원인 규명
- PoC 미니 Phase 1 `X-Timeout-Ms` 헤더 누락 → 추가
- PoC KB search `raise_for_status()` → 응답 body 읽기로 개선 + `top_k` 제거
- 시스템 프롬프트 예시 ref 오인 → 플레이스홀더로 교체
- evidence 검증 hard → soft 모드 전환
- Analysis Agent force_report 메커니즘 추가 (도구 6회 후 보고서 강제)

**설정 튜닝**:
- Build Agent: `max_steps` 10→15
- Analysis Agent: `max_steps` 6→12, `RAG_ENABLED` false→true, `cheap_calls` 3→6, `medium_calls` 2→4, `no_evidence_threshold` 2→4

**warning 3건 개선 (v4)**:
- Phase 1 evidence refs 프롬프트 주입 (`eref-sast-{ruleId}` 생성 → allowed_refs + 프롬프트 포함)
- tier별 도구 필터링 (`get_available_schemas(bm)` — 예산 남은 tier 도구만 제공)
- force_report 사전 경고 (도구 4회 시 잔여 횟수 안내)

**S4 부분 빌드 지원**:
- `_validate_build_result()`: `userEntries > 0`일 때 부분 compile_commands 사용 가능 정보를 LLM에 전달

**WR 처리 (7건 발송, 7건 회신)**:
- S4: SAST 파싱 예외 → toolResults dict 형식 확인, response_model_exclude_none 적용
- S4: success/exitCode 불일치 → exitCode 기반 판정으로 복원 + warning 필드 추가
- S5: expiresAt 경고 → 센티넬 값 수정 + 기동 시 자동 마이그레이션
- S5: 통합 테스트 체크리스트 → X-Timeout-Ms 전수 확인
- S5: E2E 로그 위생 → ready 게이트 추가
- S7: LLM 보고서 전환 비결정성 → 모델 특성 확인, force_report 방식 검증
- S2: 통합 테스트 준비 완료 → 파이프라인 gap 3건 수정 확인

**최종 테스트 결과 (v4)**:
- Analysis Agent: 149 passed, Build Agent: 199 passed (348 total)
- E2E: analyze OK (4 claims, confidence=0.755), poc OK (4/4), all OK
- 전 서비스 에러율 0.0%
