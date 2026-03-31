# S1 세션 13 — 2026-03-31

## 요약

Playwright E2E 테스트 인프라 구축 + QA 전용 세션 분화 + S2 Rule 엔진 제거 WR 처리 + QA 피드백 2라운드 대응.

## 작업 내역

### 1. S2 WR: Rule 엔진 완전 제거

- `SettingsPage.css`에서 Rule Forms (7개 클래스) + Rule Rows (10개 클래스) dead CSS 제거
- Rule 타입 import, API 호출, UI 컴포넌트는 이미 없었음 (확인만)
- WR 삭제 완료

### 2. Playwright E2E 테스트 인프라 구축

신규 파일:
- `playwright.config.ts` — Chromium, webServer(:5173), 스크린샷 설정
- `e2e/tsconfig.json` — E2E 전용 TypeScript 설정
- `e2e/fixtures/base.ts` — `mockApi` 자동 주입 fixture
- `e2e/fixtures/mock-data.ts` — 한국어 모킹 데이터 (Project, Finding, Run, Gate, Approval, SourceFileEntry, Vulnerability, AnalysisResult)
- `e2e/helpers/api-mocker.ts` — `page.route()` 기반 백엔드 API 가로채기. `localhost:3000`만 가로채고 Vite 소스 파일은 통과.
- `e2e/helpers/navigation.ts` — HashRouter 네비게이션 헬퍼
- 7개 테스트 스펙 (88개 테스트)

주요 디버깅:
- `**/api/**` 패턴이 Vite 소스 파일(`/src/renderer/api/core.ts`)까지 가로채는 문제 발견 → URL origin 검사로 해결
- `fetchProjectOverview` (Pattern A: 직접 반환) vs `fetchProjectRuns` (Pattern B: `.data` 추출) — 모킹 형식 구분 필수
- 한국어 폰트: Noto Sans CJK 로컬 설치 (`~/.local/share/fonts/`)
- FilesPage: `SourceFileEntry` 형식 (`relativePath`) vs `UploadedFile` 형식 (`id`, `name`) 구분
- VulnerabilitiesPage: `recentAnalyses`에 `AnalysisResult` (with nested `vulnerabilities`) 필요

### 3. QA 전용 세션 분화

- `docs/s1-handoff/qa-guide.md` 작성 — 역할, Playwright 사용법, 체크리스트, 이슈 보고 형식
- S2에 통보 WR 발송 (S1 내부 분리, S2 영향 없음)
- QA 세션 역할 부여: "너는 S1에서 QA를 담당해."
- 핵심 원칙: 소스코드 열람 금지, 화면 명세 + API 계약서가 정답지

### 4. QA 피드백 2라운드 대응

1차 QA 리뷰 → 2차 정밀 QA 리뷰 → S1 전체 회신 → 3차 재검증

수정 완료:
- BUG-1: Finding 상세 ErrorBoundary → `/api/findings/:id` 모킹 추가
- DATA-1: Run 소요 시간 → `formatUptime(endedAt - startedAt)` 추가
- DATA-2: Run ID → `history-item-id` 추가

QA 오해 해소 (이미 구현):
- UX-2: 벌크 triage → LatestAnalysisTab에 존재. VulnerabilitiesPage에만 없음.
- UX-3: 승인 다이얼로그 → 정상 동작. 필터 탭과 액션 버튼 혼동.
- SPEC-2: 빌드 타겟 → 정적 분석 페이지에 존재. 프로젝트 설정은 SDK 전용.

로드맵 반영:
- SPEC-1 (Overview Gate/Approval), SPEC-3 (VulnerabilitiesPage 전환), DATA-3/5, CSS-2, UX-1 등 8건

## 테스트 결과

| 스위트 | 수량 |
|--------|------|
| vitest 유닛 | 347 |
| Playwright navigation | 13 |
| Playwright visual-qa (라이트) | 12 |
| Playwright interactions | 14 |
| Playwright theme | 4 |
| Playwright responsive | 5 |
| Playwright visual-qa-dark | 6 |
| Playwright qa-finding-detail | 1 |
| **총합** | **402** |

## 변경 파일

| 파일 | 변경 |
|------|------|
| `pages/SettingsPage.css` | Rule dead CSS 제거 |
| `pages/AnalysisHistoryPage.tsx` | Run 소요 시간 + ID 표시 |
| `pages/AnalysisHistoryPage.css` | duration/id 스타일 추가 |
| `package.json` | Playwright devDep + test:e2e 스크립트 |
| `playwright.config.ts` | 신규 |
| `e2e/**` | 전체 신규 (7 스펙 + fixtures + helpers + screenshots) |
| `.gitignore` | Playwright 출력 제외 |
| `docs/s1-handoff/qa-guide.md` | 신규 |
| `docs/s1-handoff/README.md` | E2E 테스트 + qa-guide 링크 추가 |
| `docs/s1-handoff/architecture.md` | Playwright 구조/실행 방법 추가 |
| `docs/s1-handoff/roadmap.md` | QA 피드백 반영 항목 추가 |
