# 세션 10 — 백로그 일괄 처리 — build-resolve + Transient 제거 + 테스트 + MCP

**날짜**: 2026-03-25

---

- **Transient 코드 제거** (10개 파일 삭제):
  - `static-analysis.service.ts`, `chunker.ts`, `static-analysis.controller.ts` — AnalysisOrchestrator가 대체
  - `project-rules.controller.ts`, `rule.dao.ts`, `rule.service.ts`, `rules/*` (4파일) — 룰 엔진 완전 제거
  - `bootstrap.ts` no-op 전환, `project.service.ts`에서 RuleService 의존 제거
  - LlmV1Adapter/LlmTaskClient는 유지 (DynamicAnalysis가 아직 사용)
- **Build Agent 연동** (build-resolve):
  - `build-agent-client.ts` 신규 — agent-client.ts 패턴, POST :8003/v1/tasks (build-resolve)
  - `config.ts`에 `buildAgentUrl` 추가 (기본: :8003)
  - `errors.ts`에 `BuildAgentUnavailableError`, `BuildAgentTimeoutError` 추가
  - `PipelineOrchestrator`에 Step 0 (resolve) 삽입: discovered→resolving→configured→building...
  - resolve 실패 시 비치명적 폴백 (기존 buildProfile 있으면 계속 진행)
  - `health.controller.ts`에 Build Agent 헬스체크 추가
- **공유 모델 확장**:
  - `BuildTargetStatus`에 `resolving`, `resolve_failed` 추가 (16상태)
  - `BuildTarget`에 `buildCommand?: string` 추가
  - DB `build_targets` 테이블에 `build_command TEXT` 마이그레이션
- **테스트 26개 추가** (176→202):
  - BuildAgentClient 계약 테스트 8개 (성공/실패/503 재시도/에러/헬스체크)
  - PipelineOrchestrator 단위 테스트 11개 (happy path, resolve/build/scan/graph 실패, 다중 타겟, WS)
  - Pipeline API 계약 테스트 3개 (status/phase 매핑, 404)
  - copyToSubproject 테스트 4개 (구조 보존, 트래버설 방지, 덮어쓰기)
- **MCP 로그 도구 고도화**: SQLite 캐시 레이어 추가 (mtime/size 기반 무효화, 인덱스 검색 10ms)
- **문서 갱신**: shared-models.md (BuildTargetStatus 16상태, buildCommand, PipelinePhase), 백로그 업데이트
- **상태: TypeScript 0에러, 테스트 202개 통과**
