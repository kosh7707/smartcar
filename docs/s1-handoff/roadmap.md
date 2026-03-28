# S1 Frontend — Roadmap

> **마지막 업데이트: 2026-03-28**

---

## 백엔드 기동 후 가능

1. **통합 테스트 QA** — 업로드 → 서브프로젝트 → 빌드 파이프라인 → 분석 → WS 진행률 → Finding 상세 → 상태 변경 E2E
2. **시각 QA** — 대시보드 KPI/차트, 반응형(768px), 라이트/다크 테마 확인

## S1 독립 코드 작업

1. **`includedPaths` 편집 다이얼로그** — 기존 서브프로젝트의 파일 선택을 수정하는 UI. `SubprojectCreateDialog` 파일 트리 재사용 가능. 백엔드 API(`updateBuildTarget`)는 이미 존재.

## S2 모델 확장 대기

1. 동적 분석 운영 콘솔 고도화 (S2 WS 확장 + S6 필요)

## 미구현 (선택)

| 기능 | 비고 |
|------|------|
| 독립 Run/Finding 목록 페이지 (`/runs`, `/findings`) | 대시보드 내 뷰로 이미 존재. 독립 라우트 전환은 선택 사항 |
| 동적 분석 콘솔 | 현재 ComingSoonPlaceholder. S6 + S2 WS 확장 필요 |
