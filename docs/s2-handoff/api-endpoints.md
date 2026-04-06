# S2 API 엔드포인트 전체 목록

> S2(AEGIS Core)가 S1에 제공하는 모든 REST API + WebSocket 엔드포인트
> 진입점: `README.md` → 필요 시 이 문서 참조

---

## 5. API 엔드포인트 전체 목록

현재 `services/backend/src/router-setup.ts` 기준으로 활성 라우터만 정리했다.

### 공통 / 프로젝트 / 파일

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/health` | 헬스체크 (LLM Gateway, S3 Agent, S4 SAST Runner, S5 KB, Build Agent, Adapter 상태 확인) |
| POST | `/api/projects` | 프로젝트 생성 |
| GET | `/api/projects` | 프로젝트 목록 |
| GET | `/api/projects/:id` | 프로젝트 상세 |
| PUT | `/api/projects/:id` | 프로젝트 수정 |
| DELETE | `/api/projects/:id` | 프로젝트 삭제 |
| GET | `/api/projects/:id/overview` | 프로젝트 개요/집계 |
| GET | `/api/projects/:projectId/files` | 프로젝트 파일 목록 |
| GET | `/api/files/:fileId/content` | 파일 내용 조회 |
| GET | `/api/files/:fileId/download` | 파일 다운로드 |
| DELETE | `/api/projects/:projectId/files/:fileId` | 프로젝트 파일 삭제 |

### 프로젝트 설정 / 활동 / 알림 / 인증

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/projects/:pid/adapters` | 프로젝트 어댑터 목록 |
| POST | `/api/projects/:pid/adapters` | 프로젝트 어댑터 등록 |
| PUT | `/api/projects/:pid/adapters/:id` | 프로젝트 어댑터 수정 |
| DELETE | `/api/projects/:pid/adapters/:id` | 프로젝트 어댑터 삭제 |
| POST | `/api/projects/:pid/adapters/:id/connect` | 프로젝트 어댑터 연결 |
| POST | `/api/projects/:pid/adapters/:id/disconnect` | 프로젝트 어댑터 해제 |
| GET | `/api/projects/:pid/settings` | 프로젝트 설정 조회 |
| PUT | `/api/projects/:pid/settings` | 프로젝트 설정 수정 |
| GET | `/api/projects/:pid/activity` | 최근 활동 타임라인 (`?limit=` 지원) |
| GET | `/api/projects/:pid/notifications/count` | 미읽음 알림 수 |
| PATCH | `/api/projects/:pid/notifications/read-all` | 프로젝트 알림 전체 읽음 처리 |
| GET | `/api/projects/:pid/notifications` | 프로젝트 알림 목록 (`?unread=true` 지원) |
| PATCH | `/api/notifications/:id/read` | 개별 알림 읽음 처리 |
| POST | `/api/auth/login` | 로그인 |
| POST | `/api/auth/logout` | 로그아웃 |
| GET | `/api/auth/me` | 현재 사용자 정보 |
| GET | `/api/auth/users` | 사용자 목록 |

### 프로파일 / SDK 레지스트리 / 타겟 라이브러리

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/sdk-profiles` | SDK 프로파일 목록 |
| GET | `/api/sdk-profiles/:id` | SDK 프로파일 상세 |
| GET | `/api/gate-profiles` | Gate 프로필 목록 |
| GET | `/api/gate-profiles/:id` | Gate 프로필 상세 |
| GET | `/api/projects/:pid/sdk` | 프로젝트 SDK 레지스트리 목록 |
| GET | `/api/projects/:pid/sdk/:id` | 등록 SDK 상세 |
| POST | `/api/projects/:pid/sdk` | SDK 등록 (업로드 또는 `localPath`) |
| DELETE | `/api/projects/:pid/sdk/:id` | SDK 삭제 |
| GET | `/api/projects/:pid/targets/:tid/libraries` | 타겟별 서드파티 라이브러리 목록 |
| PATCH | `/api/projects/:pid/targets/:tid/libraries` | 라이브러리 포함 여부 일괄 수정 |

### 소스 / 빌드 타겟 / 파이프라인 / 분석

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/projects/:pid/source/upload` | ZIP/tar.gz 소스 업로드 |
| GET | `/api/projects/:pid/source/upload-status/:uploadId` | 업로드 상태 폴링 폴백 |
| POST | `/api/projects/:pid/source/clone` | Git URL 클론 |
| GET | `/api/projects/:pid/source/files` | 소스 파일 트리 |
| GET | `/api/projects/:pid/source/file` | 파일 내용 읽기 (`?path=` 필수) |
| DELETE | `/api/projects/:pid/source` | 소스 삭제 |
| GET | `/api/projects/:pid/targets` | 빌드 타겟 목록 |
| POST | `/api/projects/:pid/targets` | 빌드 타겟 생성 `{ name, relativePath, buildProfile? }` |
| PUT | `/api/projects/:pid/targets/:id` | 빌드 타겟 수정 |
| DELETE | `/api/projects/:pid/targets/:id` | 빌드 타겟 삭제 |
| GET | `/api/projects/:pid/targets/:id/build-log` | 타겟 빌드 로그 조회 |
| POST | `/api/projects/:pid/targets/discover` | 빌드 타겟 자동 탐색 (S4 호출) |
| POST | `/api/projects/:pid/pipeline/run` | 전체 파이프라인 실행 |
| POST | `/api/projects/:pid/pipeline/run/:targetId` | 단일 타겟 파이프라인 재실행 |
| GET | `/api/projects/:pid/pipeline/status` | 프로젝트 파이프라인 상태 |
| POST | `/api/analysis/run` | Quick→Deep 분석 실행 (202) `{ projectId, targetIds? }` |
| GET | `/api/analysis/status` | 모든 진행 중 분석 |
| GET | `/api/analysis/status/:analysisId` | 단일 분석 진행률 |
| POST | `/api/analysis/abort/:analysisId` | 분석 중단 |
| GET | `/api/analysis/results` | 결과 목록 (`?projectId=` 지원) |
| GET | `/api/analysis/results/:analysisId` | 결과 상세 |
| DELETE | `/api/analysis/results/:analysisId` | 결과 삭제 |
| GET | `/api/analysis/summary` | 대시보드 요약 (static+deep 합산, `?projectId=` 필수, `&period=` 선택) |
| POST | `/api/analysis/poc` | PoC 생성 `{ projectId, findingId }` → S3 generate-poc |

### 동적 분석 / 동적 테스트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/dynamic-analysis/sessions` | 동적 분석 세션 생성 |
| GET | `/api/dynamic-analysis/sessions` | 동적 분석 세션 목록 (`?projectId=` 지원) |
| GET | `/api/dynamic-analysis/sessions/:id` | 세션 상세 |
| POST | `/api/dynamic-analysis/sessions/:id/start` | 세션 시작 |
| DELETE | `/api/dynamic-analysis/sessions/:id` | 세션 종료 + 종합 분석 |
| GET | `/api/dynamic-analysis/scenarios` | 공격 시나리오 목록 |
| POST | `/api/dynamic-analysis/sessions/:id/inject` | 단일 CAN 메시지 주입 |
| POST | `/api/dynamic-analysis/sessions/:id/inject-scenario` | 시나리오 주입 |
| GET | `/api/dynamic-analysis/sessions/:id/injections` | 주입 이력 조회 |
| POST | `/api/dynamic-test/run` | 동적 테스트 실행 |
| GET | `/api/dynamic-test/results` | 테스트 결과 목록 (`?projectId=` 지원) |
| GET | `/api/dynamic-test/results/:testId` | 테스트 결과 상세 |
| DELETE | `/api/dynamic-test/results/:testId` | 테스트 결과 삭제 |

### Run / Finding / Gate / Approval / Report

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/projects/:pid/runs` | 프로젝트 Run 목록 |
| GET | `/api/runs/:id` | Run 상세 |
| GET | `/api/projects/:pid/findings` | Finding 목록 (`status`, `severity`, `module`, `sourceType`, `q`, `sort`, `order` 필터 지원) |
| GET | `/api/projects/:pid/findings/summary` | Finding 집계 |
| GET | `/api/projects/:pid/findings/groups` | Finding 그룹 조회 (`?groupBy=ruleId|location`) |
| PATCH | `/api/findings/bulk-status` | Finding 벌크 상태 변경 |
| GET | `/api/findings/:id/history` | Finding fingerprint 이력 |
| GET | `/api/findings/:id` | Finding 상세 |
| PATCH | `/api/findings/:id/status` | Finding 상태 변경 |
| GET | `/api/projects/:pid/gates` | 프로젝트 Gate 결과 목록 |
| GET | `/api/projects/:pid/gates/runs/:runId` | 특정 Run의 Gate 결과 |
| GET | `/api/gates/:id` | Gate 상세 |
| POST | `/api/gates/:id/override` | Gate override 요청 (Approval 생성) |
| GET | `/api/projects/:pid/approvals/count` | 프로젝트 승인 대기 수 |
| GET | `/api/projects/:pid/approvals` | 프로젝트 Approval 목록 |
| GET | `/api/approvals/:id` | Approval 상세 |
| POST | `/api/approvals/:id/decide` | Approval 승인/거부 |
| GET | `/api/projects/:pid/report` | 프로젝트 전체 보고서 |
| GET | `/api/projects/:pid/report/static` | 정적 분석 보고서 |
| GET | `/api/projects/:pid/report/dynamic` | 동적 분석 보고서 |
| GET | `/api/projects/:pid/report/test` | 동적 테스트 보고서 |
| POST | `/api/projects/:pid/report/custom` | 커스터마이징 보고서 |

### WebSocket 채널

| 메서드 | 경로 | 설명 |
|--------|------|------|
| WebSocket | `/ws/notifications?projectId=` | 알림 실시간 push |
| WebSocket | `/ws/dynamic-analysis?sessionId=` | 동적 분석 실시간 이벤트 |
| WebSocket | `/ws/static-analysis?analysisId=` | 정적 분석 브로드캐스트 채널 (현재 broadcaster 유지) |
| WebSocket | `/ws/dynamic-test?testId=` | 동적 테스트 진행률 |
| WebSocket | `/ws/analysis?analysisId=` | Quick→Deep 진행률 |
| WebSocket | `/ws/upload?uploadId=` | 소스 업로드 진행률 |
| WebSocket | `/ws/pipeline?projectId=` | 파이프라인 진행률 |
| WebSocket | `/ws/sdk?projectId=` | SDK 등록/검증 진행률 |
