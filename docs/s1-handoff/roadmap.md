# S1 Frontend — Roadmap

> **마지막 업데이트: 2026-03-31**

---

## 백엔드 기동 후 가능

1. **풀스택 통합 테스트** — Playwright 모킹 OFF + 실제 백엔드. 업로드 → 분석 → Finding 상세 → 상태 변경 E2E
2. **QA 세션 재검증** — 모킹 한계로 보류된 항목 확인 (SPEC-4 소스 업로드 뷰, UX-4 QG Finding 링크)

## S1 독립 코드 작업 (QA 피드백 반영 순)

1. **Overview에 Gate/Approval 요약 추가** [High] — `fetchProjectGates` + `fetchApprovalCount` 호출 추가. Gate 배너 + Approval 대기 건수 표시. (QA SPEC-1)
2. **VulnerabilitiesPage Finding 모델 전환** [High] — Vulnerability → Finding 기반 재설계. sourceType 5종 + confidence + 벌크 triage 추가. (QA SPEC-3, UX-2)
3. **Approval targetId 링크** [Medium] — 승인 요청에서 Gate/Finding 상세로 네비게이션. (QA DATA-3)
4. **보고서 증적 수 표시** [Medium] — Finding 테이블에 `evidenceRefs.length` 컬럼. (QA DATA-5)
5. **768px 사이드바 축소** [Medium] — 아이콘 전용 모드 또는 햄버거 메뉴. (QA CSS-2)
6. **`includedPaths` 편집 다이얼로그** — 기존 서브프로젝트 파일 선택 수정. `SubprojectCreateDialog` 재사용.
7. **Approval 만료 임박 경고** [Low] — 24시간 이내 빨간 텍스트/아이콘. (QA DATA-4)
8. **버전 라벨 구분** [Low] — StatusBar "백엔드 vX" / 설정 "프론트 vY". (QA DATA-6)
9. **출처별 분포 색상 강화** [Low] — tokens.css `--source-*` 변수 대비 강화. (QA CSS-7)

## S2 API 확장 대기

1. **프로젝트 카드 보안 포스처** — `GET /api/projects` 응답에 per-project severity 요약 + Gate 통과 여부 필요. S2에 WR 필요. (QA UX-1)
2. 동적 분석 운영 콘솔 고도화 (S2 WS 확장 + S6 필요)

## 미구현 (선택)

| 기능 | 비고 |
|------|------|
| 독립 Run/Finding 목록 페이지 | 대시보드 내 뷰로 이미 존재. 독립 라우트 전환은 선택 사항 |
| Run 클릭 → RunDetail 직접 진입 | 현재 정적 분석 대시보드로 이동. 라우팅 구조 변경 필요 (QA UX-5) |
| 1440px 와이드 레이아웃 최적화 | 정보 밀도 개선. 현재도 사용 가능 (QA CSS-3) |
| 동적 분석 콘솔 | ComingSoonPlaceholder. S6 + S2 WS 확장 필요 |
