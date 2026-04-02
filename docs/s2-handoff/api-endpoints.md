# S2 API 엔드포인트 전체 목록

> S2(AEGIS Core)가 S1에 제공하는 모든 REST API + WebSocket 엔드포인트
> 진입점: `README.md` → 필요 시 이 문서 참조

---

## 5. API 엔드포인트 전체 목록

### 완료

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/health` | 헬스체크 (S3 연결 + 어댑터 현황) |
| POST | `/api/static-analysis/upload` | 파일 업로드 (multipart, projectId) |
| POST | `/api/static-analysis/run` | 정적 분석 실행 (projectId + fileIds) |
| GET | `/api/static-analysis/results?projectId=` | 프로젝트별 분석 결과 목록 |
| GET | `/api/static-analysis/results/:id` | 분석 결과 조회 |
| DELETE | `/api/static-analysis/results/:id` | 분석 결과 삭제 |
| GET | `/api/static-analysis/report/:id` | 보고서 데이터 |
| POST | `/api/projects` | 프로젝트 생성 |
| GET | `/api/projects` | 프로젝트 목록 |
| GET | `/api/projects/:id` | 프로젝트 상세 |
| PUT | `/api/projects/:id` | 프로젝트 수정 |
| DELETE | `/api/projects/:id` | 프로젝트 삭제 |
| GET | `/api/projects/:id/overview` | Overview (모듈별 최신 1건 집계, fileCount) |
| GET | `/api/projects/:projectId/files` | 프로젝트 파일 목록 |
| GET | `/api/files/:fileId/content` | 파일 내용 조회 (JSON) |
| GET | `/api/files/:fileId/download` | 파일 다운로드 (text/plain) |
| DELETE | `/api/projects/:projectId/files/:fileId` | 파일 삭제 |
| GET | `/api/projects/:pid/rules` | 프로젝트 룰 목록 |
| POST | `/api/projects/:pid/rules` | 룰 생성 (name + pattern 필수) |
| PUT | `/api/projects/:pid/rules/:id` | 룰 수정 (소속 검증) |
| DELETE | `/api/projects/:pid/rules/:id` | 룰 삭제 (소속 검증) |
| GET | `/api/projects/:pid/adapters` | 프로젝트 어댑터 목록 (연결 상태 포함) |
| POST | `/api/projects/:pid/adapters` | 어댑터 등록 (name + url) |
| PUT | `/api/projects/:pid/adapters/:id` | 어댑터 수정 (소속 검증) |
| DELETE | `/api/projects/:pid/adapters/:id` | 어댑터 삭제 (소속 검증) |
| POST | `/api/projects/:pid/adapters/:id/connect` | 어댑터 연결 (소속 검증) |
| POST | `/api/projects/:pid/adapters/:id/disconnect` | 어댑터 해제 (소속 검증) |
| POST | `/api/dynamic-analysis/sessions` | 동적 분석 세션 생성 (projectId + adapterId 필수) |
| GET | `/api/dynamic-analysis/sessions` | 동적 분석 세션 목록 (?projectId=) |
| GET | `/api/dynamic-analysis/sessions/:id` | 세션 상세 (alerts + recentMessages) |
| POST | `/api/dynamic-analysis/sessions/:id/start` | 모니터링 시작 |
| DELETE | `/api/dynamic-analysis/sessions/:id` | 세션 종료 + LLM 종합 분석 |
| GET | `/api/dynamic-analysis/scenarios` | 사전정의 공격 시나리오 목록 (6개) |
| POST | `/api/dynamic-analysis/sessions/:id/inject` | CAN 메시지 단일 주입 |
| POST | `/api/dynamic-analysis/sessions/:id/inject-scenario` | 사전정의 시나리오 실행 |
| GET | `/api/dynamic-analysis/sessions/:id/injections` | 주입 이력 조회 |
| WebSocket | `/ws/dynamic-analysis?sessionId=` | S1 실시간 push (메시지/알림/상태/주입결과) |
| WebSocket | `/ws/static-analysis?analysisId=` | 정적 분석 프로그레스 push (progress/warning/complete) |
| POST | `/api/dynamic-test/run` | 동적 테스트 실행 (projectId + config + adapterId 필수) |
| GET | `/api/dynamic-test/results?projectId=` | 프로젝트별 테스트 결과 목록 |
| GET | `/api/dynamic-test/results/:testId` | 테스트 결과 상세 조회 |
| DELETE | `/api/dynamic-test/results/:testId` | 테스트 결과 삭제 |
| WebSocket | `/ws/dynamic-test?testId=` | 동적 테스트 프로그레스 push (progress/finding/complete) |
| GET | `/api/projects/:pid/settings` | 프로젝트 설정 조회 (defaults fallback) |
| PUT | `/api/projects/:pid/settings` | 프로젝트 설정 수정 (partial update, buildProfile 포함) |
| GET | `/api/sdk-profiles` | SDK 프로파일 전체 목록 (12개) |
| GET | `/api/sdk-profiles/:id` | SDK 프로파일 상세 (id로 조회) |
| GET | `/api/projects/:pid/runs` | 프로젝트 Run 목록 |
| GET | `/api/runs/:id` | Run 상세 (findings 포함) |
| GET | `/api/projects/:pid/findings` | Finding 목록 (?status=&severity=&module=) |
| GET | `/api/projects/:pid/findings/summary` | Finding 집계 (byStatus, bySeverity, total) |
| GET | `/api/findings/:id` | Finding 상세 (evidenceRefs + auditLog) |
| PATCH | `/api/findings/:id/status` | Finding 상태 변경 ({ status, reason, actor? }) |
| GET | `/api/projects/:pid/gates` | 프로젝트 Quality Gate 목록 |
| GET | `/api/gates/:id` | Gate 상세 |
| GET | `/api/projects/:pid/approvals` | 프로젝트 Approval 목록 |
| POST | `/api/approvals/:id/decide` | Approval 승인/거부 ({ decision, actor, comment }) |
| GET | `/api/projects/:pid/report` | 프로젝트 전체 보고서 |
| GET | `/api/projects/:pid/report/static` | 정적 분석 모듈 보고서 |
| GET | `/api/projects/:pid/report/dynamic` | 동적 분석 모듈 보고서 |
| GET | `/api/projects/:pid/report/test` | 동적 테스트 모듈 보고서 |

### 분석 파이프라인 API (Quick→Deep + BuildTarget + PoC)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/projects/:pid/source/upload` | ZIP/tar.gz 소스 업로드 |
| POST | `/api/projects/:pid/source/clone` | Git URL 클론 |
| GET | `/api/projects/:pid/source/files` | 소스 파일 트리 |
| GET | `/api/projects/:pid/source/file?path=` | 파일 내용 읽기 |
| DELETE | `/api/projects/:pid/source` | 소스 삭제 |
| GET | `/api/projects/:pid/targets` | 빌드 타겟 목록 |
| POST | `/api/projects/:pid/targets` | 빌드 타겟 생성 { name, relativePath, buildProfile? } |
| PUT | `/api/projects/:pid/targets/:id` | 빌드 타겟 수정 |
| DELETE | `/api/projects/:pid/targets/:id` | 빌드 타겟 삭제 |
| POST | `/api/projects/:pid/targets/discover` | 빌드 타겟 자동 탐색 (S4 호출) |
| POST | `/api/analysis/run` | Quick→Deep 분석 실행 (202) { projectId, targetIds? } |
| GET | `/api/analysis/status` | 모든 진행 중 분석 |
| GET | `/api/analysis/status/:id` | 단일 분석 진행률 |
| POST | `/api/analysis/abort/:id` | 분석 중단 |
| GET | `/api/analysis/results?projectId=` | 결과 목록 |
| GET | `/api/analysis/results/:id` | 결과 상세 |
| DELETE | `/api/analysis/results/:id` | 결과 삭제 |
| GET | `/api/analysis/summary?projectId=&period=` | 대시보드 요약 (static+deep 합산) |
| POST | `/api/analysis/poc` | PoC 생성 { projectId, findingId } → S3 generate-poc |
| WebSocket | `/ws/analysis?analysisId=` | Quick→Deep 진행률 push |

### 서브 프로젝트 파이프라인 API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/projects/:pid/pipeline/run` | 전체 빌드&스캔 파이프라인 실행 (202) { targetIds? } |
| POST | `/api/projects/:pid/pipeline/run/:targetId` | 개별 서브 프로젝트 재실행 |
| GET | `/api/projects/:pid/pipeline/status` | 전체 서브 프로젝트 상태 |
| WebSocket | `/ws/pipeline?projectId=` | 파이프라인 진행률 push |
| WebSocket | `/ws/upload?uploadId=` | 업로드 진행률 push |

### 세션 14 추가 (2026-04-01)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/gate-profiles` | Gate 프로필 목록 (3개) |
| GET | `/api/gate-profiles/:id` | Gate 프로필 상세 |
| GET | `/api/projects/:pid/notifications` | 프로젝트 알림 목록 (?unread=true) |
| GET | `/api/projects/:pid/notifications/count` | 미읽음 카운트 |
| PATCH | `/api/projects/:pid/notifications/read-all` | 전체 읽음 처리 |
| PATCH | `/api/notifications/:id/read` | 개별 읽음 처리 |
| POST | `/api/auth/login` | 로그인 (세션 토큰 발급) |
| POST | `/api/auth/logout` | 로그아웃 |
| GET | `/api/auth/me` | 현재 사용자 정보 |
| GET | `/api/auth/users` | 사용자 목록 |
| GET | `/api/projects/:pid/findings/groups` | Finding 그루핑 (?groupBy=) |
| POST | `/api/projects/:pid/report/custom` | 커스터마이징 보고서 |
| GET | `/api/projects/:pid/targets/:id/build-log` | 빌드 로그 조회 |
| WebSocket | `/ws/notifications?projectId=` | 알림 실시간 push |
