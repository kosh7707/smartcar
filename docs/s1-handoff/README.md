# S1. Frontend + QA 인수인계서

> **반드시 `docs/AEGIS.md`를 먼저 읽을 것.** 프로젝트 공통 제약 사항, 역할 정의, 소유권이 그 문서에 있다.
> 이 문서는 S1(Frontend + QA) 개발을 이어받는 다음 세션을 위한 인수인계서다.
> 이것만 읽으면 현재 상태를 파악하고 바로 작업을 이어갈 수 있어야 한다.
> **마지막 업데이트: 2026-03-25**

---

## 1. 프로젝트 전체 그림

### AEGIS — Automotive Embedded Governance & Inspection System

7-서비스 MSA 구조 (2026-03-19 재편):

```
                     S1 (Frontend :5173)
                          │
                     S2 (AEGIS Core :3000)  ← 플랫폼 오케스트레이터
                    ╱     │     ╲      ╲
                 S3       S4     S5      S6
               Agent    SAST     KB    동적분석
              :8001    :9000   :8002    :4000
                │
               S7
            Gateway
             :8000
                │
           LLM Engine
            (DGX Spark)
```

| 역할 | 담당 | 포트 |
|------|------|------|
| **S1** | **Frontend + QA** | :5173 |
| S2 | AEGIS Core (Backend) — 플랫폼 오케스트레이터 | :3000 |
| S3 | Analysis Agent — 보안 분석 자율 에이전트 | :8001 |
| S4 | SAST Runner (6도구 + SCA + 코드 구조 + 빌드) | :9000 |
| S5 | Knowledge Base (Neo4j + Qdrant) | :8002 |
| S6 | Dynamic Analysis (ECU Simulator + Adapter) | :4000 |
| S7 | LLM Gateway + LLM Engine 관리 — 플랫폼 LLM 서비스 | :8000, DGX |

통신 방향: `S1 → S2` (프론트는 S2하고만 통신). S2가 S3~S7을 내부적으로 호출.

### 보안 검증 구조

- **결정론적 계층**: S4(SAST Runner)가 6개 도구로 정적 분석 + SCA + 코드 그래프 (LLM 없이)
- **LLM 해석 계층**: S3(Analysis Agent)가 결정론적 결과를 LLM에 주입하여 구조화 분석
- **위협 지식**: S5(Knowledge Base)가 CWE/CVE/ATT&CK 그래프 + 벡터 검색 제공
- 프론트에서는 탐지 출처로 구분 (`rule-engine` / `llm-assist` / `both` / `sast-tool` / `agent`)

---

## 2. 너의 역할과 경계

### 너는

- S1 Frontend + QA 개발자
- `services/frontend/` 하위 코드를 소유
- `services/shared/` (`@aegis/shared`) — **S2 단독 소유**. S1은 참조만, 변경 필요 시 work-request로 요청
- `docs/specs/frontend.md` 직접 관리
- `docs/api/shared-models.md` — S2 관리. S1은 참조
- **공통 제약 사항**: `docs/AEGIS.md` 참조 (역할, 소유권, 소통 규칙 일체)

### 설계 원칙 (반드시 숙지)

1. **Evidence-first UI** — 결과보다 근거를 먼저 보여준다
2. **Analyst-first** — triage + evidence 탐색이 메인 플로우
3. **LLM은 보조 정보** — AI 출력을 확정 사실처럼 보여주지 않는다
4. **프론트는 표현 계층** — 판단의 source of truth는 백엔드

상세 설계 원칙은 `docs/specs/frontend.md` 2장 참조.

### API 계약 소통 원칙 (필수)

- **다른 서비스의 동작은 반드시 API 계약서(`docs/api/`)로만 파악한다**
- **다른 서비스의 코드를 절대 읽지 않는다** — 코드를 보고 동작을 파악하거나 거기에 맞춰 구현하는 것은 금지
- 계약서에 없는 필드/엔드포인트는 "존재하지 않는다"고 간주한다
- 계약서와 실제 동작이 다르면, 해당 서비스 소유자에게 계약서 갱신을 work-request로 요청한다
- **공유 모델(`shared-models.md`) 또는 API 계약서가 변경되면, 영향받는 상대 서비스에게 반드시 work-request로 고지한다**
- 계약서 없이 우회 구현하면 나중에 반드시 깨진다 (예: LLM 직접 health check 사건)

### 다른 서비스 코드

- S2~S7 코드는 기본적으로 수정하지 않으며 **읽는 것도 금지** (API 계약서로만 소통)

### 작업 요청 주고받기

- **경로**: `docs/work-requests/`
- **파일명**: `{보내는쪽}-to-{받는쪽}-{주제}.md`
- 세션 시작 시 이 폴더를 확인하여 밀린 요청이 있는지 체크

---

## 3. 기술 스택

| 항목 | 선택 |
|------|------|
| 프레임워크 | Electron + React 18 |
| 언어 | TypeScript |
| 빌드 | Vite |
| 라우팅 | react-router-dom v6 (HashRouter) |
| 상태관리 | React Context + useState |
| 아이콘 | lucide-react |
| 스타일 | CSS (라이트/다크/시스템 3-way 테마, CSS 변수 토큰 시스템) |
| API 통신 | fetch (Electron preload / 브라우저 직접) |
| 실시간 통신 | WebSocket |
| 공유 타입 | @aegis/shared (monorepo) |
| 코드 하이라이팅 | highlight.js (14개 언어, 라이트/다크 테마) |
| 마크다운 렌더링 | react-markdown + remark-gfm |
| 테스트 | vitest + @testing-library/react + jsdom (357 테스트) |

---

## 4. 파일 구조

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
│       │   ├── projects.ts           프로젝트 CRUD + 설정 + Overview
│       │   ├── source.ts             소스 관리 + 프로젝트 파일
│       │   ├── analysis.ts           정적 분석 + Runs/Findings
│       │   ├── rules.ts              룰 CRUD
│       │   ├── pipeline.ts           빌드 타겟 + 파이프라인
│       │   ├── report.ts             보고서
│       │   └── dynamic.ts            동적 세션/CAN/어댑터/테스트 (숨김 기능)
│       ├── contexts/
│       │   ├── ProjectContext.tsx     프로젝트 목록 공유 상태
│       │   └── ToastContext.tsx       전역 toast 알림 (에러/경고/성공, 액션 버튼)
│       ├── hooks/
│       │   ├── useElapsedTimer.ts     경과 시간 타이머 공통 훅
│       │   ├── useAnalysisWebSocket.ts WS 기반 Quick+Deep 2단계 분석 훅 (타겟 진행률 포함)
│       │   ├── useBuildTargets.ts     빌드 타겟 CRUD + 자동 탐색 + includedPaths 지원
│       │   ├── usePipelineProgress.ts 서브 프로젝트 빌드→스캔 파이프라인 WS 훅
│       │   ├── useUploadProgress.ts   업로드 WS 진행률 (received→extracting→indexing→complete)
│       │   ├── useStaticDashboard.ts  대시보드 데이터 + 최신 Run 상세 + 활성 분석 폴링
│       │   ├── useStaticAnalysis.ts   정적 분석 흐름 (레거시 동기, 미사용)
│       │   ├── useAsyncAnalysis.ts    비동기 분석 (레거시, useAnalysisWebSocket으로 대체)
│       │   ├── useDynamicTest.ts      동적 테스트 흐름 (숨김 — 코드 유지)
│       │   └── useAdapters.ts         어댑터 상태 (숨김 — 코드 유지)
│       ├── layouts/
│       │   └── ProjectLayout.tsx      breadcrumb + Outlet
│       ├── components/
│       │   ├── Sidebar.tsx            2-tier 사이드바
│       │   ├── StatusBar.tsx          하단 상태바 (3단계 헬스: ok/degraded/unhealthy, 30초 폴링)
│       │   ├── ErrorBoundary.tsx      렌더링 크래시 방어 (class component)
│       │   ├── ui/                    공통 UI (배지, 다이얼로그, 카드, FileTreeNode, TargetStatusBadge, TargetProgressStepper, ComingSoonPlaceholder, PeriodSelector, TrendChart 등 27개)
│       │   ├── static/               정적 분석 (Dashboard, SourceUploadView, SourceTreeView, TwoStageProgressView, BuildTargetSection, BuildProfileForm, TargetSelectDialog, SubprojectCreateDialog, AgentResultPanel, Run/Finding 상세 등 24개)
│       │   ├── dynamic/              동적 분석 하위 컴포넌트 (숨김 — 코드 유지)
│       │   └── finding/              Finding/Evidence 컴포넌트 (EvidencePanel, EvidenceViewer)
│       ├── constants/                  공유 상수 (모듈, 언어, 동적, Finding, Evidence, defaults, sdkProfiles)
│       ├── types/                     타입 선언 (window.d.ts, react-html.d.ts)
│       ├── pages/                     각 페이지 컴포넌트 + CSS
│       ├── styles/                    토큰, 리셋, 전역, 컴포넌트, 코드뷰어, 하이라이트, 애니메이션, 레이아웃, 유틸리티 CSS (9개)
│       └── utils/                     format, severity, fileMatch, location, tree, findingOverlay, markdown, cveHighlight, highlight, analysis, theme
```

---

## 5. 라우팅 구조

### 현재 동작 중

```
/                                → redirect /projects
/projects                        → ProjectsPage
/projects/:projectId             → ProjectLayout
  /overview                      → OverviewPage
  /static-analysis               → StaticAnalysisPage (dashboard|sourceUpload|sourceTree|progress|runDetail|findingDetail|legacyResult)
  /files                         → FilesPage
  /files/:fileId                 → FileDetailPage
  /vulnerabilities               → VulnerabilitiesPage
  /analysis-history              → AnalysisHistoryPage
  /report                        → ReportPage (모듈 탭, 필터, Finding 테이블, 감사 추적, PDF 내보내기)
  /dynamic-analysis               → ComingSoonPlaceholder (준비 중)
  /dynamic-test                   → ComingSoonPlaceholder (준비 중)
  /settings                      → ProjectSettingsPage (LLM Gateway URL + 빌드 타겟 관리)
/settings                        → SettingsPage (글로벌: 백엔드 URL, 테마 3-way)
```

**"준비 중" 라우트** (2026-03-25): `/dynamic-analysis`, `/dynamic-test` — 라우트+사이드바 등록, ComingSoonPlaceholder 표시 (실제 페이지 코드는 유지, 라우트에 연결하지 않음)

### 추가 예정

```
/projects/:projectId
  /targets                       → TargetAsset 목록
  /runs                          → Run 목록
  /runs/:runId                   → Run 상세
  /findings                      → Finding 목록 (triage)
  /findings/:findingId           → Finding 상세 + evidence
  /quality-gate                  → Quality Gate 결과
  /approvals                     → Approval Queue
```

---

## 6. 구현 현황

### 완료 (동작 중)

| 기능 | 컴포넌트 | 비고 |
|------|---------|------|
| 프로젝트 CRUD | ProjectsPage + ProjectContext | 생성/조회/삭제 |
| Overview 대시보드 | OverviewPage | 도넛, StatCard(모듈별 분포+언어별), 파일/취약점/이력 |
| 정적 분석 대시보드 | StaticAnalysisPage + StaticDashboard | SonarQube 패턴 2-탭 (최신 분석: Gate+미해결+출처별 분포 / 전체 현황: KPI+해결률+차트+랭킹), 활성 분석 배너 |
| 소스코드 업로드 | SourceUploadView | ZIP/tar.gz 드래그 앤 드롭 + Git URL 클론, 디렉토리 요약, 타겟 탐색 버튼 |
| 소스 트리 탐색기 | SourceTreeView | 2패널(트리+코드 프리뷰), Finding 오버레이(폴더별 severity 배지), 검색, 반응형 |
| 빌드 타겟 관리 | BuildTargetSection + BuildProfileForm | 타겟 목록/추가/편집/삭제, SDK 프로파일 선택(12+1), 자동 탐색(S4), 상세 설정 |
| 타겟 선택 분석 | TargetSelectDialog | 분석 실행 전 타겟 체크 선택, 전체 선택/해제, 하위 호환(타겟 없으면 기존 플로우) |
| 2단계 분석 진행률 | TwoStageProgressView + useAnalysisWebSocket | Quick SAST → Deep Agent WebSocket 2단계, 타겟별 진행률, 중간 결과 열람, 중단 |
| Run 상세 | RunDetailView | Run 메타 + GateResultCard + Finding 파일별 그룹 |
| Finding 상세 | FindingDetailView | Evidence-first 레이아웃, 상태 변경, 감사 로그, 상세 분석(마크다운), PoC 생성(agent Finding) |
| 정적 분석 레거시 | AnalysisResultsView + VulnerabilityDetailView | ?analysisId= URL 호환 유지 |
| 동적 분석 | DynamicAnalysisPage + MonitoringView | **숨김** — 코드 유지, 라우트/사이드바 제거 |
| 동적 테스트 | DynamicTestPage + useDynamicTest | **숨김** — 코드 유지, 라우트/사이드바 제거 |
| 파일 탐색기/상세 | FilesPage + FileDetailPage | 트리 뷰, 코드, 취약점 하이라이팅 |
| 취약점 통합 뷰 | VulnerabilitiesPage | 분석 세션별 그룹, 심각도/날짜 필터, 모듈별 컬러 구분 |
| 분석 이력 | AnalysisHistoryPage | 전 모듈 타임라인 |
| 보고서 | ReportPage | 프로젝트 보고서 (모듈 탭, 필터, Finding 테이블, Run/Gate, 승인, 감사 추적, PDF 내보내기) |
| 설정 | SettingsPage + ProjectSettingsPage | 글로벌/프로젝트 (LLM URL + 빌드 타겟 관리) |
| 에러 핸들링 | ErrorBoundary, ToastContext, apiFetch 에러 분류 | X-Request-Id, errorDetail 대응, retryable 재시도 버튼 |
| 공통 UI | Sidebar, StatusBar, 10+ ui 컴포넌트 | — |
| Finding UI 컴포넌트 | FindingStatusBadge, ConfidenceBadge, SourceBadge, FindingSummary, StateTransitionDialog | FindingDetailView에 연결 완료, 전 배지 title 툴팁 |
| Evidence 뷰어 | EvidencePanel, EvidenceItemRow, EvidenceViewer | FindingDetailView에서 연동 완료 |
| 대시보드 UI | PeriodSelector, TrendChart, GateResultCard, LatestAnalysisTab, OverallStatusTab | 공통 컴포넌트 + 2-탭 구조 |

### 미구현 (S2 API/모델 확장 대기)

| 기능 | 선행 조건 |
|------|----------|
| TargetAsset / VersionSnapshot 계층 | shared 모델 (S2) |
| 독립 Run/Finding 목록 페이지 (/runs, /findings 라우트) | 대시보드 내 뷰로 존재. 독립 라우트 전환은 선택 사항 |
| Quality Gate 화면 | Gate 엔티티 + API (S2) |
| Approval Queue | Approval 엔티티 + API (S2) |
| 동적 분석 운영 콘솔 고도화 | 현재 숨김 상태. 재활성화 시 S2 WS 확장 필요 |
| LLM provenance panel | LLM metadata 확장 (S2/S3) |

---

## 7. 핵심 설계 결정

### 에러 핸들링 아키텍처

4계층 구조로 설계됨:

1. **앱 안정성**: `ErrorBoundary` (렌더링 크래시 → fallback UI, Sidebar/StatusBar 유지), `unhandledrejection` 전역 핸들러 (`main.tsx`)
2. **사용자 알림**: `ToastContext` — 전역 toast (에러/경고/성공, `info` 미지원), 3초 자동 닫기, 우측 하단 고정, 최대 5개 스택, 액션 버튼 지원
3. **API 에러 분류**: `apiFetch`에서 네트워크 에러 / HTTP 상태코드 / JSON 파싱 실패 분류, `ApiError` 커스텀 에러 클래스 (`code`, `retryable`, `requestId`)
4. **MSA 연동**: 모든 요청에 `X-Request-Id` 자동 부착, S2 `errorDetail` (구조화 에러 코드) 파싱, `retryable` 에러 시 toast에 "다시 시도" 버튼 표시
5. **로깅 인프라**: `logError(context, e)` — `ApiError`에서 `requestId`를 추출해 로그에 포함. `healthFetch(url)` — 헬스체크 전용 래퍼 (`X-Request-Id` 부착, 에러 시 throw 안 함). 전 컴포넌트에서 `console.error` 대신 `logError` 사용. WebSocket 연결/해제/에러에 `console.info`/`console.warn` 로깅 추가.

에러 코드 매핑: `INVALID_INPUT`, `NOT_FOUND`, `CONFLICT`, `ADAPTER_UNAVAILABLE`, `LLM_UNAVAILABLE`, `LLM_HTTP_ERROR`, `LLM_PARSE_ERROR`, `LLM_TIMEOUT`, `DB_ERROR`, `INTERNAL_ERROR` → 한국어 사용자 메시지

### Electron vs 브라우저 이중 지원

- Electron: `window.api` (preload.ts contextBridge)
- 브라우저 (Vite dev): `fetch` 직접 호출
- `client.ts`의 `getBackendUrl()`이 자동 분기

### 프로젝트 스코프 원칙

- 룰, 어댑터, 설정은 모두 프로젝트 스코프 (`/api/projects/:pid/...`)
- 글로벌 `/api/rules`, `/api/adapters` 라우트 없음

### 타입 공유

- 프론트에서 로컬 타입 정의 금지
- 모든 타입은 `@aegis/shared`에서 import

### Finding 상태 머신 (새 방향)

7-state: Open, Needs Review, Accepted Risk, False Positive, Fixed, Needs Revalidation, Sandbox.
상세 전이 규칙은 `docs/specs/frontend.md` 4.2장 참조.

### Evidence-first UI

Finding 상세에서 보여야 할 순서:
1. 현재 객체가 무엇인지
2. 어떤 상태인지
3. 결과
4. 근거 (evidence)
5. 누가/무엇이/어떤 버전으로

### LLM 결과 표시 원칙

- AI 출력은 명확히 라벨링 (`AI 요약`, `AI 가설`)
- deterministic 결과와 시각적 구분
- LLM-only finding은 `Sandbox` 상태로 시작
- provenance 표시: prompt version, model version, validation status

### Observability

`docs/specs/observability.md` 준수. 로그 레벨 숫자 표준, 서비스 식별자, X-Request-Id 전파 규칙은 해당 문서 참조.
- service 식별자: `s1-frontend`
- 로그 파일: 해당 없음 (브라우저 콘솔)
- X-Request-Id: `apiFetch`에서 `crypto.randomUUID()` 자동 생성 + 전달 (`client.ts`)
- 에러 시 `requestId`를 `ApiError` 클래스에 포함하여 콘솔 출력

### React hooks 규칙

- 모든 `useState`/`useEffect`는 조건부 return 이전에 선언 필수

---

## 8. 버그 수정 이력

| 이슈 | 원인 | 수정 |
|------|------|------|
| 브라우저에서 백엔드 통신 불가 | `window.api` undefined | `client.ts` fetch fallback |
| "Rendered fewer hooks" | useState가 조건부 return 뒤 | useState 상단 이동 |
| 취약점 중복 카운트 | 모든 분석 합산 | 최신 분석 기준 집계 |
| 취약점 상세 코드가 가짜 | mock 하드코딩 | downloadFile() 실제 fetch |
| Overview 하단 수평 스크롤 | grid 자식 min-width: auto | min-width: 0 추가 |
| VulnerabilitiesPage hooks 에러 | useMemo가 조건부 return 뒤 | useMemo를 early return 위로 이동 |
| 코드 위치 파싱 불일치 | `getFilename()`이 `split(":")[0]` 사용, 콜론 포함 경로 실패 | `getFileNameFromLocation()` 신규 도입, `parseLocation()` 기반 통일 |
| 청크 표시 혼란 | "청크 3/41" 사용자 이해 불가 | "LLM 분석 X/Y 단계"로 라벨 변경 |
| Finding 제목 잘림 | S2 `slice(0,100)` 하드코딩 (S2에 완화 요청) | S1 `.vuln-title`에 CSS line-clamp 2줄 방어 |
| 파일 네비게이션 오류 | `navigate('files/...')` 상대 경로 → `/static-analysis/files/...`로 해석 | 절대 경로 `navigate('/projects/${projectId}/files/${matched.id}')` 전환 |
| `toast.info is not a function` | `ToastApi`에 `info` 메서드 없음 (`error`/`warning`/`success`만 존재) | 모든 `toast.info` → `toast.warning` 전환 |
| 브레드크럼 한/영 불일치 | `ProjectLayout.pageNames`에 `analysis-history`, `report` 누락 | `pageNames` 맵에 한국어 라벨 추가 |
| 보고서 에러/빈 상태 혼동 | API 500 에러와 데이터 없음이 동일 EmptyState 표시 | `loadError` 상태 추가, 에러 UI / 빈 데이터 UI 분리 |
| Finding 수 불일치 (52 vs 65) | `run.findingCount`와 실제 `findings.length` 불일치 (S2 데이터 정합성) | `findings.length`를 display source of truth로 사용 |
| 소요 시간 0초 표시 | S2 `startedAt ≈ endedAt` 타임스탬프 버그 | `durationSec > 0` 조건 방어 → 0이면 "—" 표시 |

---

## 9. 실행 방법

> **⚠ 서버를 직접 실행하지 마라.** 서비스 기동/종료는 반드시 사용자에게 요청할 것.

```bash
# 전체 기동 (권장)
./scripts/start.sh

# 프론트만 기동 (Vite dev server만, Electron 없음)
cd services/frontend && npm install && npm run dev:renderer
# → http://localhost:5173

# 백엔드도 필요
cd services/backend && npm install && npm run dev
# → http://localhost:3000

# 테스트
cd services/frontend && npm test          # 전체 실행
cd services/frontend && npm run test:watch  # watch 모드
```

**환경변수 (.env)**:

각 서비스는 `services/<서비스명>/.env` 파일에서 환경변수를 로드한다. 개별 스크립트와 `start.sh` 모두 `.env`를 자동 로드한다. `.env`는 `.gitignore`에 의해 Git 추적 제외.

| 서비스 | .env 위치 | 주요 변수 |
|--------|----------|----------|
| frontend | `services/frontend/.env` | `VITE_BACKEND_URL` |

> 각 서비스의 `.env`는 해당 서비스 소유자가 관리한다. 프론트엔드 `.env`만 너의 담당.

**주의**: WSL2 환경.

---

## 10. shared 패키지 수정 시

```bash
cd services/shared
# 타입 수정 후
npm run build
```

수정 후 반드시:
1. `docs/api/shared-models.md` 업데이트
2. S2에 변경 내용 전달

---

## 11. UI 컨벤션

| 항목 | 규칙 |
|------|------|
| 아이콘 | lucide-react, `var(--text-secondary)` |
| severity 컬러 | `--severity-critical`, `--severity-high`, `--severity-medium`, `--severity-low` |
| 클릭 가능한 행 | `cursor: pointer`, hover 배경, `ChevronRight` |
| 테마 | 라이트/다크/시스템 3-way 전환 (`theme.ts`), CSS 변수 토큰 (`tokens.css`) |
| 빈 상태 | `EmptyState` 컴포넌트 |
| 로딩 | `Spinner` 컴포넌트, `.centered-loader` 유틸리티 |
| 프로그레스바 | `.shimmer-fill` 공유 클래스 (쉬머 효과) |
| 포커스 | `:focus-visible` 아웃라인 (`.btn`, `.list-item--clickable`, `.ftree-row` 등) |
| disabled | `.btn:disabled`, `.form-input:disabled` 등 opacity + cursor 처리 |

---

## 12. 관리하는 문서

| 문서 | 경로 | 용도 |
|------|------|------|
| AEGIS 공통 제약 | `docs/AEGIS.md` | **세션 시작 시 필독** (S2 관리, S1은 참조) |
| 프론트 기능 명세 | `docs/specs/frontend.md` | **가장 상세한 현황 + 목표 문서** |
| 공유 모델 명세 | `docs/api/shared-models.md` | S1-S2 공유 타입 계약서 |
| 이 인수인계서 | `docs/s1-handoff/README.md` | 세션 간 인수인계 |
| 외부 피드백 | `docs/외부피드백/S1_frontend_working_guide.md` | **설계 기준 원본** |

---

## 13. 다음 작업

새 방향의 핵심은 **S2가 도메인 모델을 확장해야 프론트가 움직일 수 있다**는 점이다.

### S1 독립 작업 가능

1. 통합 테스트 QA — S2 백엔드 기동 후 소스 업로드 → 타겟 탐색 → 분석 실행 → WS 진행률 → 결과 확인 E2E 검증
2. 대시보드 시각 QA — 브라우저에서 KPI, 차트, 랭킹, 반응형(768px) 확인
3. Run/Finding 상세 E2E — Run 클릭 → Finding 클릭 → 상태 변경 → 감사 로그 → PoC 생성 검증
4. 독립 라우트 전환 — `/runs/:id`, `/findings/:id` URL 라우트 추가 (현재는 대시보드 내 뷰)
5. 테스트 확장 — useStaticDashboard 훅 테스트, 추가 컴포넌트 테스트 (현재 185건, `npm test`로 실행)

### 완료된 작업 (2026-03-14)

1. ✅ CSS 폴리싱 — `!important` 13개 제거, 인라인 스타일 ~30개 → CSS 클래스 전환, transition 토큰화, 반응형 보강
2. ✅ 로깅 강화 — `logError`/`healthFetch` 헬퍼 추가, 전 컴포넌트 `console.error` → `logError` 전환 (~33건), direct `fetch` health check → `healthFetch`, silent catch 해소 (11건), WebSocket 이벤트 로깅 추가, `downloadFile` X-Request-Id 추가

### 완료된 작업 (2026-03-16)

3. ✅ 종합 리팩토링 — 버그 3건 수정 + 코드 품질 감사 ~50건 일괄 정리
   - **버그 수정**: location 파싱 통일 (`getFilename` → `getFileNameFromLocation`), 청크 라벨 개선, Finding 제목 line-clamp
   - **`as any` 전량 제거** (7건 → 0건): `window.d.ts`/`react-html.d.ts` 타입 선언, `ErrorBoundary` CSS 클래스 전환
   - **`projectId!` 전량 제거** (12건 → 0건): 4개 훅 시그니처 optional 전환, 6개 페이지 가드 추가
   - **CSS `!important` 잔여 제거** (7건 → 0건, print 1건 유지): 특이성 증가 셀렉터로 전환
   - **하드코딩 URL 상수화**: `constants/defaults.ts` 신규, `ProjectSettingsPage` 6곳 치환
   - **S2 work-request 2건 발송**: `AnalysisProgress.totalFiles` 필드 추가, Finding 제목 `slice(0,100)` 완화

### 완료된 작업 (2026-03-17)

4. ✅ 정적 분석 대시보드 2-탭 개편 (SonarQube 패턴)
   - **"최신 분석" 탭 (기본)**: Quality Gate 배너, Run 요약 StatCards(Finding/Critical+High/소요시간), 심각도 DonutChart, 취약 파일 Top 5, Finding 목록(파일별 그룹)
   - **"전체 현황" 탭**: 기존 대시보드 body 이동 (KPI 4종, 심각도/출처 분포, 트렌드, 상태 분포, 랭킹, 최근 Run)
   - `useStaticDashboard` 훅에 `latestRunDetail`/`latestRunLoading` 상태 추가, 최신 completed run 자동 fetch
   - PeriodSelector를 전체 현황 탭 전용으로 이동
   - 신규 컴포넌트: `LatestAnalysisTab`, `OverallStatusTab`
   - ActiveAnalysisBanner는 탭과 무관하게 항상 표시
5. ✅ 버그 수정 7건
   - 파일 네비게이션: 상대 경로 → 절대 경로 전환
   - `toast.info` → `toast.warning` (API에 `info` 없음)
   - 브레드크럼 한/영 불일치: `pageNames` 맵 보완
   - 보고서 페이지: API 에러 vs 빈 데이터 UI 분리 (`loadError` 상태)
   - Finding 수 불일치: `findings.length` 기준 표시 통일
   - 소요 시간 0초: 방어 로직 (`durationSec > 0` 조건)
   - 토스트: 3초 자동 닫기, 우측 하단 고정
6. ✅ QA 버그 3건 수정 (QA 결과 기반)
   - DonutChart 중앙 숫자: Info 제외 → 전체 Finding 표시 (`total`), 라벨 "취약점" → "Finding"
   - FindingDetailView 레이아웃: 설명/수정 가이드를 EvidencePanel 위로 이동 (175건 증적에 밀리는 문제)
   - ToastContext 안정화: `useCallback` + `api()` → `useMemo`로 변경 (context value 참조 안정성)
7. ✅ QA/리뷰 워크플로우 정립
   - 역할/규칙/작업 3단 구조로 전환
   - `docs/s1-qa/` 폴더는 2026-03-18 AEGIS 재편 시 폐기됨
8. ✅ 디자인 리뷰 피드백 8건 일괄 수정
   - **브레드크럼 한/영 통일**: `overview: "Overview"` → `"대시보드"` (Sidebar도 동시 수정)
   - **스테퍼 라벨 개선**: "대기/룰 엔진/LLM 분석" → "파일 추출/룰 분석/AI 분석"
   - **콘텐츠 max-width**: `.content`에 `max-width: 1400px` 추가 (넓은 화면 여백 완화)
   - **증적 배지 크기**: `.badge-sm` CSS 정의 추가 (기존 코드에서 사용했지만 정의 누락)
   - **상태 분포 강화**: `FindingSummary` 축약 칩 → 수평 스택 바 차트 (풀 한국어 라벨)
   - **증적 접기/펼치기**: `EvidencePanel` — 5건 초과 시 "나머지 N건 더 보기" 토글
   - **[Major] Finding 필터/그룹핑**: `LatestAnalysisTab`에 심각도 필터 탭 + 그룹핑 전환(심각도별/파일별/상태별) 추가. "기타" 56건 문제 해소
   - **네비게이션 가드**: `AnalysisGuardContext` 신규 — 분석 진행 중 사이드바 클릭 시 확인 다이얼로그 표시

### 완료된 작업 (2026-03-18)

9. ✅ 디자인 리뷰 2차 피드백 8건 수정
   - **StatCard 교체**: 최신 분석 탭 "소요 시간" → "미해결" (open/needs_review/needs_revalidation/sandbox 집계)
   - **도넛차트 교체**: 최신 분석 탭 심각도 분포 DonutChart → 출처별 분포 바차트 (룰/AI/룰+AI). 심각도는 필터 탭과 중복이므로 제거
   - **트렌드 가이드**: TrendChart `data.length < 2`일 때 "2회 이상 분석 필요" 가이드 메시지 표시 (1포인트 막대 제거)
   - **KPI 해결률**: 전체 현황 탭 "미해결" 카드에 `해결률 N%` detail 추가 (총 Finding = 미해결일 때 같은 숫자 반복 방지)
   - **배지 툴팁**: FindingStatusBadge, ConfidenceBadge, SourceBadge에 `title` 속성 추가 (상태/신뢰도/출처별 한 줄 설명)
   - **어댑터 neutral**: StatusBar 어댑터 미등록 → `neutral` 클래스 (회색 dot, 글로우 없음. 빨간색 경고 피로 해소)
   - **진행률 가중치**: AsyncAnalysisProgressView 균등 20% → 시간 가중치 (queued 2.5%, rule 7.5%, LLM 10-90%, merging 95%). 서버 `phaseWeights` 우선 + 하드코딩 fallback
   - **Finding 브레드크럼**: FindingDetailView에 "정적 분석 › Finding 상세" 간이 경로 텍스트 추가
10. ✅ S2 work-request 3건 발송 → S2 처리 완료
    - AI Finding location fallback 강화 (S2 수정 완료, 새 분석부터 적용)
    - 감사 로그: 정상 동작 확인 (상태 변경 전에는 빈 배열이 맞음)
    - phaseWeights 서버 제공 시작 (S1에서 서버값 우선 사용 반영 완료)
11. ✅ AEGIS 6인 체제 재편 대응
    - 프로젝트명 AEGIS 확정 (Automotive Embedded Governance & Inspection System)
    - 4인 → 6인 체제 (S5 Knowledge Base, S6 Dynamic Analysis 신설)
    - `docs/AEGIS.md` 신설 (공통 제약 사항) — S1 인수인계서 + 명세서에 참조 반영
    - `docs/s1-qa/` 폴더 폐기 (4파일 삭제)

12. ✅ `smartcar` → `AEGIS` 네이밍 전환 (S2 WR `s2-to-all-rename-smartcar-to-aegis.md` 대응)
    - `package.json`: `@smartcar/frontend` → `@aegis/frontend`, 의존성 `@aegis/shared`
    - HTML/Electron 윈도우 타이틀 → `AEGIS`
    - Sidebar 브랜드: `Smartcar` / `Security Framework` → `AEGIS` / `Security Platform`
    - SettingsPage 프레임워크명 → `AEGIS`
    - `window.d.ts`: `SmartcarApi` → `AegisApi`
    - localStorage 키: `smartcar:backendUrl` → `aegis:backendUrl`, `smartcar:theme` → `aegis:theme`
    - 소스 49개 파일 `@smartcar/shared` → `@aegis/shared` import 전량 치환
    - S1 소유 문서 2건 (`s1-handoff/README.md`, `specs/frontend.md`) 치환
    - S1 영역 `smartcar`/`Smartcar` 잔여 0건 확인

### 완료된 작업 (2026-03-19)

13. ✅ 7인 체제 전환 대응 (S2 WR `s2-to-s1-update-handoff-s7.md` 처리)
    - 인수인계서 역할표 + 아키텍처 다이어그램: S3/S7 분리 반영
14. ✅ 프론트엔드 대규모 개편 (S2 WR `s2-to-s1-frontend-overhaul.md` 대응)
    - **Phase 1 — UI 숨김**: 동적 분석/테스트/어댑터/룰 UI 사이드바+라우트에서 제거 (코드 유지), ProjectSettingsPage 588줄→117줄(LLM URL만), StatusBar 어댑터 제거, OverviewPage 어댑터 칩 제거
    - **Phase 2 — 소스코드 업로드**: `SourceUploadView` 신규 (ZIP/tar.gz 드래그 앤 드롭 + Git URL 클론), `client.ts`에 `uploadSource`/`cloneSource`/`fetchSourceFiles`/`runAnalysis` API 추가
    - **Phase 3 — WebSocket 분석 진행률**: `useAnalysisWebSocket` 훅 신규 (Quick SAST→Deep Agent 2단계), `TwoStageProgressView` 신규 (2단계 스테퍼, 중간 결과 열람, 에러 재시도), `useStaticDashboard` 필터에 `deep_analysis` 추가
    - **Phase 4 — Finding 뱃지 확장**: `agent`/`sast-tool` sourceType 라벨+설명+아이콘+CSS 추가, `SourceBadge` 5-way 맵, `canTransitionTo` agent 제한, `modules.tsx`에 `deep_analysis` 추가
    - StaticAnalysisPage: modeSelect/upload→sourceUpload, useAsyncAnalysis→useAnalysisWebSocket 교체

### 완료된 작업 (2026-03-20)

15. ✅ 코드 리뷰 + 리팩토링 (3개 리뷰 에이전트 병렬 실행)
    - **High priority 수정**: SourceUploadView stale closure 해소 (handleZipUpload useCallback화, eslint-disable 제거), useAnalysisWebSocket onclose 레이스 컨디션 수정 + 연결 에러 시 stuck 방지 + isRunning 파생 전환 + useMemo 안정 반환, StaticAnalysisPage unstable useCallback deps 수정, TwoStageProgressView 미사용 import/변수 제거
    - **useElapsedTimer 훅 추출**: 경과 시간 타이머 3곳 중복 → `hooks/useElapsedTimer.ts` 공통 훅으로 통합
    - **useStaticDashboard 버그 수정**: 마운트 시 API 이중 호출 제거, stale period 클로저 수정(periodRef), 불필요한 handleSetPeriod 래퍼 제거
    - **ProjectSettingsPage 핸들러 추출**: 인라인 async → handleTestLlm/handleSaveLlm/handleResetLlm useCallback + setTimeout 클린업
    - **OverviewPage useMemo 보강**: getLatestPerModule/getTopVulnerabilities 매 렌더 재계산 방지
    - **CSS 중복 제거**: TwoStageProgressView `.spin` → 글로벌 `.animate-spin`, SourceUploadView `.drop-zone--active` 중복 제거

### 완료된 작업 (2026-03-21)

16. ✅ 소스코드 트리 탐색 UI (S2 WR `s2-to-s1-source-tree-ux.md` 대응)
    - `utils/tree.ts`: 제네릭 트리 유틸 (buildTree, filterTree, countFiles, getTopDirs)
    - `utils/findingOverlay.ts`: 디렉토리별 Finding severity 집계
    - `components/ui/FileTreeNode.tsx`: 공유 재귀 트리 노드 (render props, A11Y)
    - `components/static/SourceTreeView.tsx`: 2패널 탐색기 (트리+코드 프리뷰+Finding 하이라이트)
    - FilesPage 리팩토링: 인라인 트리 로직 → 공유 유틸/컴포넌트로 전환
    - StaticAnalysisPage에 `"sourceTree"` 뷰 상태 추가, 대시보드에 "소스 탐색" 버튼
17. ✅ 빌드 타겟 설정 UI (S2 WR `s2-to-s1-build-target-ui.md` 대응)
    - `constants/sdkProfiles.ts`: 12+1 SDK 프로파일 상수 (AUTOSAR, NXP, Renesas, TI 등)
    - `hooks/useBuildTargets.ts`: 타겟 CRUD + S4 자동 탐색 훅
    - `components/static/BuildProfileForm.tsx`: SDK 선택 + 빌드 프로파일 편집 (상세 설정 토글)
    - `components/static/BuildTargetSection.tsx`: ProjectSettingsPage 타겟 관리 카드
    - `components/static/TargetSelectDialog.tsx`: 분석 전 타겟 선택 다이얼로그 (전체/개별)
    - `useAnalysisWebSocket`: targetName/targetProgress 상태 추가, startAnalysis(pid, targetIds?) 확장
    - `TwoStageProgressView`: 타겟별 진행률 표시 (`[gateway] 분석 중 — 1/3 타겟`)
    - SourceUploadView에 "타겟 탐색" 버튼 추가
    - `runAnalysis(projectId, targetIds?)` API 시그니처 확장 (하위 호환)
18. ✅ Finding 상세 분석 + PoC 생성 UI (S2 WR `s2-to-s1-claim-detail-poc.md` 대응)
    - `utils/markdown.tsx`: 간단한 마크다운→React 렌더러 (코드블록, 헤딩, 리스트, 볼드/이탤릭)
    - FindingDetailView: `detail` 마크다운 렌더링 ("상세 분석" 섹션), PoC 생성 버튼 (agent Finding만)
    - `generatePoc(projectId, findingId)` API 추가, PoC 결과 마크다운 표시 + audit 정보
19. ✅ 전체 코드 리뷰 + 리팩토링 (9개 리뷰 에이전트 병렬)
    - **HIGH 버그 수정 4건**: useAnalysisWebSocket error 시 target 초기화, tree.ts 빈 경로 세그먼트 필터, BuildTargetSection 유효성 검사 순서, findingOverlay severity 타입 가드
    - **코드 품질 7건**: handleGitClone useCallback, markdown \r\n 처리, setTimeout cleanup (FindingDetailView+VulnerabilityDetailView), 미사용 import 제거, filter().map() 패턴, CSS focus-visible 추가, A11Y 속성 (role/aria-expanded/aria-checked/onKeyDown)
    - filterTree 폴더명 매칭 버그 발견 및 수정 (테스트 과정에서 발견)
20. ✅ 테스트 인프라 구축 + 185 테스트 케이스 작성
    - vitest 4.1.0 + @testing-library/react + jsdom 설치
    - `npm test` / `npm run test:watch` / `npm run test:ui` 스크립트 추가
    - **유틸 유닛 89건**: tree, location, findingOverlay, format, fileMatch, markdown, severity, analysis
    - **상수 유닛 26건**: finding (상태 전이 canTransitionTo), languages, modules, sdkProfiles
    - **API 통합 11건**: fetch 모킹 + CRUD/runAnalysis/PoC/source API
    - **훅 테스트 14건**: useElapsedTimer (fake timer), useBuildTargets (API 모킹 CRUD+discover)
    - **컴포넌트 테스트 39건**: TargetSelectDialog, BuildProfileForm, FileTreeNode, ConfirmDialog
    - **컨텍스트 테스트 6건**: ToastContext (auto-dismiss, max 5, action button)

### 완료된 작업 (2026-03-23)

21. ✅ Summary API 전환 (`/api/static-analysis/summary` → `/api/analysis/summary`)
22. ✅ v1.0.0 풀스택 통합 UI — AgentResultPanel (confidence 게이지, caveats, 수정 권고, 정책 플래그, SCA 라이브러리, Agent audit)
23. ✅ Observability v2 대응 — 인수인계서에 Observability 참조 추가, X-Request-Id 이미 구현 확인
24. ✅ OverviewPage useMemo 조건부 return 위 이동 (hooks 순서 에러 수정)
25. ✅ ReportPage에 `deep` 모듈 탭 추가 (S2 ProjectReport.modules 확장 대응)

### 완료된 작업 (2026-03-24)

26. ✅ 업로드 엔드포인트 통합 — 파일 유형 분기 로직 제거, `uploadSource` 단일 엔드포인트
27. ✅ LLM 직접 통신 제거 — StatusBar/OverviewPage/ProjectSettingsPage에서 상태 칩 제거, 백엔드 연결 끊김 시 토스트 방식
28. ✅ 업로드 비동기 + WS 프로그레스 — `useUploadProgress` 훅 (received→extracting→indexing→complete), 202 Accepted 방식
29. ✅ 파일 확장자 필터 완전 제거 — S2 서버 측 500MB 제한으로 충분
30. ✅ 파일 유형 메타데이터 (fileType 12종, previewable) — 파일별 아이콘 분기 (FileCode/Terminal/Wrench/Settings/BookOpen/Binary/Archive 등)
31. ✅ 코드 하이라이팅 — highlight.js 14개 언어 (C/C++/Shell/CMake/Python/JSON/YAML 등), 라이트/다크 테마, 5곳 적용 (FileDetail/VulnDetail/SourceTree/markdown/fixCode)
32. ✅ 마크다운 렌더러 → react-markdown + remark-gfm 교체 (GFM 테이블/링크/인용 완전 지원)
33. ✅ 파일 디테일 헤더 고도화 — 언어별 아이콘, 경로 표시, pill 뱃지 (언어/크기/줄 수/취약점), Maximize 전체 화면
34. ✅ 마크다운 프리뷰 탭 — .md 파일에서 코드/프리뷰 탭 전환
35. ✅ 파일 구성 서버 composition — S2가 GitHub Linguist 스타일 집계 제공, 프론트 LANG_GROUPS 조합 불필요
36. ✅ 코드 뷰어 CSS 개선 — 라이트 모드 밝은 배경, 주석 가독성 향상, 25줄 max-height
37. ✅ 토스트 5초 지속, 불투명 배경 + backdrop-filter
38. ✅ 서브 프로젝트 파이프라인 UI — `usePipelineProgress` WS 훅, `TargetStatusBadge` (12상태), `TargetProgressStepper` (5단계 스테퍼), BuildTargetSection 파이프라인 제어 패널
39. ✅ 서브 프로젝트 생성 — `SubprojectCreateDialog` 체크박스 파일 트리, `includedPaths` 지원 (공유 라이브러리 포함 가능)
40. ✅ 언어 분류 대폭 확장 — Shell/Build/Config/Docs/Assembly/Linker + inferLanguage 자동 추론
41. ✅ 폴더 접힘 상태 sessionStorage 유지
42. ✅ pipeline/upload/source API 다수 추가
43. ✅ 테스트 195건 (유닛 89 + 상수 26 + API 11 + 훅 14 + 컴포넌트 39 + 컨텍스트 6 + UI 7 + CVE 3)

### 완료된 작업 (2026-03-25)

44. ✅ 외부 리뷰 피드백 수신 및 검토 (`docs/외부피드백/26.03.25/AEGIS_S1_frontend_QA_review.md`)
45. ✅ API Client 도메인 분할 — 875줄 단일 `client.ts` → 8개 도메인 모듈 (`core`, `projects`, `source`, `analysis`, `rules`, `pipeline`, `report`, `dynamic`) + barrel re-export. 소비자 코드 변경 0건
46. ✅ 라우트 트리 1:1 정렬 — 숨김 페이지 2개(`dynamic-analysis`, `dynamic-test`)를 ComingSoonPlaceholder로 라우트+사이드바 등록. "준비 중" 태그 표시
47. ✅ QA 테스트 대폭 확장 — 195 → 248건 (+53). WS 훅 3개(useAnalysisWebSocket/usePipelineProgress/useUploadProgress), 상태 훅 3개(useStaticDashboard/useAsyncAnalysis/useStaticAnalysis), 컴포넌트 4개(AgentResultPanel/BuildTargetSection/SubprojectCreateDialog/SourceTreeView). MockWebSocket 패턴 확립
48. ✅ StatusBar 헬스체크 3단계 고도화 — ok(녹색)/degraded(주황+미연결 서비스 표시)/unhealthy(빨강). 폴링 15초→30초. 상태 전환 시만 toast. 버전 v0.2.0

49. ✅ 코드 품질 감사 + 리팩토링 — 3개 병렬 리뷰 에이전트로 전체 코드 94건 이슈 도출, 핵심 수정 실행
    - **CSS 변수 체계화**: 하드코딩 컬러 7건 → CSS 변수 (`var(--success)`, `var(--text-inverse)` 등), z-index 스케일 도입 (`--z-sticky`~`--z-toast`), glow shadow 토큰화
    - **A11Y 강화**: ConfirmDialog focus trap + `role="dialog"` + `aria-modal`, SubprojectCreateDialog checkbox `role`/`tabIndex`/`onKeyDown`, StatusBar `role="status"` + `aria-live="polite"`, Toast `role="alert"` + close `aria-label`, Sidebar "준비 중" `aria-label`
    - **Hook dependency 수정**: useStaticDashboard eslint-disable 제거 (정상 dependency 추가), FindingDetailView eslint-disable 제거 (`loadDetail` dependency), 나머지 4건 의도적 disable에 설명 주석
    - **ToastContext 메모리 누수 수정**: setTimeout ID 추적 + dismiss 시 clearTimeout
    - **폴링 매직 넘버 상수화**: `POLL_HEALTH_MS`, `POLL_ACTIVE_ANALYSIS_MS` → `constants/defaults.ts`
50. ✅ 테스트 대폭 확장 — 248 → 325건 (+77). api/core 24건, utils/theme 4건, utils/highlight 12건, contexts/AnalysisGuard 4건, constants 10건, ErrorBoundary 3건, StatusBar 4건, ComingSoonPlaceholder 2건, EmptyState 6건, Spinner 3건, SeverityBadge 5건
51. ✅ S2 WR 처리 (`s2-to-s1-transient-removal.md`)
    - **레거시 `/api/static-analysis/*` 제거**: 함수 8개 삭제 (`runStaticAnalysis`, `fetchAnalysisResults`, `fetchAnalysisResult`, `deleteAnalysisResult`, `runStaticAnalysisAsync`, `fetchAnalysisProgress`, `abortAnalysis`, `uploadFiles`). `fetchAllAnalysisStatuses`는 `/api/analysis/status`로 경로 전환
    - **룰 CRUD 완전 제거**: `api/rules.ts` 삭제, `client.ts` re-export 제거. 룰 UI는 이미 숨김 상태
    - **레거시 훅 삭제**: `useStaticAnalysis.ts`, `useAsyncAnalysis.ts` + 테스트 파일 삭제 (인수인계서에 레거시 표기됨)
    - **StaticAnalysisPage**: `?analysisId=` 레거시 URL 핸들링 제거, `legacyResult` 뷰 상태 제거
    - **AnalysisHistoryPage**: `fetchAnalysisResults`/`deleteAnalysisResult` → `fetchProjectRuns` 전환
    - **TargetStatusBadge**: `resolving`/`resolve_failed` 2개 상태 추가 + 하드코딩 컬러 4건 → `var(--success)`
    - **StatusBar**: `buildAgent` 헬스체크 필드 추가
    - **테스트 317건 전부 통과**
52. ✅ S2 WR 처리 (`s2-to-s1-ws-envelope.md`) — WS envelope meta seq gap 감지 구현
    - `utils/wsEnvelope.ts`: `createSeqTracker` (채널별 seq 추적, gap 경고), `parseWsMessage` (envelope 파싱)
    - 3개 WS 훅(`useAnalysisWebSocket`, `usePipelineProgress`, `useUploadProgress`) 모두 `seqTracker.check(meta)` 적용
    - `wsEnvelope.test.ts`: 8건 테스트 추가
    - **테스트 325건 전부 통과**
53. ✅ S2 WR 처리 (`s2-to-s1-included-paths-ui.md`) — `SubprojectCreateDialog` 이미 구현 완료 확인. 체크박스 트리+indeterminate+includedPaths 전달+A11Y. WR 삭제
54. ✅ S2 WR 처리 (`s2-to-s1-pipeline-ui-enhancements.md`)
    - **BuildTargetSection**: `buildCommand` 코드 블록 표시, `resolving`/`resolve_failed` RUNNING/FAILED 셋 추가
    - **LatestAnalysisTab**: Finding 카드에 `fingerprint` 이력 뱃지 (History 아이콘, "이전 분석에서도 발견된 취약점" 툴팁)
    - **FindingDetailView**: 뱃지 줄에 fingerprint "재발견" 표시
    - `.fingerprint-badge` CSS 추가 (agent 컬러 계열)
    - **테스트 325건 전부 통과**
55. ✅ S2 WR 처리 (`s2-to-all-third-party-filter-design.md`, `s2-to-all-shared-models-update.md`)
    - **`api/pipeline.ts`**: `TargetLibrary` 타입 + `fetchTargetLibraries`/`updateTargetLibraries` API 함수 추가
    - **`TargetLibraryPanel` 신규**: 체크박스 리스트 (이름/버전/경로/수정파일수), 포함/제외 토글, PATCH 저장, dirty 감지+취소
    - **`BuildTargetSection`**: built 이후 상태에서 `TargetLibraryPanel` 자동 표시
    - `TargetLibraryPanel.test.tsx`: 9건 테스트 추가
    - **테스트 334건 전부 통과**
56. ✅ Quality Gate + Approval Queue UI 신규 구현
    - **API**: `api/gate.ts` (`GateResult`, `GateRuleResult`, `fetchProjectGates`, `fetchGateDetail`, `overrideGate`), `api/approval.ts` (`ApprovalRequest`, `fetchProjectApprovals`, `decideApproval`)
    - **QualityGatePage**: Gate 목록 (pass/fail/warning 상태), 규칙별 결과 (4가지 규칙), 오버라이드 폼, 관련 Finding 카운트
    - **ApprovalsPage**: Approval Queue (상태 필터, 대기 뱃지), 승인/거부 다이얼로그, 결정 이력+코멘트 표시, 만료 표시
    - **라우트 등록**: `/quality-gate`, `/approvals` + 사이드바 메뉴 추가
    - 테스트 14건 추가 → **테스트 348건 전부 통과**

### 완료된 작업 (2026-03-26)

57. ✅ S2 WR 처리 (`s2-to-s1-sdk-management-ui.md`) — SDK 관리 UI 전체 구현
    - **`api/sdk.ts`**: `SdkProfile`, `RegisteredSdk`, `SdkAnalyzedProfile`, `SdkRegistryStatus` 타입 + `fetchProjectSdks`, `fetchSdkDetail`, `registerSdkByPath`, `registerSdkByUpload`, `deleteSdk`, `getSdkWsUrl` API 함수
    - **`SdkManagementPage`**: 내장 SDK 그리드 + 등록 SDK 리스트, 상태 뱃지 (6상태), 5단계 스텝 인디케이터, 분석된 프로파일 토글 상세, 등록 폼 (로컬 경로/파일 업로드 2모드), 삭제 ConfirmDialog
    - **WS 실시간**: `/ws/sdk` 연결 — `sdk-progress`/`sdk-complete`/`sdk-error` 수신, `createSeqTracker` 적용
    - **라우트**: `/sdk` 등록, 사이드바 메뉴 추가, 브레드크럼 등록
    - `SdkManagementPage.test.tsx`: 9건 테스트 추가 → **테스트 357건 전부 통과**

### S1 독립 작업 가능

1. 통합 테스트 QA — 소스 업로드 → 서브 프로젝트 생성 → 빌드 파이프라인 → 분석 → 결과 E2E
2. 대시보드 시각 QA — 반응형 확인
3. 파일 탐색기 서브 프로젝트 편집 UI — includedPaths 수정 다이얼로그
4. 외부 리뷰 후속 — view-model 계층 도입 검토 (현재 보류), 환경 설정 주입 명시화

### S2 추가 모델 확장 후 S1이 할 것

1. Quality Gate 독립 화면
2. Approval Queue
3. 파일 탐색기에 서브 프로젝트 소속 표시 (S2 `buildTarget?` 필드 추가 후)

---

## 14. 참고할 문서들

| 문서 | 경로 | 왜 봐야 하는지 |
|------|------|--------------|
| **AEGIS 공통 제약** | `docs/AEGIS.md` | **세션 시작 시 필독.** 역할, 소유권, 소통 규칙 |
| 프론트 기능 명세 | `docs/specs/frontend.md` | 화면 명세, Finding 상태 머신, Evidence 뷰어 설계 |
| 외부 피드백 원본 | `docs/외부피드백/S1_frontend_working_guide.md` | 설계 원칙의 근거 |
| 전체 기술 개요 | `docs/specs/technical-overview.md` | 프로젝트 전체 구조 |
| 백엔드 명세 | `docs/specs/backend.md` | API 현황 |
| 공유 모델 | `docs/api/shared-models.md` | DTO/Model 구조 |
