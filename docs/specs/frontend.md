# S1. UI Service 기능 명세

> Electron + React + TypeScript 기반 데스크탑 애플리케이션
> 분석 결과를 검증하고 triage할 수 있는 **보안 분석 운영 콘솔**

---

## 1. 개요

이 프론트엔드는 단순 대시보드가 아니라, 정적 분석 / 동적 분석 / 동적 테스트 / LLM 분석 결과를 **증적 중심으로 탐색하고, triage하고, 승인 흐름을 처리하는 운영 콘솔**이다.

> 프론트는 "판단을 만들어내는 곳"이 아니라, 백엔드가 관리하는 Findings / Evidence / Quality Gate / Approval 상태를 **정확하고 재검증 가능하게 보여주는 곳**이다.

---

## 2. 설계 원칙

### 2.1 Evidence-first UI

모든 주요 화면은 아래 순서를 따른다:

1. 현재 객체가 무엇인지
2. 어떤 상태인지
3. 어떤 결과가 나왔는지
4. 그 결과의 근거(evidence)가 무엇인지
5. 누가 / 무엇이 / 어떤 버전으로 그 결과를 냈는지

### 2.2 Analyst-first 설계

메인 플로우는 triage + evidence 탐색 중심으로 설계한다.
개발자와 리뷰어는 read-only / filtered view를 얹는 방식으로 확장한다.

### 2.3 LLM 결과는 보조 정보

- "AI 요약", "AI 가설", "AI 보조 설명"으로 구분 표시
- deterministic rule 결과와 시각적으로 동일하게 보이지 않게 함
- confidence가 있다면 표시하되, 사실 보증처럼 표현하지 않음
- 검증 실패(schema invalid, evidence ref missing)는 눈에 띄게 노출
- LLM만 근거인 경우 badge 표시: `AI-only`, `Needs Review`

금지:
- LLM 텍스트를 finding 제목으로 그대로 승격
- LLM이 severity를 판단한 결과를 확정값처럼 강조
- 원시 evidence 없이 AI 설명만 먼저 보여주는 구성

### 2.4 실시간 화면은 운영 콘솔

동적 분석 / 동적 테스트 화면은 채팅형 UI가 아니라 운영 콘솔이어야 한다.

필수 표시 항목:
- run 상태
- 수신 이벤트 수 / 드롭 수 / backlog
- rule match 수 / anomaly 수
- approval required 이벤트
- adapter / simulator 연결 상태
- raw event feed와 qualified event feed의 차이
- stop / pause / kill switch 상태

### 2.5 재검증 가능 = 재현성 + 감사 추적

**Deterministic 분석**: 같은 입력, 같은 rule/analyzer version, 같은 config → 같은 finding set

**LLM 분석**: 같은 문장 재현을 요구하지 않음. 대신:
- 같은 evidence set이 입력되었는가
- prompt version / model version이 기록되었는가
- output schema를 통과했는가
- claim이 supplied evidence에 grounding되어 있는가

재검증 상태 배지:
- `Reproducible` / `Grounded` / `Needs Revalidation` / `Not Reproducible` / `LLM Output Changed` / `Evidence Missing`

---

## 3. 사용자 페르소나

### Primary: 보안 분석가 / 플랫폼 운영자

핵심 업무: 분석 실행, finding triage, evidence drill-down, quality gate 확인, approval 검토, 리포트 검토

### Secondary: 개발자

핵심 업무: 자기 변경분 관련 finding 확인, evidence 중 코드/로그/응답 변화 확인, fix 후 재검증 결과 확인

### Tertiary: 리뷰어 / 심사 대응 담당자

핵심 업무: read-only 중심. finding 현황, approval 이력, evidence 연결성, export 리포트

### 역할별 UI 분리

인증이 아직 없어도 화면 구조 자체는 역할에 따라 분리 가능한 정보 아키텍처로 설계한다.
- analyst view: triage 중심
- developer view: 내 코드 관련 finding 필터
- reviewer view: read-only, 현황/이력/리포트

---

## 4. 도메인 모델 (S1 관점)

### 4.1 계층 구조

```
Project
  └─ TargetAsset          (논리적 분석 대상, 예: ECU)
       └─ VersionSnapshot  (firmware version, build hash, source commit)
            └─ Run          (실제 실행 단위: static / dynamic / test)
                 ├─ Finding  (발견 사항, 상태 머신 보유)
                 ├─ Evidence (증적)
                 └─ Artifact (산출물)
```

모든 주요 화면에 최소한 아래 필드를 표시:
- target label
- version / build hash
- run id
- environment (simulator / hardware / replay)

> ⚠️ 현재는 `Project → File → Analysis` 구조. shared 모델 확장은 S2 담당.
> S1은 새 모델이 준비되는 대로 화면을 전환한다.

### 4.2 Finding 상태 머신

#### Canonical States

| 상태 | 의미 |
|------|------|
| `Open` | 유효한 finding으로 등록, triage 대상 |
| `Needs Review` | 사람이 추가 검토 필요 |
| `Accepted Risk` | 위험 인지 상태로 보류/수용 |
| `False Positive` | 탐지 결과가 유효하지 않다고 판정 |
| `Fixed` | 수정 완료 |
| `Needs Revalidation` | 새 run/버전으로 인해 재확인 필요 |
| `Sandbox` | 정식 finding 승격 전 임시 상태 (LLM-only, 근거 부족) |

#### 기본 생성 규칙

- 룰 기반 + 증적 충분 + 정규화 완료 → `Open`
- LLM-only 또는 evidence grounding 부족 → `Sandbox`

#### 허용 전이

```
Open → Needs Review | Accepted Risk | False Positive | Fixed | Sandbox
Needs Review → Open | Accepted Risk | False Positive | Fixed | Sandbox
Accepted Risk → Needs Review | Open
False Positive → Needs Review | Open
Fixed → Needs Revalidation | Open
Sandbox → Needs Review | Open | False Positive
Needs Revalidation → Fixed | Open | False Positive
```

#### 제약

- `Open → Fixed`: fix와 연결된 증적(새 run, 새 결과, version change) 또는 시스템 자동 재검증 필요
- `Accepted Risk`: 영구 봉인 아님. target version / evidence / rule-model-policy 변경 / 만료 시 `Open` 또는 `Needs Review`로 복귀
- `Sandbox`: quality gate에 직접 반영하지 않음
- LLM-only finding: `Accepted Risk`나 `Fixed`로 바로 불가

#### 역할별 의도

- Analyst: Open / Needs Review / Sandbox triage, False Positive 제안, Accepted Risk 제안
- Reviewer/Lead: Accepted Risk 승인, reopen, final review
- System: Needs Revalidation 부여, regression reopen

#### 상태 변경 UI 요구사항

인증 없어도 상태 변경 dialog에 아래를 남긴다:
- `intendedRole`: 변경자의 의도된 역할
- `reason`: 변경 사유 (필수)
- `evidenceLinkCount`: 연결된 evidence 수
- `requiresApproval`: 승인 필요 여부

### 4.3 재검증 상태 (Validation Status)

Finding의 state와 별도로, 재검증 상태를 분리 표시:

| 배지 | 의미 |
|------|------|
| `Reproducible` | 동일 입력/조건으로 재현 가능 |
| `Grounded` | evidence에 근거함 |
| `Needs Revalidation` | 재검증 필요 |
| `Not Reproducible` | 재현 불가 |
| `LLM Output Changed` | LLM 재실행 시 결과 변화 |
| `Evidence Missing` | 참조 evidence 누락 |

---

## 5. 화면 명세

### 화면 우선순위

1. 프로젝트 / 대상 / 버전 / 런 탐색
2. Finding 목록 + 상태 변경 (triage)
3. Finding 상세 + Evidence 패널
4. Quality Gate 결과
5. Approval 큐
6. 리포트 / 감사 추적 뷰

### 5.1 공통 레이아웃 ✅ 구현 완료

```
┌──────────────────────────────────────────────────┐
│  타이틀바 (Electron 윈도우)                         │
├─────────┬────────────────────────────────────────┤
│         │  [브레드크럼]                              │
│ 사이드바  │                                        │
│         │           메인 콘텐츠 영역                │
│         │                                        │
├─────────┴────────────────────────────────────────┤
│  상태바 (서비스 연결 상태)                            │
└──────────────────────────────────────────────────┘
```

- 사이드바: 2-tier (프로젝트 컨텍스트 인식)
- 브레드크럼: ProjectLayout에서 Outlet 감싸기
- 상태바: Backend + LLM 헬스체크 (어댑터 표시 숨김 — 2026-03-19)

### 5.2 프로젝트 / 대상 / 버전 / 런 탐색

#### 프로젝트 목록 ✅
- CRUD, ProjectContext로 공유 상태

#### 대시보드 (Overview) ✅ (확장 필요)
- 현재: 도넛차트, 모듈별 분석, StatCard, 파일/취약점/이력
- 추가 필요:
  - TargetAsset 목록 표시
  - VersionSnapshot별 최신 run 요약
  - Quality Gate 결과 요약
  - Approval pending 건수

#### Run 목록 및 상세 ⬜ 미구현

Run 목록:
- run type: static / dynamic-analysis / dynamic-test
- run status: queued / running / waiting_approval / paused / failed / completed / aborted
- 시작/종료 시간, 대상 target/version, environment

Run 상세 필수 패널:
- run header (type, status, target, version, environment)
- timeline
- event stream
- artifacts
- findings created in this run
- approvals related to this run
- system notices (drop, schema mismatch, adapter reconnect, validation failure)

### 5.3 Finding 목록 + Triage ⬜ 미구현

현재 VulnerabilitiesPage를 Finding 기반으로 재설계해야 함.

필수 기능:
- severity, status, source별 필터링
- static / dynamic / test 출처 필터
- target, version, run, time 범위 필터
- 검색
- bulk triage action
- finding diff (이전 version 대비 신규/해결/상태 변화)

### 5.4 Finding 상세 + Evidence 패널 ⬜ 미구현

현재 VulnerabilityDetailView를 확장해야 함.

필수 필드:
- finding id, title, summary
- severity, status (상태 머신)
- validation status 배지
- source engine (rule / LLM / manual)
- createdAt / updatedAt
- evidence refs 목록
- linked artifacts
- LLM analysis panel (provenance: prompt version, model version, validation status)
- rule match / correlation info
- comments / review notes
- approval / accepted risk / false positive 기록
- 상태 변경 dialog (intendedRole, reason, evidenceLinkCount, requiresApproval)

### 5.5 Evidence 뷰어 ⬜ 미구현

**registry-based** 설계: type이 늘어나도 프론트가 덜 깨지는 구조.

```
┌─────────────┬──────────────────────────────┐
│ type badge  │ summary                      │
├─────────────┴──────────────────────────────┤
│ [Raw] [Structured]                         │
│                                            │
│ (type별 렌더러)                              │
│                                            │
├────────────────────────────────────────────┤
│ metadata: hash, content type, size,        │
│           source, createdAt                │
└────────────────────────────────────────────┘
```

필수 UX:
- type badge + summary
- raw view / structured view 전환
- unsupported type fallback view
- artifact metadata 표시 (hash, content type, size, source, createdAt)
- locator 기반 강조 (line range / packet range / time window)
- evidence ref jump
- 다운로드

#### 현재 범위에서 지원할 evidence 타입

**정적 분석:**
- source upload snapshot / content hash
- static rule-engine raw result JSON
- merged analysis result
- LLM request/response (scrubbed)
- finding과 연결된 source snippet locator

**동적 분석:**
- raw CAN frame window
- dynamic rule match event
- adapter session metadata
- alert와 연결된 frame/time window
- LLM assessment request/response

**동적 테스트:**
- generated input spec / seed
- injection request record
- observed response sequence
- evaluation summary
- LLM assessment request/response

**공통:**
- run config snapshot
- rulePackVersion, environment, timestamps
- analyzer / gateway version

### 5.6 Quality Gate ⬜ 미구현

S1은 viewer/editor UI를 소유한다. Gate 규칙은 백엔드가 소유.

필수 화면:
- Gate Profile 보기 (조건식 목록)
- Gate Result 보기 (overall pass/fail)
- Fail 이유 drill-down (어떤 조건이 fail시켰는지)
- Project에 할당된 gate 보기
- `overall` vs `new since baseline` 구분 표시

금지:
- "critical 1개 이상이면 fail" 같은 규칙을 프론트에 하드코딩
- 프론트가 gate 판정을 직접 계산

### 5.7 Approval Queue ⬜ 미구현

S1은 백엔드의 policy decision payload를 렌더링한다.
액션 이름을 하드코딩하지 않는다.

렌더링할 payload 필드:
- `actionType`, `targetType`, `riskLevel`
- `reason`, `requiresApproval`, `approvalScope`
- `expiresAt`

필수 화면:
- approval pending queue
- approval request detail (action summary, 위험도/대상/제한조건)
- confirm / reject dialog
- approval history panel

### 5.8 정적 분석 ✅ 구현 완료

- **2-탭 대시보드 (SonarQube 패턴)**:
  - **"최신 분석" 탭 (기본)**: 마지막 완료된 Run의 상세를 기본 뷰로 표시
    - Quality Gate 배너 (GateResultCard full mode)
    - Run 요약 StatCards 3종: Finding 수, Critical+High 건수, 미해결
    - 출처별 분포 (룰/AI/룰+AI 바차트) + 취약 파일 Top 5 (TopFilesCard)
    - Finding 목록 (파일별 그룹, vuln-card 클릭 → FindingDetailView)
    - 완료된 Run 없으면 EmptyState + "새 분석" 버튼
  - **"전체 현황" 탭**: 누적 데이터 기반 대시보드
    - PeriodSelector (7d/30d/90d/all, 이 탭 전용)
    - KPI StatCards 4종: 총 Finding, 미해결(해결률 표시), Gate 통과율, Run 수
    - 심각도/출처 분포 차트, 트렌드, 상태 분포
    - 파일/룰 랭킹, 최근 Run 목록
  - ActiveAnalysisBanner: 탭과 무관하게 항상 표시
- **소스코드 업로드**: ZIP/tar.gz 드래그앤드롭 + Git URL 클론, 디렉토리 요약 뷰, 타겟 탐색 버튼
- **소스 트리 탐색기**: 2패널(트리+코드 프리뷰), Finding 오버레이(폴더별 severity 배지), 검색, 파일 선택 시 코드 표시 + Finding 라인 하이라이트
- **빌드 타겟 관리**: ProjectSettingsPage에서 타겟 CRUD, SDK 프로파일 선택(12+1 사전정의), S4 자동 탐색
- **타겟 선택 분석**: 분석 실행 시 타겟 선택 다이얼로그 (전체/개별 체크, 하위 호환)
- **분석 진행**: 2단계 스테퍼(Quick SAST → Deep Agent), 타겟별 진행률(`[targetName] 분석 중 — N/M 타겟`), 중간 결과 열람
- **Finding 상세**: detail 마크다운 렌더링(상세 분석), PoC 생성 버튼(agent Finding), 상태 변경, 감사 로그
- **Agent 분석 결과**: AgentResultPanel — Confidence 게이지(4항목 분해), Caveats(CVE 하이라이트), 수정 권고, 정책 플래그(CWE/CVE 뱃지), SCA 라이브러리 테이블, Agent Audit(접을 수 있음)
- 결과: 파일별 그룹 표시 (location 파싱 → 파일명:라인), 심각도/출처/파일 3중 필터
- 취약점 상세 (실제 소스 코드 ±15줄 컨텍스트)
- 분석 이력 (목록, 드릴다운, 삭제)
- PageHeader + BackButton 통일 패턴

### 5.9 동적 분석 ✅ 구현 완료 (확장 필요)

현재:
- 세션 관리 (생성/시작/종료)
- 실시간 CAN 메시지 로그 (WebSocket, max 500개 슬라이딩 윈도우)
- **일시정지/재개**: 정지 시 메시지를 버퍼에 쌓고(max 500개) 화면 갱신 중단, 재개 시 flush
- **알림 패킷 분리 표시**: flagged 메시지를 CAN 스트림 아래 별도 미니 테이블로 수집
- 이상 탐지 알림 카드 (우측 패널)
- CAN 주입 (수동 + 시나리오)
- 주입 이력

추가 필요 (운영 콘솔 고도화):
- 수신 이벤트 수 / 드롭 수 / backlog 표시
- rule match 수 / anomaly 수 카운터
- backpressure notice, stream recovered 배지
- raw event feed / qualified event feed 분리
- sequence 추적, reconnect gap 감지, 누락 이벤트 표시
- 이벤트 타입별 분리 표시 (raw stream / qualified / findings / system notices)

### 5.10 동적 테스트 ✅ 구현 완료 (확장 필요)

현재:
- 전략 선택 (random/boundary/scenario)
- WebSocket 진행률 + 실시간 차트 + findings 로그
- 결과 표시 (findings 상세, LLM 분석 펼침)
- **ecuMeta 자동 채움**: 어댑터 선택 시 `ecuMeta[0]`에서 Target ECU(readOnly) + Target ID(canIds 드롭다운) 자동 설정
- **Protocol 필드 제거**: "CAN" 상수 고정 (S2 지시)
- ecuMeta 없을 시 수동 입력 fallback

추가 필요:
- approval required 표시 (실제 ECU 대상, fuzzing 등)
- stop / pause / kill switch 상태

### 5.11 보고서 / 감사 추적 ✅ 구현 완료 (확장 필요)

현재:
- ReportPage: 프로젝트 보고서 (전체/모듈별 탭, 필터 패널)
- Finding 테이블 (상태, 심각도, 출처, 모듈, 증적 수)
- Run 이력 + Gate 결과
- 승인 이력 + 감사 추적 뷰
- PDF 내보내기 (window.print)
- API 에러 vs 빈 데이터 분리: `loadError` 상태로 에러 UI("서버 오류" + 재시도 버튼) / 빈 데이터 UI("분석을 먼저 실행해주세요") 구분

추가 필요:
- 고급 필터 (RunId 기반 필터링)
- 커스텀 보고서 템플릿

### 5.12 파일 탐색기 ✅ 구현 완료

- 트리 뷰, 업로드/삭제, 언어별 아이콘
- 파일 상세 (소스 코드 + 취약점 하이라이팅)

### 5.13 설정 ✅ 구현 완료

- 글로벌 설정 (백엔드 URL, 테마 3-way)
- 프로젝트 설정:
  - LLM Gateway URL (테스트/저장/초기화)
  - 빌드 타겟 관리 (BuildTargetSection) — 타겟 CRUD, SDK 프로파일 선택(12+1), S4 자동 탐색, BuildProfileForm(상세 설정 토글)
  - 어댑터·룰 UI 숨김 (2026-03-19)

---

## 6. 구현 현황 요약

### 완료

| 기능 | 비고 |
|------|------|
| 프로젝트 CRUD | ProjectContext 공유 |
| Overview 대시보드 | 도넛, StatCard(모듈별 분포), 파일/취약점/이력 |
| 소스코드 업로드 | ZIP/tar.gz 드래그앤드롭 + Git URL 클론, 디렉토리 요약, 타겟 탐색 버튼 |
| 소스 트리 탐색기 | SourceTreeView — 2패널(트리+코드 프리뷰), Finding 오버레이(폴더별 severity 배지), 검색 |
| 빌드 타겟 관리 | BuildTargetSection + BuildProfileForm — 타겟 CRUD, SDK 프로파일(12+1), S4 자동 탐색 |
| 타겟 선택 분석 | TargetSelectDialog — 분석 실행 전 타겟 체크 선택, 전체/개별, 하위 호환 |
| 정적 분석 전체 흐름 | 소스 업로드→타겟 설정→WS 2단계 진행(Quick SAST→Deep Agent, 타겟별 진행률)→대시보드/결과 |
| 동적 분석 | **숨김** (2026-03-19) — 코드 유지, 라우트/사이드바 제거 |
| 동적 테스트 | **숨김** (2026-03-19) — 코드 유지, 라우트/사이드바 제거 |
| 파일 탐색기/상세 | 트리 뷰, 코드 표시, 취약점 하이라이팅 |
| 취약점 통합 뷰 | 분석 세션별 그룹(모듈 컬러), 심각도/날짜 필터 |
| 분석 이력 타임라인 | 전 모듈 통합 |
| 글로벌/프로젝트 설정 | LLM URL + 빌드 타겟 관리 (어댑터·룰 숨김) |
| 에러 핸들링 인프라 | ErrorBoundary, ToastContext(에러/경고/성공, 3초 자동 닫기, 우측 하단), apiFetch 에러 분류, X-Request-Id, retryable 대응 |
| 로깅 인프라 | `logError` (requestId 포함), `healthFetch` (non-throwing health check), WebSocket 이벤트 로깅 |
| 정적 분석 대시보드 | SonarQube 패턴 2-탭 (최신 분석: Gate+미해결+출처별 분포+Finding 목록 / 전체 현황: KPI+해결률+차트+랭킹+Run), 활성 분석 배너 |
| Run 상세 | RunDetailView — 메타, GateResultCard, AgentResultPanel(confidence+caveats+권고+정책+SCA+audit), Finding 파일별 그룹 |
| Finding 상세 | FindingDetailView — Evidence-first, 상태 변경, detail 마크다운, PoC 생성(agent), 감사 로그 |
| 보고서 | ReportPage — 모듈 탭, 필터 패널, Finding 테이블, Run/Gate, 승인, 감사 추적, PDF 내보내기 |
| 사이드바/브레드크럼/상태바 | 2-tier, 프로젝트 컨텍스트 |
| CSS 품질 | `!important` 0건, 인라인 스타일 최소화, transition 토큰, 반응형 보강 |

### 미구현 (새 방향)

| 기능 | 선행 조건 |
|------|----------|
| Run 독립 목록 페이지 | 대시보드 내 뷰로 존재. 독립 라우트 전환 선택 |
| Finding 독립 목록/triage 페이지 | 기본 구현 완료 (VulnerabilitiesPage → Finding 기반 재설계 필요) |
| Quality Gate 독립 화면 | GateResultCard 구현 완료, RunDetailView에 연동. 독립 화면은 추가 필요 |
| Approval Queue 화면 | Approval 엔티티 + API (S2) |
| 동적 분석 운영 콘솔 고도화 | 현재 숨김 상태. 재활성화 시 S2 WS 확장 필요 |
| 재검증 상태 배지 | validation status 필드 (S2) |

---

## 7. 기술 스택

| 항목 | 선택 |
|------|------|
| 프레임워크 | Electron + React 18 |
| 언어 | TypeScript |
| 빌드 | Vite |
| 라우팅 | react-router-dom v6 (HashRouter) |
| 상태관리 | React Context + useState (ProjectContext, ToastContext) |
| 아이콘 | lucide-react |
| 스타일 | CSS (라이트/다크/시스템 3-way 테마, CSS 변수 토큰 시스템) |
| API 통신 | fetch (Electron preload / 브라우저 직접) |
| 실시간 통신 | WebSocket |
| 공유 타입 | @aegis/shared (monorepo) |
| 테스트 | vitest + @testing-library/react + jsdom (192 테스트) |

---

## 8. 라우팅 구조

### 현재 (동작 중)

```
/                                → redirect /projects
/projects                        → ProjectsPage
/projects/:projectId             → ProjectLayout
  /overview                      → OverviewPage
  /static-analysis               → StaticAnalysisPage (dashboard|sourceUpload|sourceTree|progress|runDetail|findingDetail|legacyResult)
  /files                         → FilesPage
  /files/:fileId                 → FileDetailPage
  /vulnerabilities               → VulnerabilitiesPage (?severity=)
  /analysis-history              → AnalysisHistoryPage
  /report                        → ReportPage (모듈 탭, 필터, Finding 테이블, 감사 추적, PDF)
  /settings                      → ProjectSettingsPage (LLM Gateway URL + 빌드 타겟 관리)
/settings                        → SettingsPage (글로벌: 백엔드 URL, 테마 3-way)

숨김 라우트 (2026-03-19): /dynamic-analysis, /dynamic-test — 코드 유지, 라우트/사이드바 제거
```

### 추가 예정

```
/projects/:projectId
  /targets                       → TargetAsset 목록
  /targets/:targetId             → VersionSnapshot 목록
  /runs                          → Run 목록 (현재는 대시보드 내 RecentRunsList)
  /runs/:runId                   → Run 상세 (현재는 대시보드 내 RunDetailView)
  /findings                      → Finding 목록 (triage) (현재는 대시보드 내 뷰)
  /findings/:findingId           → Finding 상세 + evidence (현재는 대시보드 내 FindingDetailView)
  /quality-gate                  → Quality Gate 독립 화면
  /approvals                     → Approval Queue
```

---

## 9. API 클라이언트 (client.ts)

모든 백엔드 통신은 `services/frontend/src/renderer/api/client.ts`에 집중.

백엔드 URL 결정: `localStorage` → `window.api.backendUrl` → `http://localhost:3000`

### 에러 핸들링

`apiFetch`가 `ApiError` 커스텀 에러를 throw한다:

```typescript
class ApiError extends Error {
  code: string;        // 에러 코드 (예: "LLM_TIMEOUT", "NOT_FOUND")
  retryable: boolean;  // 재시도 가능 여부
  requestId: string;   // X-Request-Id (MSA 추적용)
}
```

**에러 분류 흐름**:
1. `fetch()` 자체 실패 → `NETWORK_ERROR` (retryable: true)
2. `!res.ok` → 응답 body에서 `errorDetail` 파싱 → `errorDetail.code`로 한국어 매핑
3. `errorDetail` 없으면 → 기존 `error` string 또는 HTTP 상태코드 폴백
4. `res.json()` 파싱 실패 → `PARSE_ERROR`

**X-Request-Id**: 모든 요청에 `crypto.randomUUID()` 자동 부착. S2가 그대로 사용하여 S2→S3 체인까지 전파. `downloadFile()`도 X-Request-Id 포함.

**retryable 대응**: `retryable: true`인 에러 발생 시 toast에 "다시 시도" 액션 버튼 표시. 클릭 시 해당 함수 재실행.

**로깅 헬퍼**:
- `logError(context, e)`: `ApiError`에서 `requestId`를 추출해 로그에 포함. 모든 catch 블록에서 `console.error` 대신 사용.
- `healthFetch(url)`: 헬스체크 전용. `X-Request-Id` 부착, throw 안 함, `{ ok, data }` 반환. StatusBar, SettingsPage, ProjectSettingsPage, OverviewPage에서 사용.

### 현재 구현된 API

| 카테고리 | 함수 | 엔드포인트 |
|---------|------|-----------|
| Config | `getBackendUrl()` | — |
| | `setBackendUrl(url)` | localStorage 저장 |
| Health | `healthCheck()` | GET /health |
| Projects | `fetchProjects()` | GET /api/projects |
| | `fetchProject(id)` | GET /api/projects/:id |
| | `createProject(req)` | POST /api/projects |
| | `deleteProject(id)` | DELETE /api/projects/:id |
| Settings | `fetchProjectSettings(pid)` | GET /api/projects/:pid/settings |
| | `updateProjectSettings(pid, s)` | PUT /api/projects/:pid/settings |
| Overview | `fetchProjectOverview(pid)` | GET /api/projects/:pid/overview |
| Files | `fetchProjectFiles(pid)` | GET /api/projects/:pid/files |
| | `fetchFileContent(fileId)` | GET /api/files/:fileId/content |
| | `downloadFile(fileId)` | GET /api/files/:fileId/download |
| | `deleteProjectFile(pid, fid)` | DELETE /api/projects/:pid/files/:fid |
| Source | `uploadSource(pid, file)` | POST /api/projects/:pid/source/upload |
| | `cloneSource(pid, url, branch?)` | POST /api/projects/:pid/source/clone |
| | `fetchSourceFiles(pid)` | GET /api/projects/:pid/source/files |
| Source | `fetchSourceFileContent(pid, path)` | GET /api/projects/:pid/source/file?path= |
| Analysis | `runAnalysis(pid, targetIds?)` | POST /api/analysis/run |
| | `generatePoc(pid, findingId)` | POST /api/analysis/poc |
| | WS `/ws/analysis?analysisId={id}` | WebSocket (Quick+Deep 진행률, targetName/targetProgress) |
| Targets | `fetchBuildTargets(pid)` | GET /api/projects/:pid/targets |
| | `createBuildTarget(pid, body)` | POST /api/projects/:pid/targets |
| | `updateBuildTarget(pid, tid, body)` | PUT /api/projects/:pid/targets/:tid |
| | `deleteBuildTarget(pid, tid)` | DELETE /api/projects/:pid/targets/:tid |
| | `discoverBuildTargets(pid)` | POST /api/projects/:pid/targets/discover |
| Static (legacy) | `uploadFiles(pid, files)` | POST /api/static-analysis/upload |
| | `runStaticAnalysis(pid, files)` | POST /api/static-analysis/run |
| | `fetchAnalysisResults(pid)` | GET /api/static-analysis/results?projectId= |
| | `fetchAnalysisResult(aId)` | GET /api/static-analysis/results/:aId |
| | `deleteAnalysisResult(aId)` | DELETE /api/static-analysis/results/:aId |
| Dynamic | `createDynamicSession(pid, aId)` | POST /api/dynamic-analysis/sessions |
| | `fetchDynamicSessions(pid)` | GET /api/dynamic-analysis/sessions?projectId= |
| | `fetchDynamicSessionDetail(sId)` | GET /api/dynamic-analysis/sessions/:sId |
| | `startDynamicSession(sId)` | POST /api/dynamic-analysis/sessions/:sId/start |
| | `stopDynamicSession(sId)` | DELETE /api/dynamic-analysis/sessions/:sId |
| Adapters | `fetchAdapters(pid)` | GET /api/projects/:pid/adapters |
| | `createAdapter(pid, req)` | POST /api/projects/:pid/adapters |
| | `updateAdapter(pid, id, req)` | PUT /api/projects/:pid/adapters/:id |
| | `deleteAdapter(pid, id)` | DELETE /api/projects/:pid/adapters/:id |
| | `connectAdapterById(pid, id)` | POST /api/projects/:pid/adapters/:id/connect |
| | `disconnectAdapterById(pid, id)` | POST /api/projects/:pid/adapters/:id/disconnect |
| DynTest | `runDynamicTest(pid, cfg, aId)` | POST /api/dynamic-test/run |
| | `getDynamicTestResults(pid)` | GET /api/dynamic-test/results?projectId= |
| | `getDynamicTestResult(tId)` | GET /api/dynamic-test/results/:tId |
| | `deleteDynamicTestResult(tId)` | DELETE /api/dynamic-test/results/:tId |
| Rules | `fetchRules(pid)` | GET /api/projects/:pid/rules |
| | `createRule(pid, rule)` | POST /api/projects/:pid/rules |
| | `updateRule(pid, id, upd)` | PUT /api/projects/:pid/rules/:id |
| | `deleteRule(pid, id)` | DELETE /api/projects/:pid/rules/:id |
| Dashboard | `fetchStaticDashboardSummary(pid, p)` | GET /api/analysis/summary?projectId=&period= |
| Static+ | `runStaticAnalysisAsync(pid, files)` | POST /api/static-analysis/run |
| | `fetchAnalysisProgress(id)` | GET /api/static-analysis/status/:id |
| | `fetchAllAnalysisStatuses()` | GET /api/static-analysis/status |
| | `abortAnalysis(id)` | POST /api/static-analysis/abort/:id |
| Runs | `fetchProjectRuns(pid)` | GET /api/projects/:pid/runs |
| | `fetchRunDetail(runId)` | GET /api/runs/:runId |
| Findings | `fetchProjectFindings(pid, filters)` | GET /api/projects/:pid/findings |
| | `fetchFindingDetail(fId)` | GET /api/findings/:fId |
| | `updateFindingStatus(fId, status, reason)` | PATCH /api/findings/:fId/status |
| Report | `fetchProjectReport(pid, filters)` | GET /api/projects/:pid/report |
| | `fetchModuleReport(pid, module, filters)` | GET /api/projects/:pid/report/:module |
| CAN | `fetchScenarios()` | GET /api/dynamic-analysis/scenarios |
| | `injectCanMessage(sId, req)` | POST /api/dynamic-analysis/sessions/:sId/inject |
| | `injectScenario(sId, scenarioId)` | POST /api/dynamic-analysis/sessions/:sId/inject-scenario |
| | `fetchInjections(sId)` | GET /api/dynamic-analysis/sessions/:sId/injections |
| Helpers | `logError(context, e)` | — (requestId 포함 에러 로깅) |
| | `healthFetch(url)` | GET :url/health (X-Request-Id, non-throwing) |
| WebSocket | `getWsBaseUrl()` | http → ws 변환 |

### 추가 필요한 API (S2 구현 대기)

| 카테고리 | 예상 엔드포인트 |
|---------|---------------|
| Quality Gate | profile/result /api/quality-gates |
| Approval | queue/detail/resolve /api/approvals |

---

## 10. UI 컴포넌트 / Hooks

### 현재 컴포넌트 (components/ui/)

| 컴포넌트 | 용도 |
|---------|------|
| `PageHeader` | 페이지 타이틀 + 아이콘 + subtitle + 액션 |
| `StatCard` | 통계 카드 (value + detail) |
| `SeverityBadge` | 심각도 배지 (sm/md) |
| `SeveritySummary` | 심각도 요약 인라인 |
| `SeverityBar` | 수평 심각도 분포 바 |
| `DonutChart` | 도넛 차트 |
| `ListItem` | 목록 아이템 |
| `EmptyState` | 빈 상태 |
| `BackButton` | 뒤로가기 |
| `Spinner` | 로딩 스피너 |
| `AdapterSelector` | 어댑터 선택 (ECU 이름·CAN ID 수 표시) |
| `ErrorBoundary` | 렌더링 크래시 방어 (class component, fallback UI) |

### 추가된 컴포넌트 (구현 완료)

| 컴포넌트 | 용도 |
|---------|------|
| `FindingStatusBadge` | Finding 상태 배지 (7-state, 툴팁) ✅ |
| `ConfidenceBadge` | confidence 점수 배지 (툴팁) ✅ |
| `SourceBadge` | 탐지 출처 배지 (rule / llm, 툴팁) ✅ |
| `FindingSummary` | Finding 요약 인라인 ✅ |
| `EvidencePanel` | evidence 목록 + 선택 ✅ |
| `EvidenceViewer` | evidence type별 렌더러 (오버레이) ✅ |
| `StateTransitionDialog` | 상태 변경 다이얼로그 (허용 전이 + 사유 필수) ✅ |
| `GateResultCard` | quality gate 결과 카드 (pass/fail/warning + rules) ✅ |
| `PeriodSelector` | 기간 선택기 (7d/30d/90d/all) ✅ |
| `TrendChart` | 트렌드 SVG 차트, 2회 미만 가이드 메시지 ✅ |
| `ConfirmDialog` | 확인/취소 다이얼로그 ✅ |
| `FileTreeNode` | 공유 재귀 트리 노드 (render props, A11Y) ✅ |
| `LatestAnalysisTab` | 최신 분석 탭 (Gate 배너+Run 요약+Finding 파일별 그룹) ✅ |
| `OverallStatusTab` | 전체 현황 탭 (KPI+차트+랭킹+최근 Run) ✅ |
| `SourceTreeView` | 2패널 소스 트리 탐색기 (트리+코드 프리뷰+Finding 오버레이) ✅ |
| `BuildTargetSection` | 빌드 타겟 관리 카드 (CRUD + S4 자동 탐색) ✅ |
| `BuildProfileForm` | SDK 선택 + 빌드 프로파일 편집 (상세 설정 토글) ✅ |
| `TargetSelectDialog` | 분석 전 타겟 선택 다이얼로그 (전체/개별 체크) ✅ |
| `AgentResultPanel` | Agent 분석 결과 패널 (confidence+caveats+권고+정책+SCA+audit) ✅ |

### 추가 필요한 컴포넌트

| 컴포넌트 | 용도 |
|---------|------|
| `ValidationStatusBadge` | 재검증 상태 배지 |
| `ApprovalCard` | 승인 요청 카드 |
| `RunHeader` | run 정보 헤더 |
| `EventStream` | 실시간 이벤트 스트림 |
| `TimelineView` | 타임라인 뷰 |

### 현재 Hooks

| Hook | 용도 |
|------|------|
| `useElapsedTimer` | 경과 시간 타이머 공통 훅 |
| `useAnalysisWebSocket` | WS 기반 Quick+Deep 2단계 분석 (targetName/targetProgress 포함) |
| `useBuildTargets` | 빌드 타겟 CRUD + S4 자동 탐색 훅 |
| `useStaticDashboard` | 대시보드 데이터 + 최신 Run 상세 fetch + 활성 분석 폴링 |
| `useStaticAnalysis` | 정적 분석 워크플로우 (레거시 동기, 미사용) |
| `useAsyncAnalysis` | 비동기 분석 (레거시, useAnalysisWebSocket으로 대체) |
| `useDynamicTest` | 동적 테스트 워크플로우 (숨김 — 코드 유지) |
| `useAdapters` | 어댑터 상태 (숨김 — 코드 유지) |

---

## 11. WebSocket / 실시간 요구사항

### 이벤트 타입 분류 (목표)

| 카테고리 | 이벤트 |
|---------|--------|
| Run | `run.status.changed` |
| Capture | `capture.frame.received`, `capture.backpressure.notice` |
| Rule | `rule.matched` |
| Finding | `finding.created`, `finding.updated` |
| Approval | `approval.required`, `approval.resolved` |
| Adapter | `adapter.connection.changed` |
| Simulator | `simulator.state.changed` |
| LLM | `llm.annotation.completed` |
| System | `system.validation.failed` |

이벤트를 같은 레벨로 섞지 않는다:
- raw stream
- qualified events
- findings
- control / system notices

### 필수 처리

- 마지막 sequence 번호 추적
- 재연결 시 gap 감지 → "일부 이벤트 누락 가능" 표시
- 중복 이벤트 service layer에서 dedupe
- event drop 시 명시적 표시 (`Dropped N raw frames`, `Backpressure active`, `Stream recovered`)
- raw 이벤트 페이지네이션/윈도잉

---

## 12. Electron 보안 요구사항

필수:
- `contextIsolation: true`
- `nodeIntegration: false`
- preload 최소화
- renderer에 필요한 최소 IPC만 노출
- shell open / external open 제한
- 파일 시스템 접근은 명시적 user action 기반
- 민감정보 저장 최소화
- access token을 localStorage에 평문 저장 금지

금지:
- renderer에서 Node API 직접 사용
- 임의 URL 로드
- raw HTML 그대로 렌더링
- LLM 응답 markdown을 sanitize 없이 렌더링

---

## 13. 테스트 현황

vitest 4.1.0 + @testing-library/react + jsdom. `npm test` 실행.

### 구현 완료 (192 테스트)

| 유형 | 파일 수 | 테스트 수 | 대상 |
|------|---------|----------|------|
| 유틸 유닛 | 9 | 89 | tree, location, findingOverlay, format, fileMatch, markdown, severity, analysis, cveHighlight |
| 상수 유닛 | 3 | 26 | finding (상태 전이 canTransitionTo), languages, modules |
| API 통합 | 1 | 11 | fetch 모킹 + CRUD/runAnalysis/PoC/source API |
| 훅 테스트 | 2 | 14 | useElapsedTimer (fake timer), useBuildTargets (API 모킹) |
| 컴포넌트 | 4 | 39 | TargetSelectDialog, BuildProfileForm, FileTreeNode, ConfirmDialog |
| 컨텍스트 | 1 | 6 | ToastContext (auto-dismiss, max 5, action) |
| UI 컴포넌트 | 1 | 7 | SeverityBadge, SourceBadge, Spinner, EmptyState |

### 추가 예정
- useStaticDashboard 훅 테스트
- 추가 컴포넌트 테스트 (AgentResultPanel, SourceTreeView 등)
- E2E 시나리오 테스트

---

## 14. 관련 문서

| 문서 | 경로 |
|------|------|
| 전체 기술 개요 | `docs/specs/technical-overview.md` |
| S2 백엔드 명세 | `docs/specs/backend.md` |
| 공유 모델/DTO | `docs/api/shared-models.md` |
| 외부 피드백 (S1) | `docs/외부피드백/S1_frontend_working_guide.md` |
| S1 인수인계서 | `docs/s1-handoff/README.md` |
| AEGIS 공통 제약 | `docs/AEGIS.md` |
