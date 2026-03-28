# S1 Frontend — Architecture

> 파일 구조, 설계 결정, 에러 핸들링, 버그 이력, UI 컨벤션 등 상세 정보.

---

## 1. 파일 구조

```
services/frontend/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── main/                          Electron main process
│   │   ├── index.ts                   BrowserWindow 생성
│   │   └── preload.ts                 contextBridge (window.api)
│   └── renderer/                      React 앱
│       ├── index.html
│       ├── main.tsx                   ReactDOM.createRoot
│       ├── App.tsx                    라우팅 + ProjectProvider
│       ├── api/
│       │   ├── client.ts             barrel re-export (하위 호환)
│       │   ├── core.ts               공통 인프라 (apiFetch, ApiError, getBackendUrl, logError)
│       │   ├── projects.ts           프로젝트 CRUD + 설정 + Overview + Activity
│       │   ├── source.ts             소스 관리 + 프로젝트 파일
│       │   ├── analysis.ts           Runs/Findings + bulk-status + history
│       │   ├── pipeline.ts           빌드 타겟 + 파이프라인 + 라이브러리
│       │   ├── gate.ts               Quality Gate 조회/오버라이드
│       │   ├── approval.ts           Approval Queue 조회/결정/카운트
│       │   ├── sdk.ts                SDK 등록/조회/삭제 + WS URL
│       │   ├── report.ts             보고서
│       │   └── dynamic.ts            동적 세션/CAN/어댑터/테스트 (숨김 기능)
│       ├── contexts/
│       │   ├── ProjectContext.tsx     프로젝트 목록 공유 상태
│       │   ├── ToastContext.tsx       전역 toast 알림 (에러/경고/성공, 액션 버튼)
│       │   └── AnalysisGuardContext.tsx 분석 진행 중 네비게이션 가드
│       ├── hooks/
│       │   ├── useElapsedTimer.ts     경과 시간 타이머 공통 훅
│       │   ├── useAnalysisWebSocket.ts WS 기반 Quick+Deep 2단계 분석 훅 (타겟 진행률, mode 지원)
│       │   ├── useBuildTargets.ts     빌드 타겟 CRUD + 자동 탐색 + includedPaths 지원
│       │   ├── usePipelineProgress.ts 서브 프로젝트 빌드→스캔 파이프라인 WS 훅
│       │   ├── useUploadProgress.ts   업로드 WS 진행률 (received→extracting→indexing→complete)
│       │   ├── useStaticDashboard.ts  대시보드 데이터 + 최신 Run 상세 + 활성 분석 폴링
│       │   ├── useDynamicTest.ts      동적 테스트 흐름 (숨김 — 코드 유지)
│       │   └── useAdapters.ts         어댑터 상태 (숨김 — 코드 유지)
│       ├── layouts/
│       │   └── ProjectLayout.tsx      breadcrumb + Outlet
│       ├── components/
│       │   ├── Sidebar.tsx            2-tier 사이드바
│       │   ├── StatusBar.tsx          하단 상태바 (3단계 헬스, 30초 폴링, 서버 버전+가동시간)
│       │   ├── ErrorBoundary.tsx      렌더링 크래시 방어 (class component)
│       │   ├── ui/                    공통 UI 24개
│       │   ├── static/               정적 분석 23개
│       │   ├── dynamic/              동적 분석 (숨김 — 코드 유지)
│       │   └── finding/              Finding/Evidence (EvidencePanel, EvidenceViewer)
│       ├── constants/                  공유 상수 (모듈, 언어, 동적, Finding, Evidence, defaults, sdkProfiles)
│       ├── types/                     타입 선언 (window.d.ts, react-html.d.ts)
│       ├── pages/                     14개 페이지 + CSS
│       ├── styles/                    토큰, 리셋, 전역 등 CSS 9개
│       └── utils/                     format, severity, fileMatch, location, tree, findingOverlay, markdown, cveHighlight, highlight, analysis, theme, wsEnvelope
```

---

## 2. 핵심 설계 결정

### 에러 핸들링 (5계층)

1. **앱 안정성**: `ErrorBoundary` (렌더링 크래시 → fallback UI)
2. **사용자 알림**: `ToastContext` (에러/경고/성공, 5초 자동 닫기, 최대 5개 스택, 액션 버튼)
3. **API 에러 분류**: `apiFetch` → `ApiError` (`code`, `retryable`, `requestId`)
4. **MSA 연동**: `X-Request-Id` 자동 부착, `errorDetail` 파싱, `retryable` 시 "다시 시도" 버튼
5. **로깅**: `logError(context, e)`, `healthFetch(url)`. `console.error` 대신 `logError` 사용

에러 코드: `INVALID_INPUT`, `NOT_FOUND`, `CONFLICT`, `LLM_UNAVAILABLE`, `LLM_HTTP_ERROR`, `LLM_PARSE_ERROR`, `LLM_TIMEOUT`, `DB_ERROR`, `INTERNAL_ERROR` 등 → 한국어 메시지

### Electron vs 브라우저

- Electron: `window.api` (preload contextBridge)
- 브라우저 (Vite dev): `fetch` 직접 호출
- `getBackendUrl()` 자동 분기

### 타입 공유

- 프론트에서 로컬 타입 정의 금지. 모든 타입은 `@aegis/shared`에서 import

### Finding 상태 머신

7-state: Open, Needs Review, Accepted Risk, False Positive, Fixed, Needs Revalidation, Sandbox.
상세 전이 규칙: `docs/specs/frontend.md` 4.2장 참조.

### Evidence-first UI

Finding 상세 표시 순서: 현재 객체 → 상태 → 결과 → 근거(evidence) → 누가/무엇이/어떤 버전으로

### LLM 결과 표시

- AI 출력은 명확히 라벨링 (`AI 요약`, `AI 가설`)
- deterministic 결과와 시각적 구분
- LLM-only finding은 `Sandbox` 상태로 시작
- provenance: modelName, promptVersion (AgentResultPanel에서 표시)

### Observability

`docs/specs/observability.md` 준수.
- service 식별자: `s1-frontend`
- X-Request-Id: `apiFetch`에서 `crypto.randomUUID()` 자동 생성
- 에러 시 `requestId`를 `ApiError`에 포함하여 콘솔 출력

### React hooks 규칙

- 모든 `useState`/`useEffect`는 조건부 return 이전에 선언 필수

---

## 3. 버그 수정 이력

| 이슈 | 원인 | 수정 |
|------|------|------|
| 브라우저에서 백엔드 통신 불가 | `window.api` undefined | `client.ts` fetch fallback |
| "Rendered fewer hooks" | useState가 조건부 return 뒤 | useState 상단 이동 |
| 취약점 중복 카운트 | 모든 분석 합산 | 최신 분석 기준 집계 |
| 취약점 상세 코드가 가짜 | mock 하드코딩 | downloadFile() 실제 fetch |
| Overview 하단 수평 스크롤 | grid 자식 min-width: auto | min-width: 0 추가 |
| VulnerabilitiesPage hooks 에러 | useMemo가 조건부 return 뒤 | useMemo를 early return 위로 이동 |
| 코드 위치 파싱 불일치 | `getFilename()` 콜론 포함 경로 실패 | `parseLocation()` 기반 통일 |
| Finding 제목 잘림 | S2 `slice(0,100)` | CSS line-clamp 2줄 방어 |
| 파일 네비게이션 오류 | 상대 경로 해석 | 절대 경로 전환 |
| `toast.info` 크래시 | API에 `info` 없음 | `toast.warning` 전환 |
| 브레드크럼 불일치 | `pageNames` 누락 | 한국어 라벨 추가 |
| 보고서 에러/빈 상태 혼동 | 동일 EmptyState | `loadError` 상태 분리 |
| Finding 수 불일치 | `findingCount` vs `findings.length` | `findings.length` 기준 |
| 소요 시간 0초 | 타임스탬프 버그 | `durationSec > 0` 방어 |

---

## 4. 실행 방법

> **서버를 직접 실행하지 마라.** 기동/종료는 사용자에게 요청할 것.

```bash
./scripts/start.sh                    # 전체 기동
cd services/frontend && npm run dev:renderer  # 프론트만 (:5173)
cd services/frontend && npm test      # 테스트 (347건)
```

환경변수: `services/frontend/.env` → `VITE_BACKEND_URL`

---

## 5. UI 컨벤션

| 항목 | 규칙 |
|------|------|
| 아이콘 | lucide-react |
| severity 컬러 | `--severity-critical/high/medium/low` |
| 테마 | 라이트/다크/시스템 3-way (`theme.ts`, `tokens.css`) |
| 빈 상태 | `EmptyState` 컴포넌트 |
| 로딩 | `Spinner`, `.centered-loader` |
| 포커스 | `:focus-visible` 아웃라인 |
