# S1 세션 15 — 2026-04-02

## 작업 범위

S2 API/모델 확장 완료 통보(A/B/C 전부) + QA 분석가 UX 리뷰 S1 독립 14건 + mock 보강.

## 완료 항목

### Phase 0: 기반
- `@aegis/shared` 빌드 확인 (cweId, cveIds, confidenceScore, ProjectListItem, GateProfile, Notification, User 등)
- mock-data.ts: PROJECTS → ProjectListItem 확장, FINDINGS에 CWE/CVE/score 추가, overview trend, GATE_PROFILES, BUILD_LOG, FINDING_GROUPS, NOTIFICATIONS, AUTH_USER, EVIDENCE_REFS, AUDIT_LOG_ENTRIES, FILE_CONTENT_RESPONSE 신규
- api-mocker.ts: 14개 신규 라우트 추가, setupAuth() 추가, Finding 상세 evidenceRefs/auditLog 보강
- 신규 API: auth.ts (login/logout/me/users), notifications.ts (fetch/count/markRead/markAllRead/wsUrl)
- 수정 API: core.ts (auth 헤더), projects.ts (ProjectListItem), gate.ts (profiles), pipeline.ts (buildLog), analysis.ts (findingGroups), report.ts (customReport), client.ts (re-export)
- 신규 컨텍스트: AuthContext.tsx (soft-auth), NotificationContext.tsx (WS 연동)

### Phase 1: S2 API 연동
- ProjectContext: Project[] → ProjectListItem[]
- ProjectsPage: severity mini-bar + gateStatus dot + unresolvedDelta + lastAnalysisAt
- OverviewPage: trend 카드 (신규/해결/미해결)
- VulnerabilitiesPage: CWE 컬럼 (MITRE 링크), PoC 뱃지
- ConfidenceBadge: sourceType + confidenceScore 수치 표시
- FindingDetailView: CWE 링크 뱃지 + CVE NVD 링크 + score
- BuildLogViewer: 모달 컴포넌트 신규 (모노스페이스 로그 + 복사)
- BuildTargetSection: 빌드 로그 버튼 추가
- ProjectSettingsPage: Gate 프로필 선택 섹션 추가

### Phase 2: QA 14건
- CONFUSING-3: placeholder → "예: Engine ECU v2.3, AUTOSAR CP 기반"
- CONFUSING-7: TargetStatusBadge description 추가, "준비 완료" → "분석 가능"
- CONFUSING-10: SOURCE_TYPE_LABELS 개선
- CONFUSING-14: ConfidenceBadge 확장
- CONFUSING-18: ReportPage stat 라벨
- CONFUSING-21: RULE_INFO 구조 + 설명 표시
- CONFUSING-24: DonutChart centerLabel prop
- CONFUSING-31: comingSoon 메뉴 제거
- FRICTION-5: 빈 정적 분석 → EmptyState CTA
- FRICTION-15: 활성 필터 칩 요약
- MISSING-17: PoC 뱃지 (agent + detail 존재 시)
- MISSING-30: useKeyboardShortcuts 훅 + j/k/o/Enter/Esc/? 단축키
- MOCK-32/33: evidenceRefs + auditLog + 파일 content mock 보강

### Phase 3: 알림 + 인증
- NotificationDropdown: 드롭다운 컴포넌트
- StatusBar: 벨 아이콘 + unread 뱃지 + 사용자 표시
- LoginPage: 로그인 폼
- App.tsx: AuthProvider 래핑, /login 라우트

### Phase 4: 그루핑 + 커스텀 보고서
- VulnerabilitiesPage: groupBy 토글 (ruleId/location/none), 아코디언 UI
- CustomReportModal: 모달 폼 (제목/요약/회사/로고/언어)
- ReportPage: 커스텀 보고서 버튼 추가

## 테스트

- TypeScript: 에러 없음
- 유닛: 347개 전부 통과 (SOURCE_TYPE_LABELS, TargetStatusBadge 테스트 수정)
- E2E: 미실행 (다음 세션에서 검증)

## WR 처리

- 삭제: s1qa-to-s1-design-audit.md (처리 완료)
- 삭제: s1-to-s1-session14-backlog.md (정독 완료)
- 삭제: s2-to-s1-model-api-extension.md (S1 구현 완료)
- 유지: s1qa-to-s1-analyst-ux-review.md (14건 전수 처리 완료, QA 확인 후 삭제)

## 신규 파일 (12개)

- src/renderer/api/auth.ts
- src/renderer/api/notifications.ts
- src/renderer/contexts/AuthContext.tsx
- src/renderer/contexts/NotificationContext.tsx
- src/renderer/hooks/useKeyboardShortcuts.ts
- src/renderer/components/static/BuildLogViewer.tsx + .css
- src/renderer/components/NotificationDropdown.tsx + .css
- src/renderer/components/CustomReportModal.tsx + .css
- src/renderer/pages/LoginPage.tsx + .css
- src/renderer/api/mock-handler.ts

## 추가 작업: Dev Mock Mode + CSS 리디자인

### Dev Mock Mode (QA WR 처리)
- `VITE_MOCK=true npm run dev:mock`으로 백엔드 없이 mock 데이터로 전 페이지 렌더링
- `mock-handler.ts`: E2E api-mocker.ts 라우트 맵 1:1 복제 (40+ 라우트)
- `core.ts`: apiFetch 진입부 mock 분기 (dynamic import, production 번들 미포함)
- `NotificationContext.tsx`: mock 모드에서 WS 연결 차단
- `package.json`: `dev:mock` 스크립트 추가
- WR 삭제: `s1qa-to-s1-playwright-plugin-mock.md`

### CSS 리디자인 "Tactical Operations Console"
- 액센트: #0EA5E9 → #22D3A7 (포스포 그린)
- 폰트: IBM Plex Sans → DM Sans + Instrument Sans (display)
- 토큰 전면 재설계 (tokens.css)
- 전 페이지/컴포넌트 CSS 폴리시 (20+ 파일)
- 하드코딩 색상/--primary 참조 전면 정리 (10건)
