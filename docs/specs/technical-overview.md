# 기술 명세 - 전체 개요

> 이 문서는 AEGIS 시스템 전체 구조, 서비스 구성, 통신 방식, 데이터 흐름을 정의한다.
> 서비스별 상세 명세는 개별 문서로 분리한다.
> **이 문서의 소유자는 S2(AEGIS Core)이다.** 변경 제안은 work-request로.
> **마지막 업데이트: 2026-03-28**

---

## 1. 시스템 목적

**AEGIS** — Automotive Embedded Governance & Inspection System

자동차 임베디드 C/C++ 소프트웨어의 보안 취약점을 **SAST + LLM + 동적 분석**으로 종합 검증하는 플랫폼.
소스코드 업로드 → 빌드 자동화 → 정적 분석(6도구) → LLM 심층 판정 → 동적 분석/테스트의 전 과정을 커버한다.

### 핵심 원칙

1. **결정론적 처리를 최대화하고, LLM의 결정 표면을 최소화한다** — 도구 실행, 필터링, 정규화는 결정론적. LLM은 판단만.
2. **Evidence-first** — 모든 Finding은 증적(EvidenceRef)에 근거해야 한다.
3. **Analyst-first** — LLM은 보조 정보. 최종 판단은 분석가(사용자)가 한다.
4. **S2가 플랫폼 오케스트레이터** — 모든 서비스는 S2가 호출하는 하위 서비스이다.

---

## 2. 아키텍처 개요

MSA(Microservice Architecture) 기반 7개 독립 서비스 구성.

```
                     S1 (Frontend :5173)
                          │
                     S2 (AEGIS Core :3000)  ← 플랫폼 오케스트레이터
                    ╱     │     ╲      ╲
                 S3       S4     S5      S6
            Agent+Build  SAST    KB    동적분석
          :8001/:8003  :9000  :8002    :4000
                │
           S7 Gateway (:8000)  ← LLM 단일 관문
                │
           LLM Engine (DGX Spark)
           Qwen3.5-122B-A10B-GPTQ-Int4
```

**기본 원칙**: S2가 모든 하위 서비스를 호출하는 플랫폼 오케스트레이터이다.
**위임 허용**: S2가 S3에게 분석을 위임하면, S3는 내부적으로 S4/S5/S7를 직접 호출할 수 있다.
**LLM 접근 원칙**: 모든 LLM 호출은 S7(Gateway)을 경유한다. LLM Engine을 직접 호출하지 않는다.

### 2.1 설계 패턴

**MVVM (Model-View-ViewModel)**
- **Model**: 도메인 데이터 구조 (`@aegis/shared`에 정의)
- **View**: React 컴포넌트 (화면 렌더링만 담당, 로직 없음)
- **ViewModel**: React Hook (상태 관리, 데이터 가공, API 호출)

**Service (Orchestrator) 패턴**
- 각 검증 모듈(정적 분석, 동적 분석, 동적 테스트)은 독립된 Service로 구현
- Core Service가 Orchestrator 역할로 여러 Service를 조율
- Service는 ViewModel이나 View를 알지 못함 (단방향 의존)

**데이터 객체 구분 원칙**

| 구분 | 역할 | 위치 | 예시 |
|------|------|------|------|
| Model | 도메인 핵심 데이터 구조 | `@aegis/shared` | `Vulnerability`, `Project`, `Finding` |
| DTO | 서비스 간 통신용 전송 객체 | `@aegis/shared` | `WsAnalysisMessage`, `AnalysisRequest` |
| DAO | DB 접근 및 영속화 담당 | Core Service 내부 | `ProjectDAO`, `FindingDAO` |

```
[View] → [ViewModel] → [Service] → [DAO] → [DB]
  │           │              │
  │           │              └── Model 사용
  │           └── DTO ↔ Model 변환
  └── ViewModel이 제공하는 데이터만 표시
```

---

## 3. 서비스 목록

| ID | 서비스명 | 기술 스택 | 역할 | 포트 |
|----|---------|----------|------|------|
| S1 | Frontend + QA | React + TypeScript + Vite | 사용자 인터페이스, 결과 시각화 | :5173 |
| S2 | AEGIS Core (Backend) | Express 5 + TypeScript + SQLite | 도메인 관리, 오케스트레이션, DB | :3000 |
| S3 | Analysis Agent + Build Agent | Python + FastAPI | 보안 분석 자율 에이전트 + 빌드 자동화 에이전트 | :8001, :8003 |
| S4 | SAST Runner | Python + FastAPI | 6개 SAST 도구 + SCA + 코드 구조 + 빌드 자동화 | :9000 |
| S5 | Knowledge Base | Python + FastAPI + Neo4j + Qdrant | 위협 그래프 + 벡터 검색 (CWE, ATT&CK, CAPEC, CVE) | :8002 |
| S6 | Dynamic Analysis | TypeScript + Node.js | ECU Simulator + Adapter (CAN 통신) | :4000 |
| S7 | LLM Gateway + Engine | Python + FastAPI + vLLM | LLM 단일 관문 + DGX Spark 추론 | :8000, DGX |

### S1. Frontend + QA

- 프로젝트 생성/조회/수정/삭제
- 소스코드 업로드 (ZIP/Git clone)
- Quick→Deep 분석 진행률 실시간 표시
- Finding triage (7-state 라이프사이클)
- 취약점 상세 조회 (심각도, 증적, 코드 위치, 수정 가이드)
- Quality Gate / Approval 워크플로우
- 전체 현황 대시보드 (취약점 통계, 심각도 분포)
- 보고서 생성

### S2. AEGIS Core (Backend)

**플랫폼 오케스트레이터**. S1에게 REST API를 제공하고, S3/S4/S5/S6를 호출하는 중추.

- 프로젝트 CRUD + 소스코드 관리 (ZIP/Git → `uploads/{projectId}/`)
- Quick→Deep 분석 오케스트레이션 (`AnalysisOrchestrator`)
- 코어 도메인: Run, Finding (7-state FSM), EvidenceRef, AuditLog
- Quality Gate 정책 엔진 + Approval 워크플로우
- ResultNormalizer (SAST findings + Agent claims → 통합 Finding)
- WebSocket 실시간 진행률 (4개 인스턴스: static/dynamic/test/analysis)
- Observability (구조화 로깅, Correlation ID, 에러 클래스 계층)

### S3. Analysis Agent

**보안 분석 자율 에이전트**. S2로부터 `projectPath`를 받아 종합 분석 수행.

- Phase 1 (결정론적): S4(SAST) + 코드 구조 그래프 + S5(KB) + SCA + CVE 조회
- Phase 2 (LLM 판정): S7(Gateway)를 통해 LLM 2턴 호출, 도구 자발 호출, 핵심 취약점만 claim
- 결과: `claims[]` + `audit` + `evidenceRefs` 반환

**Build Agent (:8003)** — S3가 겸임. LLM 에이전트가 빌드 파일(CMakeLists.txt, Makefile)을 분석하여 빌드 명령어 + buildProfile + compile_commands.json을 자동 생성.

### S4. SAST Runner

**정적 분석 도구 실행기**. 빌드 자동화 + 6개 SAST 도구 병렬 실행.

- 빌드 자동화: CMake/Make 감지 → `compile_commands.json` 생성
- SAST 6도구: cppcheck, flawfinder, rats, semgrep, infer, clang-tidy
- SCA (Software Composition Analysis): 의존성 취약점 스캔
- 코드 구조 분석: 호출 그래프, 복잡도 메트릭

### S5. Knowledge Base

**위협 지식 저장소**. Neo4j 그래프 + Qdrant 벡터 검색.

- CWE, ATT&CK, CAPEC, CVE 데이터 통합
- 시맨틱 검색 (벡터 유사도)
- 배치 검색 + CVE batch lookup (EPSS/KEV 포함)

### S6. Dynamic Analysis

**동적 분석/테스트 인프라**. ECU Simulator + CAN Adapter.

- ECU Simulator: 가상 ECU (CAN 응답 시뮬레이션)
- Adapter: WebSocket 기반 CAN 프레임 중계 (수신/주입)
- S2가 Adapter에 WebSocket으로 연결하여 CAN 데이터 수신/주입

### S7. LLM Gateway + Engine

**LLM 단일 관문**. 모든 LLM 호출은 S7을 경유.

- Gateway: 프롬프트 관리, 모델 라우팅, Circuit Breaker, 토큰 사용량 추적
- Engine: DGX Spark에서 Qwen3.5-122B-A10B-GPTQ-Int4 서빙 (vLLM)
- OpenAI-compatible API (`/v1/chat/completions`)

---

## 4. 서비스 간 통신

### 4.1 통신 방식

| From | To | 프로토콜 | 용도 | 비고 |
|------|----|---------|------|------|
| S1 → S2 | HTTP REST | 분석 요청/응답, CRUD | S1의 유일한 서버 통신 대상 |
| S1 ↔ S2 | WebSocket | 분석 진행률, 동적 분석 실시간 스트리밍 | 4개 WS 엔드포인트 |
| S2 → S3 | HTTP REST | `POST /v1/tasks` (deep-analyze 위임) | 분석 위임 |
| S2 → S4 | HTTP REST | `POST /v1/scan` (직접 SAST 요청) | 사용자 트리거 Quick |
| S2 → S5 | HTTP REST | `POST /v1/search` (지식 조회) | Finding 상세 등 |
| S2 → S6 | WebSocket | CAN 프레임 실시간 스트리밍 | 동적 분석/테스트 |
| S3 → S4 | HTTP REST | Phase 1에서 SAST 호출 | S2 위임 하위 |
| S3 → S5 | HTTP REST | Phase 1에서 지식 검색 | S2 위임 하위 |
| S3 → S7 | HTTP REST | `POST /v1/chat` (Agent 멀티턴 LLM 호출) | Phase 2 |
| S7 → LLM Engine | HTTP REST | 추론 요청 | S7만 직접 접근 |

### 4.2 통신 방향 원칙

- **S2가 오케스트레이터**: S1은 S2만 알고 있다. S2가 하위 서비스를 호출한다.
- **위임 허용**: S2가 S3에게 분석을 위임하면, S3는 내부적으로 S4/S5/S7를 직접 호출할 수 있다.
- **LLM 단일 관문**: 모든 LLM 호출은 S7(Gateway)을 경유한다.
- **역방향 호출 금지**: 하위 서비스가 상위 서비스를 호출하지 않는다.
- **WebSocket 예외**: S2가 S1에게 실시간 데이터를 push할 수 있다 (구독 모델).

---

## 5. 분석 범위 정의

### 5.1 IN-SCOPE

| 영역 | 설명 | 수단 |
|------|------|------|
| **바이너리** | 소스코드 → 빌드 → 실행 → 내부 로직 검증 | SAST 6도구 (Phase 1), LLM 심층 판정 (Phase 2), GDB 동적 확인 (Phase 3, 향후) |
| **네트워크** | 서비스 간 통신 경로 추적, 입력 검증, 주입 테스트 | CAN 트래픽 감청, QEMU 기반 멀티-서비스 실행, 퍼징 (향후) |

### 5.2 OUT-OF-SCOPE

| 영역 | 이유 |
|------|------|
| 부채널 공격 (전력 분석, 타이밍, EM 방사) | 하드웨어 측정 장비 필요. 소프트웨어 플랫폼 범위 밖 |
| 하드웨어 결함 주입 (voltage glitching) | 물리 장비 필요 |
| GPIO/SPI/I2C 레지스터 직접 접근 코드의 런타임 분석 | QEMU user-mode 불가. 정적 분석은 가능하되, 동적 확인은 범위 밖 |

### 5.3 실행 환경 전략

ARM 등 크로스컴파일 타겟은 **QEMU user-mode**로 실행:
- 네트워크 syscall(bind, listen, accept)이 호스트 OS에 매핑됨
- 멀티-서비스 동시 실행 + 서비스 간 통신 가능
- GDB 연결 가능 (`qemu-aarch64 -g <port>`)
- 특수 장비 불필요 (WSL2에서 `qemu-user` + `gdb-multiarch`로 충분)

---

## 6. 검증 모듈

### 6.1 Quick → Deep 파이프라인 (정적 분석)

```
사용자: 소스코드 업로드 (ZIP/Git) → "분석 실행"

  [Quick] S2 → S4 SAST Runner (~30초)
    S4: 빌드 자동화 → compile_commands.json → 6개 SAST 도구 병렬 실행
    S2: SastFinding[] → Vulnerability[] → AnalysisResult 저장
        → ResultNormalizer → Run + Finding[] + EvidenceRef[]
    WS: quick-complete → S1 즉시 표시

  [Deep] S2 → S3 Agent (~3분, 백그라운드)
    S2: projectPath 전달 (S3가 자체적으로 파일 수집/빌드/SAST/KB/LLM)
    S3: Phase 1(결정론적) + Phase 2(LLM 2턴) → claims[]
    S2: claims[] → Vulnerability[] → AnalysisResult 저장
        → ResultNormalizer → Run + Finding[] + EvidenceRef[]
    WS: deep-complete → S1 보강 표시
```

- **Quick**: S4가 빌드 + SAST 6도구 실행. 결정론적 findings 즉시 반환.
- **Deep**: S3 Agent가 Phase 1(결정론적) + Phase 2(LLM 판정). 핵심 취약점만 claim.
- **S2 역할**: `projectPath`만 전달. 빌드/파일수집/SAST는 S3/S4가 처리.
- **정규화**: Quick → `normalizeAnalysisResult()`, Deep → `normalizeAgentResult()` (claims→Finding)

### 6.2 동적 분석 (CAN 모니터링)

> UI에서 숨김 처리. 백엔드 API는 유지.

```
CAN 데이터: ECU Simulator → Adapter → S2 WebSocket 수신
  → [1계층] CAN 룰 엔진 실시간 평가 (빈도, 비인가 ID, 공격 시그니처)
  → [2계층] alert 누적 시 LLM 심층 분석 (S7 경유)
  → 세션 종료 시 전체 로그 LLM 종합 분석 → AnalysisResult 저장
```

### 6.3 동적 테스트 (퍼징/침투)

> UI에서 숨김 처리. 백엔드 API는 유지.

```
사용자: 테스트 대상 설정 + 실행 요청
  → InputGenerator (3전략: random, boundary, scenario)
  → ECU에 CAN 프레임 주입 → 응답 관찰 (크래시, 이상)
  → [2계층] findings 있으면 LLM 분석 (S7 경유)
  → DynamicTestResult + AnalysisResult 저장
```

### 6.4 서브 프로젝트 파이프라인

프로젝트 내 독립 빌드 단위(서브 프로젝트)별로 빌드→스캔→코드그래프 적재를 순차 실행.

```
discovered → configured → building → built → scanning → scanned → graphing → graphed → ready
```

- S2가 오케스트레이션, S4(빌드+스캔), S5(코드그래프 적재) 호출
- 서브 프로젝트별 물리적 복사로 완전 격리 (`uploads/{projectId}/{targetId}/`)
- 사용자가 파일 트리 체크박스로 포함 파일/폴더 선택 (`includedPaths`)

---

## 7. 공유 데이터 구조

S1과 S2는 TypeScript monorepo의 `@aegis/shared` 패키지를 통해 Model/DTO 타입을 공유한다.
S2가 `@aegis/shared`를 **단독 소유**한다.

### 7.1 핵심 모델

```
Project                    분석 대상 프로젝트 (최상위 단위)
  - id, name, description, createdAt, updatedAt

Run                        하나의 분석 수행 단위
  - id, projectId, module, status, analysisResultId
  - findingCount, startedAt, endedAt

Finding                    발견된 취약점/이슈 하나
  - id, runId, projectId, module
  - status (7-state FSM: open → needs_review → accepted_risk/false_positive/fixed → needs_revalidation)
  - severity (critical/high/medium/low/info)
  - confidence (high/medium/low)
  - sourceType (rule-engine/llm-assist/both/agent/sast-tool)
  - title, description, location, suggestion, ruleId

EvidenceRef                Finding에 연결된 증적
  - id, findingId, artifactId, artifactType, locatorType, locator(JSON)

AuditLog                   상태 변경 감사 로그
  - id, timestamp, actor, action, resource, resourceId, detail(JSON), requestId

AnalysisResult             분석 결과 원본
  - id, projectId, module (static_analysis/dynamic_analysis/dynamic_testing/deep_analysis)
  - status, vulnerabilities(JSON), summary(JSON), warnings(JSON)

Vulnerability              취약점 하나 (AnalysisResult 내부)
  - id, severity, title, description, location, source, suggestion, confidence

BuildProfile               빌드 설정
  - sdkId, compiler, compilerVersion, targetArch, languageStandard, headerLanguage
  - includePaths, defines, flags
```

### 7.2 Finding 상태 머신 (7-state)

```
                    ┌──────────────────────┐
                    ▼                      │
  ┌──────┐    ┌──────────┐    ┌────────────────┐
  │ open │◄──►│needs_    │───►│ accepted_risk  │
  └──┬───┘    │review    │    │ false_positive │
     │        └──────────┘    │ fixed          │
     │             ▲          └───────┬────────┘
     │             │                  │ (fixed only)
     ▼             │                  ▼
  ┌────────┐       │          ┌──────────────────┐
  │sandbox │───────┘          │needs_revalidation│
  └────────┘                  └──────────────────┘
  (LLM-only)                    → open / fixed / false_positive
```

---

## 8. 데이터 흐름

### 8.1 정적 분석 (Quick → Deep)

```
사용자 → [S1] 소스코드 업로드 (ZIP/Git) + "분석 실행"
         [S1] → POST /api/analysis/run → [S2]
                [S2] Quick: POST /v1/scan → [S4]
                      [S4] 빌드 + SAST 6도구 → SastFinding[]
                [S4] → Response → [S2]
                [S2] 정규화 + DB 저장
         [S2] → WS quick-complete → [S1] 즉시 표시

                [S2] Deep: POST /v1/tasks → [S3]
                      [S3] Phase 1: → [S4] SAST + [S5] KB + 코드그래프 + SCA
                      [S3] Phase 2: → [S7] → LLM Engine → 판정
                      [S3] claims[] → [S2]
                [S2] 정규화 + DB 저장
         [S2] → WS deep-complete → [S1] 보강 표시
```

### 8.2 동적 분석

```
ECU Simulator → [S6 Adapter] → WS → [S2]
                [S2] CAN 룰 엔진 실시간 평가
                [S2] → WS push → [S1] 실시간 모니터링 표시
                [S2] alert 누적 → LLM 분석
                [S2] → POST /v1/tasks → [S7] → LLM Engine
                [S2] → WS push → [S1] 알림 + 분석 결과 표시
```

### 8.3 동적 테스트

```
사용자 → [S1] 테스트 설정 + 실행 요청
         [S1] → POST /api/dynamic-test/run → [S2]
                [S2] 입력 생성 → [S6 Adapter] → ECU → 응답 수집
                [S2] findings → LLM 분석
                [S2] → POST /v1/tasks → [S7] → LLM Engine
                [S2] 결과 종합 + DB 저장
         [S2] → Response → [S1] 결과 시각화
```

### 8.4 헬스체크

```
[S1] → GET /health → [S2]
  [S2] → GET /v1/health → [S7] (LLM Gateway)
  [S2] → GET /v1/health → [S3] (Analysis Agent)
  [S2] → GET /v1/health → [S4] (SAST Runner)
  [S2] → 어댑터 연결 상태 확인
```

---

## 9. 개발 단계

### v0.0.0 — 프로토타입 (2026-03-12 완료)

- [x] 프로젝트 구조 및 빌드 환경 구성
- [x] 서비스 간 통신 검증
- [x] 공유 데이터 모델/DTO 확정 (`@aegis/shared`)
- [x] Frontend 기본 UI (대시보드, 사이드바, 각 모듈 화면)
- [x] Backend 정적/동적 분석 + 동적 테스트 API
- [x] Backend 코어 도메인 (Run, Finding 7-state, EvidenceRef, QG, Approval, Report)
- [x] LLM Gateway v0 (Mock) + v1 뼈대 (Task API, prompt/model registry)
- [x] Adapter + ECU Simulator (WS 중계, CAN 프레임)
- [x] MSA Observability (에러 클래스 계층, 구조화 로깅, Correlation ID)
- [x] 서비스 관리 스크립트 (start.sh/stop.sh)

### v0 → v1 전환기 (현재)

- [x] **7인 체제 재편** — S4(SAST Runner), S5(Knowledge Base), S6(Dynamic Analysis), S7(LLM Gateway+Engine) 신설
- [x] **DGX Spark LLM Engine** — Qwen3.5-122B-A10B-GPTQ-Int4 전환 완료 (S7 관리)
- [x] **S3 Agent 통합** — 311 tests pass, RE100 통합 테스트 완료 (49 SAST findings + 3 Agent claims)
- [x] **Quick→Deep 파이프라인** — AgentClient, SastClient, AnalysisOrchestrator, ProjectSourceService 구현
- [x] **소스코드 업로드** — ZIP/Git → `uploads/{projectId}/` 파일시스템 관리
- [x] **프론트엔드 개편** — 동적 분석 UI 숨김, 소스 업로드 UI, Quick→Deep 진행률
- [x] **BuildTarget + 서브 프로젝트 파이프라인** — 16-state FSM, 물리적 복사 격리, 빌드→스캔→코드그래프 순차 실행
- [x] **Build Agent 연동** — S3(Build Agent :8003) build-resolve 파이프라인 통합
- [x] **S1 요청 API 10건** — 벌크 상태, Finding 이력, 활동 타임라인, Approval 카운트, Finding 검색/정렬 확장
- [x] **코드 고도화** — AppError 타입화(KB/Pipeline), 쿼리 검증, silent catch 로깅
- [ ] **E2E 통합 테스트** — 전체 파이프라인 (업로드→Quick→Deep→Finding) 검증

### v1 — 완전 자동화

- [ ] QEMU user-mode 동적 분석 (ARM cross-compiled 바이너리)
- [ ] Transient 코드 제거 (LlmV1Adapter, LlmTaskClient — 동적분석이 아직 사용 중)
- [ ] 사용자 인증 (JWT)

### v2+ — 확장

- [ ] 실 ECU 데이터 기반 검증
- [ ] CI/CD 파이프라인 통합
- [ ] GDB 기반 동적 확인 (Phase 3)

---

## 10. 문서 소유권

| 카테고리 | 문서 | 소유자 |
|----------|------|--------|
| 전체 개요 | `specs/technical-overview.md` | **S2 주도** |
| 공통 제약 | `AEGIS.md` | **S2** |
| 서비스 명세 | `specs/frontend.md` | S1 |
| | `specs/backend.md` | S2 |
| | `specs/observability.md` | S2 (공통 규약) |
| | `specs/analysis-agent.md` | S3 |
| | `specs/sast-runner.md` | S4 |
| | `specs/knowledge-base.md` | S5 |
| | `specs/adapter.md`, `specs/ecu-simulator.md` | S6 |
| | `specs/llm-gateway.md`, `specs/llm-engine.md` | S7 |
| API 계약 | `api/shared-models.md` | **S2 단독** |
| | `api/analysis-agent-api.md` | S3 |
| | `api/sast-runner-api.md` | S4 |
| | `api/knowledge-base-api.md` | S5 |
| | `api/adapter-api.md` | S6 |
| | `api/llm-gateway-api.md` | S7 |
| | `api/llm-engine-api.md` | S7 |
| 인수인계서 | `{sN}-handoff/README.md` | 각 서비스 담당자 |

---

## 11. 관련 문서

- 서비스별 상세 명세
  - [S1. Frontend](frontend.md)
  - [S2. Backend](backend.md)
  - [S3. Analysis Agent](analysis-agent.md)
  - [S4. SAST Runner](sast-runner.md)
  - [S5. Knowledge Base](knowledge-base.md)
  - [S6. Adapter](adapter.md) / [ECU Simulator](ecu-simulator.md)
  - [S7. LLM Gateway](llm-gateway.md) / [LLM Engine](llm-engine.md)
  - [Observability 공통 규약](observability.md)
- API 계약서
  - [공유 모델](../api/shared-models.md)
  - [S2↔S3 Agent API](../api/analysis-agent-api.md)
  - [S2↔S4 SAST API](../api/sast-runner-api.md)
  - [S2↔S5 KB API](../api/knowledge-base-api.md)
  - [S2↔S6 Adapter API](../api/adapter-api.md)
  - [S3↔S7 LLM Gateway API](../api/llm-gateway-api.md)
  - [S7↔Engine API](../api/llm-engine-api.md)
- 인수인계서
  - [S1 Handoff](../s1-handoff/README.md)
  - [S2 Handoff](../s2-handoff/README.md)
  - [S3 Handoff](../s3-handoff/README.md)
  - [S4 Handoff](../s4-handoff/README.md)
  - [S5 Handoff](../s5-handoff/README.md)
  - [S6 Handoff](../s6-handoff/README.md)
  - [S7 Handoff](../s7-handoff/README.md)
