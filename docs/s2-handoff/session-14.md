# 세션 14 — 보안 분석가 UX 전면 대응: CWE/CVE + Gate 프로필 + 알림 + 사용자 시스템

**날짜**: 2026-04-01
**범위**: S1-QA 보안 분석가 UX 리뷰 WR 전면 처리 (11 Phase)

---

## 작업 내역

### Phase 1: Finding CWE/CVE + confidenceScore

- Vulnerability, Finding 모델에 `cweId`, `cveIds` 필드 추가
- Finding 모델에 `confidenceScore` (0.0~1.0) 추가
- DB findings 테이블: `cwe_id TEXT`, `cve_ids TEXT`, `confidence_score REAL` 컬럼 추가
- result-normalizer: SAST metadata.cweId 추출, Agent policyFlags CWE 패턴 파싱
- finding.dao: JSON 왕복 변환 지원

### Phase 2: 빌드 로그 API

- `GET /api/projects/:pid/targets/:id/build-log` 엔드포인트 추가

### Phase 3: 프로젝트 보안 요약

- `ProjectListItem` DTO 신규 (extends Project + lastAnalysisAt, severitySummary, gateStatus, unresolvedDelta)
- finding.dao: `severitySummaryByProjectId`, `unresolvedCountByProjectId` 메서드 추가
- run.dao: `findLatestCompletedRuns` 확장
- gate-result.dao: `latestByProjectId` 메서드 추가
- project.service: `findAllWithSummary()` 메서드 추가

### Phase 4: Overview 트렌드/델타

- ProjectOverviewResponse에 `trend` 필드 추가 (newFindings, resolvedFindings, unresolvedTotal)
- finding.dao: `resolvedCountSince` 메서드 추가
- project.service: `getOverview` 확장

### Phase 5: Gate 프로필 시스템

- **신규** `gate-profiles.ts` — 3개 프리셋: default, strict, relaxed
- quality-gate.service: 프로필 기반 평가 (settingsService에서 gateProfileId 조회)
- project-settings.controller: `createGateProfileRouter` 추가
- `GET /api/gate-profiles`, `GET /api/gate-profiles/:id`

### Phase 6: 프로젝트 설정 확장

- ProjectSettings에 `gateProfileId`, `analysisPolicy` 필드 추가
- project-settings.service: `KNOWN_KEYS`, `JSON_KEYS` 확장

### Phase 7: WR 발행

- `s2-to-s1-model-api-extension.md` 작성 (공유 모델 변경 통보)
- `s2-to-s4-cwe-metadata.md` 작성 (SastFinding.metadata.cweId 표준화 요청)
- 원본 WR (`s1-to-s2-analyst-ux-api-needs.md`) 삭제

### Phase 8: Finding 그루핑

- finding.dao: `groupByRuleId`, `groupByLocation` 메서드 추가
- finding.service: `getGroups(projectId, groupBy)` 메서드 추가
- `GET /api/projects/:pid/findings/groups?groupBy=ruleId|location`

### Phase 9: 보고서 커스터마이징

- report.service: `generateCustomReport` 메서드 추가
- `POST /api/projects/:pid/report/custom`
- ProjectReport.customization 필드 추가 (executiveSummary, companyName, logoUrl 등)

### Phase 10: 알림 시스템

- **신규** `notification.dao.ts`, `notification.service.ts`, `notification.controller.ts`
- DB: `notifications` 테이블 + 인덱스 2개
- WS: `/ws/notifications` (notificationWs broadcaster)
- 4개 트리거: result-normalizer(analysis_complete, critical_finding), quality-gate(gate_failed), approval(approval_pending)
- REST: GET /, GET /count, PATCH /read-all, PATCH /:id/read

### Phase 11: 사용자/역할 시스템 (soft auth)

- **신규** `user.dao.ts` (UserDAO, SessionDAO), `user.service.ts`, `auth.middleware.ts`, `auth.controller.ts`
- DB: `users`, `sessions` 테이블
- REST: POST /login, POST /logout, GET /me, GET /users
- `AUTH_REQUIRED` 환경변수 (기본 false = soft auth)
- 최초 기동 시 admin 자동 시딩 (admin/admin1234)
- 비밀번호: scryptSync + random salt

---

## 신규 파일 (8개)

```
services/backend/src/services/gate-profiles.ts
services/backend/src/dao/notification.dao.ts
services/backend/src/services/notification.service.ts
services/backend/src/controllers/notification.controller.ts
services/backend/src/dao/user.dao.ts
services/backend/src/services/user.service.ts
services/backend/src/middleware/auth.middleware.ts
services/backend/src/controllers/auth.controller.ts
```

## DB 변경

- 3 테이블 추가 (18→21개): `notifications`, `users`, `sessions`
- `findings` 테이블: `cwe_id TEXT`, `cve_ids TEXT DEFAULT '[]'`, `confidence_score REAL` 컬럼 추가

## 주요 결정사항

- Gate 프로필은 하드코딩 프리셋 (sdk-profiles 패턴 동일). 커스텀 프로필 DB 저장은 미래 확장
- soft auth 모드: `AUTH_REQUIRED=false` 기본 → S1 로그인 UI 구현 전까지 운영
- composition.ts에 **Tier 1.5** 도입 (알림/사용자 → QualityGateService보다 먼저 생성)
- Notification 트리거를 resultNormalizer, qualityGateService, approvalService에 주입
- ProjectSettings.analysisPolicy는 `{ tools?, rulesets? }` 구조로 정의만 완료 (실제 사용은 미래)

## 검증 결과

- TypeScript: 0 errors
- 테스트: 322개 전체 통과 (267 기존 + 55 신규)

## WR 상태

| WR | 상태 |
|----|------|
| `s1-to-s2-analyst-ux-api-needs.md` | 처리 완료 → 삭제됨 |
| `s2-to-s1-model-api-extension.md` | 신규 발행 — S1 처리 대기 |
| `s2-to-s4-cwe-metadata.md` | 신규 발행 — S4 처리 대기 |
