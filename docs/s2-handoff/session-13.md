# 세션 13 — 레거시 전면 제거 + S3 통합 대응 + log-analyzer 토큰 절감

**날짜**: 2026-03-28 ~ 2026-03-31
**범위**: DB 스키마 정리, 레거시 코드 제거, S3 통합 테스트 대응, MCP 도구 개선

---

## 작업 내역

### 1. DB 스키마 정리

- `rules` 테이블 완전 제거 (CREATE TABLE + ALTER TABLE + 인덱스)
- 기존 DB 호환: `DROP TABLE IF EXISTS rules` 마이그레이션 추가
- CREATE TABLE에 최종 컬럼 통합 (가독성 향상) — ALTER TABLE은 레거시 호환용 유지
- DB 18 테이블 (`rules` 제거)

### 2. 레거시 코드 전면 제거

| 제거 항목 | 파일 | 이유 |
|-----------|------|------|
| `LlmV1Adapter` | `llm-v1-adapter.ts` 삭제 | v0→v1 호환 레이어 불필요. `LlmTaskClient`에 concurrency queue 통합 |
| `MockEcu` | `mock-ecu.ts` 삭제 | 인터페이스를 `adapter-client.ts`로 인라인 |
| `IRuleDAO` | `interfaces.ts` | 구현체 없음, 미사용 |
| `makeRule()` | `factories.ts` | 미사용 팩토리 |
| `Rule` 공유 타입 | `models.ts`, `dto.ts` | 전 서비스 import 0건 |
| `rules/` 디렉토리 | 빈 디렉토리 삭제 | |
| stale dist 산출물 | `dist/dao/rule.dao.*` | 소스 삭제 후 잔여물 |

### 3. `LlmTaskClient` 리팩토링

- concurrency queue 내장 (`constructor(baseUrl, concurrency)`)
- `DynamicAnalysisService`, `DynamicTestService` → `LlmTaskClient.submitTask()` 직접 사용
- v1 TaskRequest 직접 구성 (`dynamic-annotate`, `test-plan-propose` taskType)
- `HealthController` → `LlmTaskClient` 타입으로 변경
- `composition.ts` → `llmAdapter` → `llmTaskClient` 전환

### 4. S3 통합 테스트 대응 (WR 처리)

S3가 에이전트 통합 테스트 완료 후 WR 발송. 파이프라인 gap 3건 수정:

- **서브프로젝트 격리 경로**: `target.sourcePath`를 우선 사용 (Build Agent, SAST, KB 모두 격리 경로 수신)
- **부분 빌드 지원**: `buildResult.entries > 0`이면 `built` 상태로 SAST 진행 허용
- **PoC projectPath 추가**: `POST /api/analysis/poc` 요청에 `projectPath` 필드 추가

### 5. log-analyzer MCP 토큰 절감 (S3 WR 처리)

- `truncate_msg()` — 긴 메시지 축약 (GqlStatusObject 등 중첩 JSON `{...}` 치환, max 120자)
- `dedup_messages()` — 동일 패턴 그룹핑 (`(x5)` 카운트)
- `trace_request`: `max_lines=60` 파라미터 추가, 자동 축약/중복 축약
- `search_errors`, `search_logs`: 중복 그룹핑 + 메시지 150자 잘림

### 6. 기타

- S1 QA 세션 분화 통보 수신 (영향 없음, AEGIS.md 반영)
- `db-stats.sh` 전면 갱신 (9→18개 테이블)
- S1에 Rule 엔진 제거 WR 발행 → S1 처리 완료 확인 후 삭제
- S3에 통합 대응 완료 WR 발행

---

## 커밋

- `75c0bfc` — 레거시 전면 제거 + DB 스키마 정리 + 전 서비스 동기화
- `95ec78b` — S1 처리 완료된 WR 삭제
- (미커밋) log-analyzer 토큰 절감 + S3 통합 대응 + 문서 업데이트

---

## 검증 결과

- TypeScript: 0 errors
- 테스트: 267개 전체 통과 (15 파일, 10.3s)
