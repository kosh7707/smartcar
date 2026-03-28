# S1 Session 10 — 2026-03-25

## 완료된 작업

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
