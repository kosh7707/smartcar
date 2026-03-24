# S2 내부: 미결 작업 백로그

**날짜**: 2026-03-24
**성격**: 내부 기록 (다음 세션 참조용)

---

## 즉시 (다음 세션)

### 1. build-resolve 연동
S3 Build Agent(:8003)의 `build-resolve` taskType을 파이프라인에 통합.
- 파이프라인에서 `configured` 단계 전에 S3에 build-resolve 요청
- S3가 빌드 명령어 + buildProfile을 자동 결정 → DB 저장
- S2: AgentClient에 build-resolve 호출 추가 또는 별도 BuildAgentClient 생성

### 2. E2E 풀스택 통합 테스트
업로드 → 서브 프로젝트 생성(includedPaths 물리적 복사) → 빌드(S4) → 스캔(S4) → 코드그래프(S5) → Deep(S3) 전 구간 검증.

## 단기

### 3. MCP 로그 도구 고도화
- S3 피드백 반영 완료 (agent 중첩 객체, toolCalls)
- S1 피드백 반영 완료 (Origin, requestId 필터)
- 추가: DB 캐싱으로 대규모 로그 성능 개선

### 4. Transient 코드 제거
- rules/, RuleService, rule.dao, project-rules.controller
- static-analysis.service/controller, chunker, mergeAndDedup
- LlmV1Adapter, LlmTaskClient
- 관련 테스트

### 5. 신규 코드 단위 테스트
- PipelineOrchestrator
- KbClient
- 물리적 복사 (copyToSubproject)
- 파이프라인 API 계약 테스트

## 후순위

### 6. source/files composition DB 캐싱
현재 매 호출마다 계산. 프로젝트 규모 커지면 캐싱 필요.

### 7. includedPaths 체크박스 트리 v2
S1에서 파일 선택 UI 구현 후, 양방향 동기화 검증.

### 8. 인수인계서 갱신 (지속)
세션 종료 시마다 s2-handoff/README.md 최신화.
