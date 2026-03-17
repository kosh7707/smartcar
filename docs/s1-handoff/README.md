# S1. Frontend 개발자 인수인계서

> 이 문서는 S1(Frontend) 개발을 이어받는 다음 세션을 위한 인수인계서다.
> 이것만 읽으면 현재 상태를 파악하고 바로 작업을 이어갈 수 있어야 한다.

---

## 1. 프로젝트 전체 그림

### 4-서비스 MSA 구조

```
[Electron + React + TS]  <-->  [Express.js + TS]  <-->  [Python FastAPI]  <-->  [LLM (Qwen 14B)]
     Frontend (S1)              Backend (S2)             LLM Gateway (S3)        LLM Engine (S4)
     :5173 (dev)                :3000                    :8000                    DGX Spark
```

통신 방향: `S1 → S2 → S3 → S4` (프론트는 S2하고만 통신)

### 2계층 보안 검증 구조

- **1계층**: S2의 룰 엔진이 패턴 매칭으로 빠른 탐지 (정규식 기반)
- **2계층**: S3가 1계층 결과 + 원본 데이터를 받아 LLM 심층 분석
- 프론트에서는 탐지 출처로 구분 (`rule` vs `llm`)

---

## 2. 너의 역할과 경계

### 너는

- S1 Frontend 개발자
- `services/frontend/` 하위 코드를 소유
- `services/shared/` (`@smartcar/shared`) — **S2 단독 소유**. S1은 참조만, 변경 필요 시 work-request로 요청
- `docs/specs/frontend.md` 직접 관리
- `docs/api/shared-models.md` — S2 관리. S1은 참조

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

- S2(백엔드), S3(LLM Gateway) 코드는 기본적으로 수정하지 않음
- 사용자가 풀스택 역할을 지정한 경우에만 직접 수정 가능

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
| 공유 타입 | @smartcar/shared (monorepo) |

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
│       │   └── client.ts             모든 백엔드 API 함수 + logError, healthFetch 헬퍼
│       ├── contexts/
│       │   ├── ProjectContext.tsx     프로젝트 목록 공유 상태
│       │   └── ToastContext.tsx       전역 toast 알림 (에러/경고/성공, 액션 버튼)
│       ├── hooks/
│       │   ├── useStaticAnalysis.ts   정적 분석 흐름 (레거시 동기)
│       │   ├── useStaticDashboard.ts  대시보드 데이터 + 최신 Run 상세 + 활성 분석 폴링
│       │   ├── useAsyncAnalysis.ts    비동기 분석 실행 + 진행률 폴링
│       │   ├── useDynamicTest.ts      동적 테스트 흐름 (WebSocket)
│       │   └── useAdapters.ts         어댑터 상태 (5초 폴링, ecuMeta 포함)
│       ├── layouts/
│       │   └── ProjectLayout.tsx      breadcrumb + Outlet
│       ├── components/
│       │   ├── Sidebar.tsx            2-tier 사이드바
│       │   ├── StatusBar.tsx          하단 상태바
│       │   ├── ErrorBoundary.tsx      렌더링 크래시 방어 (class component)
│       │   ├── ui/                    공통 UI (배지, 다이얼로그, 카드, PeriodSelector, TrendChart, GateResultCard 등)
│       │   ├── static/               정적 분석 (2-탭 Dashboard, LatestAnalysisTab/OverallStatusTab, Run/Finding 상세, 비동기 진행, 랭킹)
│       │   ├── dynamic/              동적 분석 하위 컴포넌트
│       │   └── finding/              Finding/Evidence 컴포넌트 (EvidencePanel, EvidenceViewer)
│       ├── constants/                  공유 상수 (모듈, 언어, 동적, Finding, Evidence, defaults)
│       ├── types/                     타입 선언 (window.d.ts, react-html.d.ts)
│       ├── pages/                     각 페이지 컴포넌트 + CSS
│       ├── styles/                    토큰, 리셋, 전역, 컴포넌트 CSS
│       └── utils/                     포맷팅, 심각도, 파일 유틸, location 파싱
```

---

## 5. 라우팅 구조

### 현재 동작 중

```
/                                → redirect /projects
/projects                        → ProjectsPage
/projects/:projectId             → ProjectLayout
  /overview                      → OverviewPage
  /static-analysis               → StaticAnalysisPage (2-탭 dashboard[최신분석/전체현황]|modeSelect|upload|progress|runDetail|findingDetail|legacyResult)
  /dynamic-analysis              → DynamicAnalysisPage
  /dynamic-test                  → DynamicTestPage
  /files                         → FilesPage
  /files/:fileId                 → FileDetailPage
  /vulnerabilities               → VulnerabilitiesPage
  /analysis-history              → AnalysisHistoryPage
  /report                        → ReportPage (모듈 탭, 필터, Finding 테이블, 감사 추적, PDF 내보내기)
  /settings                      → ProjectSettingsPage
/settings                        → SettingsPage (글로벌: 백엔드 URL, 테마 3-way)
```

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
| 정적 분석 대시보드 | StaticAnalysisPage + StaticDashboard | SonarQube 패턴 2-탭 (최신 분석 / 전체 현황), Gate 배너, Finding 파일별 그룹, KPI, 차트, 랭킹, 활성 분석 배너 |
| 비동기 분석 흐름 | AsyncAnalysisProgressView + useAsyncAnalysis | 5단계 스테퍼, 2.5초 폴링, 중단, 비동기 API |
| Run 상세 | RunDetailView | Run 메타 + GateResultCard + Finding 파일별 그룹 |
| Finding 상세 | FindingDetailView | Evidence-first 레이아웃, 상태 변경, 감사 로그 |
| 정적 분석 레거시 | AnalysisResultsView + VulnerabilityDetailView | ?analysisId= URL 호환 유지 |
| 동적 분석 | DynamicAnalysisPage + MonitoringView | 세션 관리, CAN 모니터링, 일시정지/재개, 알림 패킷 분리 표시 |
| 동적 테스트 | DynamicTestPage + useDynamicTest | 전략 선택, WebSocket 진행률, 결과, ecuMeta 자동 채움 |
| 파일 탐색기/상세 | FilesPage + FileDetailPage | 트리 뷰, 코드, 취약점 하이라이팅 |
| 취약점 통합 뷰 | VulnerabilitiesPage | 분석 세션별 그룹, 심각도/날짜 필터, 모듈별 컬러 구분 |
| 분석 이력 | AnalysisHistoryPage | 전 모듈 타임라인 |
| 보고서 | ReportPage | 프로젝트 보고서 (모듈 탭, 필터, Finding 테이블, Run/Gate, 승인, 감사 추적, PDF 내보내기) |
| 설정 | SettingsPage + ProjectSettingsPage | 글로벌/프로젝트 |
| 에러 핸들링 | ErrorBoundary, ToastContext, apiFetch 에러 분류 | X-Request-Id, errorDetail 대응, retryable 재시도 버튼 |
| 공통 UI | Sidebar, StatusBar, 10+ ui 컴포넌트 | — |
| Finding UI 컴포넌트 | FindingStatusBadge, ConfidenceBadge, SourceBadge, FindingSummary, StateTransitionDialog | FindingDetailView에 연결 완료 |
| Evidence 뷰어 | EvidencePanel, EvidenceItemRow, EvidenceViewer | FindingDetailView에서 연동 완료 |
| 대시보드 UI | PeriodSelector, TrendChart, GateResultCard, LatestAnalysisTab, OverallStatusTab | 공통 컴포넌트 + 2-탭 구조 |

### 미구현 (S2 API/모델 확장 대기)

| 기능 | 선행 조건 |
|------|----------|
| TargetAsset / VersionSnapshot 계층 | shared 모델 (S2) |
| 독립 Run/Finding 목록 페이지 (/runs, /findings 라우트) | 대시보드 내 뷰로 존재. 독립 라우트 전환은 선택 사항 |
| Quality Gate 화면 | Gate 엔티티 + API (S2) |
| Approval Queue | Approval 엔티티 + API (S2) |
| 동적 분석 운영 콘솔 고도화 | drop/backpressure/gap 감지 (S2 WS 확장) |
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
- 모든 타입은 `@smartcar/shared`에서 import

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

---

## 9. 실행 방법

> **⚠ 서버를 직접 실행하지 마라.** 서비스 기동/종료는 반드시 사용자에게 요청할 것.

```bash
# 전체 기동 (권장)
./scripts/start.sh

# 프론트만 기동
cd services/frontend && npm install && npm run dev
# → http://localhost:5173

# 백엔드도 필요
cd services/backend && npm install && npm run dev
# → http://localhost:3000
```

**환경변수 (.env)**:

각 서비스는 `services/<서비스명>/.env` 파일에서 환경변수를 로드한다. 개별 스크립트와 `start.sh` 모두 `.env`를 자동 로드한다. `.env`는 `.gitignore`에 의해 Git 추적 제외.

| 서비스 | .env 위치 | 주요 변수 |
|--------|----------|----------|
| frontend | `services/frontend/.env` | `VITE_BACKEND_URL` |

> 나머지 서비스의 `.env`는 S2가 관리한다. 프론트엔드 `.env`만 너의 담당.

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
| 프론트 기능 명세 | `docs/specs/frontend.md` | **가장 상세한 현황 + 목표 문서** |
| 공유 모델 명세 | `docs/api/shared-models.md` | S1-S2 공유 타입 계약서 |
| 이 인수인계서 | `docs/s1-handoff/README.md` | 세션 간 인수인계 |
| 외부 피드백 | `docs/외부피드백/S1_frontend_working_guide.md` | **설계 기준 원본** |

---

## 13. 다음 작업

새 방향의 핵심은 **S2가 도메인 모델을 확장해야 프론트가 움직일 수 있다**는 점이다.

### S1 독립 작업 가능

1. 대시보드 시각 QA — 브라우저에서 KPI, 차트, 랭킹, 반응형(768px) 확인 필요
2. 비동기 분석 E2E — 새 분석 → 진행 뷰 → 완료 → 대시보드 갱신 플로우 검증
3. Run/Finding 상세 E2E — Run 클릭 → Finding 클릭 → 상태 변경 → 감사 로그 검증
4. 동적 분석 운영 콘솔 고도화 (drop/backpressure/gap 감지 — S2 WS 확장 필요)
5. 독립 라우트 전환 — `/runs/:id`, `/findings/:id` URL 라우트 추가 (현재는 대시보드 내 뷰)

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

### S2 추가 모델 확장 후 S1이 할 것

1. TargetAsset / VersionSnapshot 계층 화면
2. Quality Gate 독립 화면
3. Approval Queue
4. LLM provenance panel

---

## 14. 참고할 문서들

| 문서 | 경로 | 왜 봐야 하는지 |
|------|------|--------------|
| 프론트 기능 명세 | `docs/specs/frontend.md` | 화면 명세, Finding 상태 머신, Evidence 뷰어 설계 |
| 외부 피드백 원본 | `docs/외부피드백/S1_frontend_working_guide.md` | 설계 원칙의 근거 |
| 전체 기술 개요 | `docs/specs/technical-overview.md` | 프로젝트 전체 구조 |
| 백엔드 명세 | `docs/specs/backend.md` | API 현황 |
| 공유 모델 | `docs/api/shared-models.md` | DTO/Model 구조 |
