# 세션 5 — 7인 체제 + Quick→Deep 파이프라인 + 프론트 개편

**날짜**: 2026-03-19~20

---

- S7(LLM Gateway + LLM Engine) 신설 → 7인 체제 확정
- smartcar→AEGIS 리네이밍 완료 (S2 담당분 + to-all 공지)
- S6 이관 완료 (WS 계약서 검토+승인, AEGIS.md 등재)
- start.sh/stop.sh 전 서비스 개별 스크립트 경유 통일, HEALTH_TIMEOUT 60초
- **신규 파이프라인 구현**: AgentClient, SastClient, AnalysisOrchestrator, ProjectSourceService
- **신규 API**: `/api/analysis/*` (Quick→Deep), `/api/projects/:pid/source/*` (ZIP/Git)
- **신규 WS**: `/ws/analysis` (analysis-progress, quick-complete, deep-complete, error)
- shared 타입 확장: AnalysisModule(deep_analysis), FindingSourceType(agent, sast-tool), ArtifactType(agent-assessment), WsAnalysisMessage
- ResultNormalizer에 `normalizeAgentResult()` 추가 (claims→Finding)
- Health에 Agent+SAST health 추가, 에러 클래스 4개 추가
- S1 프론트 개편 완료 (동적 분석 숨김, 소스 업로드 UI, Quick→Deep 진행률, sourceType 뱃지)
- S3 자문 기반 Orchestrator 단순화 (files[] 조립 제거 → projectPath 모드)
- 로그 스크립트 단순화 (4개→1개: reset-logs.sh)
- LLM 모델 전환 문서 반영 (35B→122B GPTQ)
- 코드 리뷰 5건 수정 (unsafe cast, array bounds, rmdirSync, health catch, path sanitization)
- .gitignore: uploads/, *.o, **/data/threat-db-raw/ 추가
- **상태: TypeScript 0에러, 테스트 133개 통과, E2E 통합 테스트 대기**
