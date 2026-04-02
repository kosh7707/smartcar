# S1 Frontend — Roadmap

> **마지막 업데이트: 2026-04-02**

---

## 백엔드 기동 후 가능

1. **풀스택 통합 테스트** — Playwright 모킹 OFF + 실제 백엔드. 업로드 → 분석 → Finding 상세 → 상태 변경 E2E
2. **QA 세션 재검증** — 모킹 한계로 보류된 항목 확인 (SPEC-4 소스 업로드 뷰, UX-4 QG Finding 링크)
3. **알림 WS 실시간 테스트** — mock WS 대신 실제 백엔드 WS 연결 확인

## S1 독립 코드 작업 (남은 항목)

1. **`includedPaths` 편집 다이얼로그** — 기존 서브프로젝트 파일 선택 수정. `SubprojectCreateDialog` 재사용
2. **워크플로우 네비게이션** [Low] — 사이드바를 기능 목록 → 워크플로우 단계로 재설계 (QA FRICTION-29)
3. **1440px 와이드 레이아웃 최적화** [Low] — 정보 밀도 개선 (QA CSS-3)

## 세션 15 완료 항목

### S2 API 연동 (A/B/C)
- [x] A-1: Finding CWE/CVE 표시 (VulnerabilitiesPage, FindingDetailView)
- [x] A-2: Finding confidenceScore 수치 표시 (ConfidenceBadge 확장)
- [x] B-1: 프로젝트 목록 보안 요약 (severitySummary, gateStatus, unresolvedDelta)
- [x] B-2: Overview 트렌드 카드 (newFindings, resolvedFindings, unresolvedTotal)
- [x] B-3: 빌드 로그 조회 (BuildLogViewer 모달)
- [x] B-4/B-5: Gate 프로필 선택 (ProjectSettingsPage)
- [x] C-1: Finding 그루핑 (아코디언 UI, ruleId/location 기준)
- [x] C-2: 커스텀 보고서 (CustomReportModal)
- [x] C-3: 인증 UI (LoginPage, AuthContext, soft-auth)
- [x] C-4: 알림 시스템 (NotificationDropdown, NotificationContext, WS)

### QA 분석가 UX 리뷰 독립 14건
- [x] CONFUSING-3: 프로젝트 설명 placeholder 도메인 힌트
- [x] CONFUSING-7: 서브프로젝트 상태 설명 (TargetStatusBadge title)
- [x] CONFUSING-10: SOURCE_TYPE_LABELS 개선 (룰 엔진, AI 보조, 심층 에이전트, SAST 도구)
- [x] CONFUSING-14: ConfidenceBadge sourceType+score 통합 표시
- [x] CONFUSING-18: ReportPage stat 라벨 명확화
- [x] CONFUSING-21: Gate 규칙 한 줄 설명 (RULE_INFO)
- [x] CONFUSING-24: DonutChart centerLabel prop
- [x] CONFUSING-31: "준비 중" 메뉴 제거
- [x] FRICTION-5: 빈 정적 분석 → EmptyState CTA
- [x] FRICTION-15: 활성 필터 요약 칩
- [x] MISSING-17: PoC 가능 뱃지
- [x] MISSING-26: Overview 서브프로젝트 확인 (이미 구현됨)
- [x] MISSING-30: 키보드 단축키 (j/k/o/Enter/Esc/?)
- [x] MOCK-32/33: Finding 상세 + 파일 프리뷰 mock 보강

## 미구현 (선택)

| 기능 | 비고 |
|------|------|
| 독립 Run/Finding 목록 페이지 | 대시보드 내 뷰로 이미 존재. 독립 라우트 전환은 선택 사항 |
| 동적 분석 콘솔 | S6 + S2 WS 확장 필요 |
| 보고서 PDF 커스터마이징 | 서버 측 PDF 생성 확장 필요 |
