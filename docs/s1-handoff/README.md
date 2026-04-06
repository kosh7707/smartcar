# S1. Frontend 개발 인수인계서

> **반드시 `docs/AEGIS.md`를 먼저 읽을 것.** 프로젝트 공통 제약 사항, 역할 정의, 소유권이 그 문서에 있다.
> 이 문서는 **S1(Frontend 개발)** 세션을 이어받는 다음 세션을 위한 진입점이다.
> **S1-QA는 별도 lane**이며, 진입점은 [qa-guide.md](qa-guide.md)이다.
> 상세 정보는 같은 디렉토리의 분할 문서를 참조한다.
> **마지막 업데이트: 2026-04-04**

---

## 문서 구조

| 문서 | 내용 |
|------|------|
| **이 파일 (README.md)** | 역할, 경계, 현재 상태, 기술 스택, 라우팅, 구현 현황 |
| [architecture.md](architecture.md) | 파일 구조, 설계 결정, 에러 핸들링, 버그 이력, UI 컨벤션, 실행 방법 |
| [roadmap.md](roadmap.md) | 다음 작업, 후순위, S2 대기 항목 |
| [qa-guide.md](qa-guide.md) | **S1-QA 전용** 가이드 (Codex Playwright skill/MCP/CLI, 체크리스트, 이슈 보고) |
| session-{1~15}.md | 세션별 작업 로그 (session-1.md ~ session-15.md) |

---

## 1. 프로젝트 전체 그림

### AEGIS — Automotive Embedded Governance & Inspection System

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

통신 방향: `S1 → S2` (프론트는 S2하고만 통신). S2가 S3~S7을 내부적으로 호출.

---

## 2. 너의 역할과 경계

- S1 프론트엔드 **개발** lane
- `services/frontend/` 하위 코드를 소유
- `services/shared/` (`@aegis/shared`) — **S2 단독 소유**. S1은 참조만
- **다른 서비스의 코드를 절대 읽지 않는다** — API 계약서(`docs/api/`)로만 소통
- 작업 요청: `docs/work-requests/` — 세션 시작 시 확인
- 설계 원칙: Evidence-first UI, Analyst-first, LLM은 보조 정보, 프론트는 표현 계층

### S1-QA와의 분업

- **S1-QA는 S1과 별도 세션**이다. 브라우저/Playwright로만 UI, UX, 반응형, 콘솔 오류를 검증한다.
- S1-QA는 `services/frontend/src/**`를 읽지 않으며, 이슈는 `docs/work-requests/s1qa-to-s1-{주제}.md`로 전달한다.
- S1은 QA 증거(스크린샷, viewport, theme, 재현 단계)를 기준으로 수정하고, 수정 후 다시 S1-QA에 검증을 요청한다.

---

## 3. 현재 상태 (2026-04-02)

| 항목 | 값 |
|------|---|
| 유닛 테스트 | **347개 통과** (vitest + @testing-library/react + jsdom) |
| E2E 테스트 | 180개+ (Playwright + Chromium) |
| 페이지 | 17개 (프로젝트 스코프 12 + 글로벌 2 + 로그인 1 + 설정 1 + 파일 상세 1) |
| API 모듈 | 14개 (core, projects, source, analysis, pipeline, gate, approval, sdk, report, dynamic, auth, notifications, mock-handler, client) |
| 컴포넌트 | ui 31개 + static 31개 + finding 3개 + root 7개 = **72개** |
| 커스텀 훅 | 10개 (WS 3 + 상태 3 + 타이머 1 + 어댑터 1 + 키보드 단축키 1 + 동적 테스트 1) |
| 컨텍스트 | 5개 (Project, Toast, AnalysisGuard, Auth, Notification) |
| 유틸리티 | 24개 |
| 디자인 시스템 | DM Sans + Instrument Sans, #22D3A7 "Tactical Operations Console" |
| Dev Mock Mode | `npm run dev:mock` — 백엔드 없이 mock 데이터로 전 페이지 렌더링 |
| QA 검증 | 세션 15 — 33 PASS / 0 FAIL / 1 DEFERRED (FRICTION-5: 빈 상태 mock 미지원) |
| 레거시 Playwright 자산 | `services/frontend/playwright.config.ts`, `services/frontend/e2e/specs/*`, `services/frontend/e2e/qa-captures/*` — repo에 남아 있으나 **현행성 검증 후 재사용** |
| Codex QA 표준 | 공식 Codex Playwright skill(`$playwright` 계열) 우선, 없으면 Playwright MCP/CLI 폴백 |

---

### 3-1. 최근 계약 정렬 메모 (2026-04-04)

- S2 canonical contract(`docs/api/shared-models.md`) 기준으로 **build-target update는 `includedPaths` 변경을 지원하지 않음**.
- 이에 따라 S1 edit dialog는 **이름 + 빌드 프로필만 수정 가능**하도록 가드되며, 기존 선택 파일 목록은 읽기 전용으로 보여준다.
- 파일 구성 변경이 필요하면 **새 서브 프로젝트를 생성한 뒤 기존 타겟을 삭제**하는 흐름으로 안내한다.
- backend가 update에서 `includedPaths`를 지원하게 되면 그 시점에만 edit UX를 다시 열어야 한다.

---

## 4. Codex / OMX 운영 메모

- 하드 가드레일 재확인:
  - S1은 **다른 서비스 코드를 읽지 않는다**.
  - S2/S3/S4/S5/S6/S7과의 소통은 **WR로만** 한다.
  - 연동 판단은 API 계약서만 보고, 계약서가 비었거나 낡았으면 담당자에게 WR을 보낸다.
  - **커밋은 S2만** 한다. S1은 커밋하지 않는다.
  - `scripts/start*.sh`, `scripts/stop*.sh`, 서비스 실행 명령은 **사용자 허락 없이 실행하지 않는다**.
  - 로그/장애 분석은 `log-analyzer` MCP를 우선 사용한다.
- 세션 시작 순서: `docs/AEGIS.md` → 이 README → `docs/work-requests/`
- 장기 작업 메모/후속 세션 인계는 `$note`와 OMX 메모를 사용하되, **공용** `.omx/notepad.md`·`.omx/project-memory.json`에는 전역 durable 정보만 남긴다.
  - lane 전용 작업 메모, 세부 TODO, 중간 추론, 세션 한정 기록은 `docs/s1-handoff/`, `docs/work-requests/`, `.omx/state/sessions/{session-id}/...`처럼 더 좁은 범위에 남긴다.
  - 공용 `.omx`에 기록할 때는 가능하면 날짜 + `S1` + 메모 성격(전역 규칙/장기 사실/검증 결과)을 함께 적는다.
- 화면 수정이 길어지거나 한 세션이 끝까지 몰아쳐야 하는 작업은 `$ralph`를 우선 고려한다.
- S1과 S1-QA를 묶은 병렬 진행, 또는 여러 문서/검증 축을 동시에 돌릴 때는 `$team`을 고려한다.
- 시각 QA나 참조 이미지 비교가 필요하면 `$visual-verdict`를 사용한다.
- 공식 Playwright skill이 없으면 `$skill-installer`로 설치하고, 설치가 어렵거나 즉시 필요하면 Playwright MCP 또는 CLI로 진행한다.
- repo 내 기존 Playwright spec/캡처는 **참고 자료**로 보고, 현재 UI와 handoff 기준으로 다시 검증한 뒤 활용한다.

---

## 5. 기술 스택

| 항목 | 선택 |
|------|------|
| 프레임워크 | Electron + React 19.2.4 |
| 언어 | TypeScript |
| 빌드 | Vite |
| 라우팅 | react-router-dom 7.13.1 (HashRouter) |
| 상태관리 | React Context + useState |
| 아이콘 | lucide-react |
| 스타일 | CSS (라이트/다크/시스템 3-way 테마, CSS 변수 토큰) |
| API 통신 | fetch (Electron preload / 브라우저 직접) |
| 실시간 | WebSocket (envelope + seq 추적) |
| 공유 타입 | @aegis/shared (monorepo) |
| 코드 하이라이팅 | highlight.js (14개 언어) |
| 마크다운 | react-markdown + remark-gfm |
| 유닛 테스트 | vitest + @testing-library/react + jsdom |
| E2E 테스트 | Playwright + Chromium (모킹 기반, 백엔드 불필요) |

---

## 6. 라우팅 구조

```
/                                → redirect /projects
/projects                        → ProjectsPage
/projects/:projectId             → ProjectLayout
  /overview                      → OverviewPage (도넛+모듈, StatCard, 파일/취약점/서브프로젝트/SDK/활동)
  /static-analysis               → StaticAnalysisPage (dashboard|sourceUpload|sourceTree|progress|runDetail|findingDetail)
  /files                         → FilesPage (타겟 소속 뱃지)
  /files/:fileId                 → FileDetailPage (코드 하이라이팅, 마크다운 프리뷰)
  /vulnerabilities               → VulnerabilitiesPage
  /analysis-history              → AnalysisHistoryPage
  /report                        → ReportPage (모듈 탭, 필터, PDF 내보내기)
  /quality-gate                  → QualityGatePage (Gate 목록, 규칙별 결과, 오버라이드)
  /approvals                     → ApprovalsPage (상태 필터, 승인/거부, 이력)
  /dynamic-analysis               → ComingSoonPlaceholder (준비 중)
  /dynamic-test                   → ComingSoonPlaceholder (준비 중)
  /settings                      → ProjectSettingsPage (SDK 관리)
/settings                        → SettingsPage (글로벌: 백엔드 URL, 테마)
```

---

## 7. 구현 현황

### 완료 (동작 중)

| 기능 | 컴포넌트 | 비고 |
|------|---------|------|
| 프로젝트 CRUD | ProjectsPage + ProjectContext | 생성/조회/삭제 |
| Overview 대시보드 | OverviewPage | 도넛+모듈, StatCard, targetSummary, 활동 타임라인 |
| 정적 분석 대시보드 | StaticAnalysisPage | 2-탭 (최신분석+전체현황), 검색/필터/정렬, 활성 분석 배너 |
| 소스코드 업로드 | SourceUploadView | ZIP/tar.gz + Git, WS 진행률, 타겟 탐색 |
| 소스 트리 탐색기 | SourceTreeView | 2패널, Finding 오버레이, 폴더 접힘 sessionStorage |
| 빌드 타겟 관리 | BuildTargetSection + BuildProfileForm | CRUD, SDK("none"/등록/내장), 파이프라인 제어 |
| 서브 프로젝트 | SubprojectCreateDialog + TargetLibraryPanel | 생성(includedPaths), 라이브러리 포함/제외 |
| 2단계 분석 | TwoStageProgressView + useAnalysisWebSocket | Quick→Deep WS, full/subproject 모드 |
| Run/Finding 상세 | RunDetailView, FindingDetailView | Evidence-first, 상태 변경, 감사 로그, PoC, fingerprint 이력 |
| Finding 검색/필터 | LatestAnalysisTab | 텍스트 검색, sourceType, 정렬, 벌크 상태 변경 |
| Quality Gate | QualityGatePage | pass/fail/warning, 규칙 4종, 오버라이드 |
| Approval Queue | ApprovalsPage | 상태 필터, 사이드바 대기 뱃지, 승인/거부 |
| SDK 관리 | ProjectSettingsPage 내장 | 등록/삭제, WS 실시간, 6상태 뱃지, 5단계 스테퍼 |
| 파일 탐색기 | FilesPage + FileDetailPage | 트리, 코드 하이라이팅(14언어), 타겟 소속 뱃지, 마크다운 프리뷰 |
| 보고서 | ReportPage | 모듈 탭(static/deep), 필터, PDF |
| Agent 결과 | AgentResultPanel | confidence, caveats, 권고, SCA, LLM provenance(모델/프롬프트 버전) |
| 에러 핸들링 | ErrorBoundary, ToastContext, apiFetch | 5계층 (상세: architecture.md) |
| StatusBar | StatusBar | 3단계 헬스(ok/degraded/unhealthy), 서버 버전+가동시간, 30초 폴링 |
| WS 인프라 | 3개 훅 | envelope seq 추적 (`wsEnvelope.ts`) |

### 미구현

| 기능 | 비고 |
|------|------|
| 독립 Run/Finding 페이지 | 대시보드 내 뷰로 존재. 선택 사항 |
| `includedPaths` 편집(update) | 현재 backend 미지원. S1은 edit UX를 가드하고 재생성 흐름으로 안내 |
| 동적 분석 콘솔 고도화 | S2 WS + S6 필요 |

---

## 8. 관리하는 문서

| 문서 | 경로 | 용도 |
|------|------|------|
| AEGIS 공통 제약 | `docs/AEGIS.md` | **세션 시작 시 필독** (S2 관리) |
| 프론트 기능 명세 | `docs/specs/frontend.md` | 화면 명세, Finding 상태 머신 |
| QA 세션 가이드 | `docs/s1-handoff/qa-guide.md` | S1-QA의 Codex/Playwright 운영 기준 |
| 공유 모델 명세 | `docs/api/shared-models.md` | S1-S2 공유 타입 계약서 |
| 외부 피드백 | `docs/외부피드백/S1_frontend_working_guide.md` | 설계 기준 원본 |

---

## 9. shared 패키지

```bash
cd services/shared && npm run build
```

S2 단독 소유. 수정 시 `docs/api/shared-models.md` 업데이트 + S2에 통보.
