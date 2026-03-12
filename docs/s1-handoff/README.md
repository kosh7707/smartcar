# S1. Frontend 개발자 인수인계서

> 이 문서는 S1(Frontend) 개발을 이어받는 다음 세션을 위한 인수인계서다.
> 이것만 읽으면 현재 상태를 파악하고 바로 작업을 이어갈 수 있어야 한다.

---

## 1. 프로젝트 전체 그림

### 과제

"가상환경 기반 자동차 전장부품 사이버보안 수준 검증 기술 및 플랫폼 개발" — 부산대학교가 컨소시엄 참여기관으로, 생성형 AI 기반 지능형 사이버보안 공격/검증 프레임워크를 개발한다.

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

### 방향 전환

이 프로젝트는 더이상 연차보고서/데모 시연 기준으로 개발하지 않는다.
**외부 피드백(`docs/외부피드백/S1_frontend_working_guide.md`)을 기준으로 "진짜 보안 분석 운영 콘솔"을 만든다.**

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
| 스타일 | CSS (라이트 테마, 사이드바만 다크, CSS 변수 토큰 시스템) |
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
│       │   └── client.ts             모든 백엔드 API 함수
│       ├── contexts/
│       │   ├── ProjectContext.tsx     프로젝트 목록 공유 상태
│       │   └── ToastContext.tsx       전역 toast 알림 (에러/경고/성공, 액션 버튼)
│       ├── hooks/
│       │   ├── useStaticAnalysis.ts   정적 분석 흐름
│       │   ├── useDynamicTest.ts      동적 테스트 흐름 (WebSocket)
│       │   └── useAdapters.ts         어댑터 상태 (5초 폴링, ecuMeta 포함)
│       ├── layouts/
│       │   └── ProjectLayout.tsx      breadcrumb + Outlet
│       ├── components/
│       │   ├── Sidebar.tsx            2-tier 사이드바
│       │   ├── StatusBar.tsx          하단 상태바
│       │   ├── ErrorBoundary.tsx      렌더링 크래시 방어 (class component)
│       │   ├── ui/                    공통 UI 컴포넌트
│       │   ├── static/               정적 분석 하위 컴포넌트
│       │   └── dynamic/              동적 분석 하위 컴포넌트
│       ├── pages/                     각 페이지 컴포넌트 + CSS
│       ├── styles/                    토큰, 리셋, 전역, 컴포넌트 CSS
│       └── utils/                     포맷팅, 심각도, 파일 유틸
```

---

## 5. 라우팅 구조

### 현재 동작 중

```
/                                → redirect /projects
/projects                        → ProjectsPage
/projects/:projectId             → ProjectLayout
  /overview                      → OverviewPage
  /static-analysis               → StaticAnalysisPage
  /dynamic-analysis              → DynamicAnalysisPage
  /dynamic-test                  → DynamicTestPage
  /files                         → FilesPage
  /files/:fileId                 → FileDetailPage
  /vulnerabilities               → VulnerabilitiesPage
  /analysis-history              → AnalysisHistoryPage
  /settings                      → ProjectSettingsPage
/settings                        → SettingsPage
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
  /report                        → 보고서
```

---

## 6. 구현 현황

### 완료 (동작 중)

| 기능 | 컴포넌트 | 비고 |
|------|---------|------|
| 프로젝트 CRUD | ProjectsPage + ProjectContext | 생성/조회/삭제 |
| Overview 대시보드 | OverviewPage | 도넛, StatCard(모듈별 분포+언어별), 파일/취약점/이력 |
| 정적 분석 전체 흐름 | StaticAnalysisPage + AnalysisResultsView | 업로드→진행→결과(파일별 그룹)→상세→이력 |
| 동적 분석 | DynamicAnalysisPage + MonitoringView | 세션 관리, CAN 모니터링, 일시정지/재개, 알림 패킷 분리 표시 |
| 동적 테스트 | DynamicTestPage + useDynamicTest | 전략 선택, WebSocket 진행률, 결과, ecuMeta 자동 채움 |
| 파일 탐색기/상세 | FilesPage + FileDetailPage | 트리 뷰, 코드, 취약점 하이라이팅 |
| 취약점 통합 뷰 | VulnerabilitiesPage | 분석 세션별 그룹, 심각도/날짜 필터, 모듈별 컬러 구분 |
| 분석 이력 | AnalysisHistoryPage | 전 모듈 타임라인 |
| 설정 | SettingsPage + ProjectSettingsPage | 글로벌/프로젝트 |
| 에러 핸들링 | ErrorBoundary, ToastContext, apiFetch 에러 분류 | X-Request-Id, errorDetail 대응, retryable 재시도 버튼 |
| 공통 UI | Sidebar, StatusBar, 10+ ui 컴포넌트 | — |

### 미구현 (새 방향 — S2 shared 모델 확장 대기)

| 기능 | 선행 조건 |
|------|----------|
| TargetAsset / VersionSnapshot 계층 | shared 모델 (S2) |
| Run 목록/상세 | shared 모델 (S2) |
| Finding 상태 머신 + triage | Finding 엔티티 (S2) |
| Evidence registry-based viewer | Evidence 엔티티 + API (S2) |
| Quality Gate 화면 | Gate 엔티티 + API (S2) |
| Approval Queue | Approval 엔티티 + API (S2) |
| 동적 분석 운영 콘솔 고도화 | drop/backpressure/gap 감지 (S2 WS 확장) |
| LLM provenance panel | LLM metadata 확장 (S2/S3) |
| 보고서 화면 | report API 연동 |
| 테스트 | — |

---

## 7. 핵심 설계 결정

### 에러 핸들링 아키텍처

4계층 구조로 설계됨:

1. **앱 안정성**: `ErrorBoundary` (렌더링 크래시 → fallback UI, Sidebar/StatusBar 유지), `unhandledrejection` 전역 핸들러 (`main.tsx`)
2. **사용자 알림**: `ToastContext` — 전역 toast (에러/경고/성공), 5초 자동 닫기, 최대 5개 스택, 액션 버튼 지원
3. **API 에러 분류**: `apiFetch`에서 네트워크 에러 / HTTP 상태코드 / JSON 파싱 실패 분류, `ApiError` 커스텀 에러 클래스 (`code`, `retryable`, `requestId`)
4. **MSA 연동**: 모든 요청에 `X-Request-Id` 자동 부착, S2 `errorDetail` (구조화 에러 코드) 파싱, `retryable` 에러 시 toast에 "다시 시도" 버튼 표시

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
| 테마 | 라이트 기본 (사이드바만 다크), CSS 변수 토큰 (`tokens.css`) |
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

### S2 모델 확장 전에 S1이 할 수 있는 것

1. 보고서 화면 (report API 이미 존재)
2. 동적 분석 운영 콘솔 고도화 (drop/backpressure/gap 감지 — S2 WS 확장 필요)
3. UI 컴포넌트 선행 개발 (FindingStatusBadge, ValidationStatusBadge, SourceBadge, StateTransitionDialog 등)
4. Evidence 뷰어 골격 (registry-based 구조, type renderer 인터페이스)
5. 테스트 인프라 구축
6. 취약점 목록 그룹 헤더 CSS 틴트 배경 미반영 이슈 조사 (값은 적용되어 있으나 렌더링 확인 필요)

### S2 모델 확장 후 S1이 할 것

1. TargetAsset / VersionSnapshot 계층 화면
2. Run 목록/상세
3. Finding 목록 (triage) + 상세 (evidence panel)
4. Quality Gate 화면
5. Approval Queue
6. 감사 추적 뷰

---

## 14. 참고할 문서들

| 문서 | 경로 | 왜 봐야 하는지 |
|------|------|--------------|
| 프론트 기능 명세 | `docs/specs/frontend.md` | 화면 명세, Finding 상태 머신, Evidence 뷰어 설계 |
| 외부 피드백 원본 | `docs/외부피드백/S1_frontend_working_guide.md` | 설계 원칙의 근거 |
| 전체 기술 개요 | `docs/specs/technical-overview.md` | 프로젝트 전체 구조 |
| 백엔드 명세 | `docs/specs/backend.md` | API 현황 |
| 공유 모델 | `docs/api/shared-models.md` | DTO/Model 구조 |
