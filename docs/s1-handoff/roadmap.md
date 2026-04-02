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

## 세션 15 QA 검증 최종 결과

- **33 PASS / 0 FAIL / 1 DEFERRED** (FRICTION-5: 빈 상태 mock 미지원)
- 초회 검증 → BUG 4건 + JR 8건 수정 → 재검증 전건 통과
- 증거: `e2e/qa-captures/session15-reqa/`
- WR 4건 처리 완료 삭제

## 미구현 (선택)

| 기능 | 비고 |
|------|------|
| 독립 Run/Finding 목록 페이지 | 대시보드 내 뷰로 이미 존재. 독립 라우트 전환은 선택 사항 |
| 동적 분석 콘솔 | S6 + S2 WS 확장 필요 |
| 보고서 PDF 커스터마이징 | 서버 측 PDF 생성 확장 필요 |
