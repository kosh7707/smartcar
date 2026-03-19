# 기술 명세 - 전체 개요

> 이 문서는 시스템 전체 구조, 서비스 구성, 통신 방식, 데이터 흐름을 정의한다.
> 서비스별 상세 명세는 개별 문서로 분리한다.

---

## 1. 시스템 목적

소스코드 및 바이너리를 대상으로 정적 분석, 동적 분석, 동적 테스트를 수행하고,
LLM 기반 분석을 통해 취약점 탐지 및 수정 가이드를 제공하는 보안 검증 프레임워크.

---

## 2. 아키텍처 개요

MSA(Microservice Architecture) 기반 4개 독립 서비스 구성.

### 2.1 설계 패턴

이 프로젝트는 다음 패턴을 전반에 걸쳐 따른다.

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
| Model | 도메인 핵심 데이터 구조 | `@aegis/shared` | `Vulnerability`, `Project` |
| DTO | 서비스 간 통신용 전송 객체 | `@aegis/shared` | `AnalysisRequest`, `LlmResponse` |
| DAO | DB 접근 및 영속화 담당 | Core Service 내부 | `ProjectDAO`, `AnalysisResultDAO` |

- **Model**: 비즈니스 로직에서 사용하는 순수 데이터 구조. DB 스키마나 API 형식에 의존하지 않는다.
- **DTO**: 서비스 경계를 넘는 데이터 전송에만 사용. Model과 형태가 비슷해도 별도로 정의한다.
- **DAO**: DB에 대한 CRUD를 캡슐화. Service 계층에서만 호출하며, View/ViewModel은 DAO를 직접 사용하지 않는다.

```
[View] → [ViewModel] → [Service] → [DAO] → [DB]
  │           │              │
  │           │              └── Model 사용
  │           └── DTO ↔ Model 변환
  └── ViewModel이 제공하는 데이터만 표시
```

```
사용자 (보안 검증 담당자)
        │
        ▼
┌──────────────────┐
│ UI Service       │  사용자 인터페이스
│ (Electron/React) │  Port: 별도 (데스크탑 앱)
└───────┬──────────┘
        │ HTTP (REST) + WebSocket
        ▼
┌──────────────────────────────────────┐
│ Core Service (Express.js) Port:3000 │
│  ┌────────┐ ┌──────┐ ┌───────────┐ │
│  │  Core  │ │Static│ │  Dynamic  │ │
│  │Domain  │ │Analy.│ │Analy/Test │ │
│  └────────┘ └──────┘ └───────────┘ │
└───────┬──────────────────────────────┘
        │ HTTP (REST)
        ▼
┌──────────────────┐
│ LLM Gateway      │  LLM 연동 중개
│ (FastAPI)        │  Port: 8000
└───────┬──────────┘
        │ HTTP (OpenAI-compatible)
        ▼
┌──────────────────┐
│ LLM Engine       │  LLM 추론
│ (Qwen3.5 35B/vLLM)│  Port: 8000
└──────────────────┘
```

---

## 3. 서비스 목록

| ID | 서비스명 | 기술 스택 | 역할 | 포트 |
|----|---------|----------|------|------|
| S1 | UI Service | Electron + React + TypeScript | 사용자 인터페이스, 결과 시각화 | 데스크탑 앱 |
| S2 | Core Service | Express.js + TypeScript | 도메인 관리, 정책, DB | 3000 |
| S2-SA | Static Analysis | (S2 내부 모듈, 향후 분리 예정) | 정적 분석 워크로드 | — |
| S2-DA | Dynamic Analysis | (S2 내부 모듈, 향후 분리 예정) | 동적 분석/테스트 워크로드 | — |
| S3 | LLM Gateway | Python + FastAPI | LLM 호출 추상화, 프롬프트 관리 | 8000 |
| S4 | LLM Engine | Qwen3.5-35B-A3B FP8 on DGX Spark (vLLM) | LLM 추론 | 8000 |

### S1. UI Service

- 프로젝트 생성/조회/수정/삭제
- 정적 분석: 소스코드 업로드, 분석 요청, 결과 조회
- 동적 분석: CAN 트래픽 실시간 모니터링 대시보드, 이상 탐지 알림 표시
- 동적 테스트: 퍼징/침투 테스트 대상 설정, 실행 요청, 결과 조회
- 취약점 상세 조회 (심각도, 설명, 코드 위치, 수정 가이드)
- 분석 결과 보고서 생성 (PDF/HTML 내보내기)
- 전체 현황 대시보드 (취약점 통계, 심각도 분포 차트, 분석 이력)
- LLM 연결 상태 확인 및 설정

### S2. Core Service (3-도메인 구조)

현재는 단일 Express.js 프로세스이나, 내부적으로 3개 도메인으로 구분된다. DB가 PostgreSQL로 전환되는 시점에 물리적 분리 예정.

**Core (도메인 관리)**
- 프로젝트 CRUD 및 DB 관리
- Finding/Run/EvidenceRef 코어 도메인 + 상태 머신
- Quality Gate 정책 엔진 + Approval 워크플로우
- AuditLog 감사 추적
- 보고서 데이터 생성

```
┌─ Project ─────────────────────────────────────────────┐
│                                                       │
│  ┌─ Run ────────────────────────────────────────┐     │
│  │ analysisResultId, module, status              │     │
│  │                                               │     │
│  │  ┌─ Finding ──────────────────────────┐       │     │
│  │  │ severity, status (7-state FSM)     │       │     │
│  │  │ confidence, sourceType             │       │     │
│  │  │                                    │       │     │
│  │  │  ├── EvidenceRef (artifact 연결)   │       │     │
│  │  │  └── AuditLog (상태 변경 이력)     │       │     │
│  │  └────────────────────────────────────┘       │     │
│  │                                               │     │
│  │  ┌─ GateResult ───────────────────────┐       │     │
│  │  │ status: pass / fail / warning      │       │     │
│  │  │ rules[] (정책 규칙 평가 결과)      │       │     │
│  │  │ override? ──→ Approval 필요        │       │     │
│  │  └────────────────────────────────────┘       │     │
│  └───────────────────────────────────────────────┘     │
│                                                       │
│  ┌─ Approval ────────────────────────────────────┐    │
│  │ actionType: gate.override | finding.accepted  │    │
│  │ status: pending → approved / rejected / expired│    │
│  │ decision → AuditLog 기록                       │    │
│  └────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────┘
```

```
Finding 상태 머신 (7-state)

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

**Static Analysis (정적 분석 워크로드)**
- 룰 기반 패턴 매칭 엔진 (L1~L4)
- 소스코드 파일 업로드/관리
- LLM 분석 요청 (S3 호출)
- 1계층 + 2계층 결과 병합, 정렬

**Dynamic (동적 분석/테스트 워크로드)**
- CAN 데이터 수신 (WebSocket), 룰 기반 실시간 탐지, 로그 버퍼링
- 퍼징 입력 생성, ECU 전송, 응답 수집
- Adapter/ECU Simulator 통신
- LLM 분석 요청 (S3 호출)

### S3. LLM Gateway

- S2로부터 분석 요청 수신
- 모듈별 프롬프트 템플릿 관리 (정적 분석용, 동적 분석용, 동적 테스트용)
- 요청 컨텍스트 구성 (1계층 결과 + 원본 데이터를 프롬프트로 조립)
- S4(LLM Engine)에 추론 요청 전달
- LLM 응답 파싱 및 정규화 (구조화된 JSON으로 변환)
- LLM 모델 선택/전환 (향후 다중 모델 지원 대비)
- 요청/응답 로깅 (프롬프트 이력 관리)

### S4. LLM Engine

- OpenAI-compatible API 형식으로 추론 요청 수신
- 소스코드 취약점 분석 및 수정 가이드 생성
- CAN 트래픽 이상 패턴 해석 및 공격 유형 분류
- 퍼징/침투 테스트 결과 해석 및 추가 공격 벡터 제안
- v0: S3(LLM Gateway)가 맥락 기반 Mock 응답 반환 (ruleResults 심층 분석, CAN 로그 파싱, 테스트 분류) ✅
- v1: DGX Spark + vLLM + Qwen3.5-35B-A3B FP8 실 LLM 연동 ✅ (S4 입주 완료, S3 real 모드 운영 중)

---

## 4. 서비스 간 통신

### 4.1 통신 방식

| From | To | 프로토콜 | 용도 | 비고 |
|------|----|---------|------|------|
| S1 → S2 | HTTP REST | 분석 요청/응답, CRUD | 추후 JWT 인증 |
| S1 ↔ S2 | WebSocket | 동적 분석 실시간 스트리밍 | 양방향 통신 |
| S2 → S3 | HTTP REST | LLM 분석 요청 | 내부 통신 (API Key) |
| S3 → S4 | HTTP (OpenAI-compatible) | LLM 추론 호출 | `/v1/chat/completions` 형식 |

### 4.2 통신 방향 원칙

- **단방향 의존**: S1 → S2 → S3 → S4 순서로만 호출한다.
- **역방향 호출 금지**: S3가 S2를 호출하거나, S4가 S3를 호출하지 않는다.
- **S1은 S2만 알고 있다**: UI는 Core Service의 엔드포인트만 호출하며, LLM Gateway의 존재를 모른다.
- **예외 - WebSocket**: 동적 분석에서 S2가 S1에게 실시간 데이터를 push할 수 있다 (구독 모델).

---

## 5. 검증 모듈

Core Service(S2) 내부에서 3개의 검증 모듈을 관리한다.
각 모듈은 **2계층 분석 구조**(룰 기반 + LLM)를 공통 패턴으로 따른다.

### 5.1 2계층 분석 구조 (공통 패턴)

```
[1계층] 룰 기반 분석 (빠르고 확정적)
  - 패턴 매칭, 시그니처, 임계치 판단
  - 밀리초 단위, 오탐 최소화

[2계층] LLM 심층 분석 (느리지만 지능적)
  - 1계층 결과 + 원본 데이터를 LLM에 전달
  - 복합 취약점 탐지, 맥락 해석, 수정 가이드 생성
  - 수 초 단위
```

### 5.2 모듈 목록

| 모듈 | 성격 | 하는 일 |
|------|------|--------|
| 정적 분석 | 코드를 실행하지 않고 분석 | 소스코드 패턴 매칭 + LLM 코드 리뷰 |
| 동적 분석 | 실행 중 관찰 (수동적) | CAN 트래픽 스트리밍 모니터링, 이상 징후 탐지 |
| 동적 테스트 | 실행 중 개입 (능동적) | ECU 대상 퍼징/침투 테스트 |

### 5.3 모듈별 상세

#### 정적 분석

```
소스코드 업로드
    → [1계층] 패턴 매칭 (룰 엔진)
      룰 인터페이스 추상화 (추가/제거 용이)
      L1: 함수명 매칭 (gets, scanf, strcpy)
      L2: 정규식 패턴
      L3: 호출 흐름 패턴 (향후)
      L4: 복합 조건 (향후, AST 기반)
    → [2계층] LLM 분석
      패턴 매칭 결과 + 원본 코드 전달
      복합 취약점 탐지, 수정 코드 제안
    → 결과 종합 (출처: 룰/LLM 구분 표시)
    → 보고서 반환
```

- v0: 인터페이스 구현 + L1~L2 최소 룰 + LLM mock
- 향후: L3~L4 룰 확장 + 실제 LLM 연동

#### 동적 분석

```
CAN 트래픽 스트리밍 수신 (WebSocket)
    → 버퍼 축적 (N개 메시지 or T초 단위)
    → [1계층] 룰 기반 실시간 탐지
      메시지 빈도, ID 분포, 페이로드 이상
      알려진 공격 시그니처 매칭
    → [2계층] 임계치 도달 시 LLM 심층 분석
      축적된 로그 + 탐지 결과를 LLM에 전달
      공격 유형 분류, 위험도 판단, 대응 가이드
    → 대시보드 실시간 표시 + 알림
```

- v0: WebSocket 인터페이스 + Mock 데이터 생성기 + 룰 인터페이스 + LLM mock
- 향후: 실 CAN 데이터 연동

#### 동적 테스트

```
ECU 대상 퍼징/침투 테스트
    → 테스트 대상 설정 (ECU, 프로토콜, 포트)
    → 입력 생성 (랜덤 / 시나리오 기반)
    → ECU에 전송
    → 응답 관찰 (크래시, 비정상 응답, 무응답)
    → [2계층] LLM이 결과 해석 + 추가 공격 벡터 제안
    → 결과 보고서
```

- v0: 인터페이스 + Mock ECU 응답
- 향후: 실 ECU 연동 (HIL 환경)

---

## 6. 공유 데이터 구조

UI Service(S1)와 Core Service(S2)는 TypeScript monorepo의 `@aegis/shared` 패키지를 통해
DTO, Model, 인터페이스 타입을 공유한다.

### 6.1 핵심 모델

```
Project                    분석 대상 프로젝트 (최상위 단위)
  - id                     고유 식별자
  - name                   프로젝트명
  - description            설명
  - createdAt              생성 시각
  - updatedAt              수정 시각

Vulnerability              취약점 하나를 표현
  - id                     고유 식별자
  - severity               심각도 (critical / high / medium / low / info)
  - title                  취약점 제목
  - description            설명
  - location               발생 위치 (파일:라인)
  - source                 탐지 출처 (rule / llm)

AnalysisResult             하나의 분석 수행 결과
  - id                     고유 식별자
  - projectId              소속 프로젝트 ID
  - module                 수행 모듈 (static_analysis / dynamic_analysis / dynamic_testing)
  - status                 상태 (pending / running / completed / failed)
  - vulnerabilities        발견된 취약점 목록
  - createdAt              생성 시각
```

> 모든 분석 결과(AnalysisResult, DynamicAnalysisSession, DynamicTestResult)는
> `projectId`를 통해 프로젝트에 종속된다.

### 6.2 핵심 DTO

```
ProjectCreateRequest       프로젝트 생성 (S1 → S2)
  - name                   프로젝트명
  - description            설명 (optional)

ProjectOverviewResponse    프로젝트 Overview (S2 → S1)
  - project                프로젝트 정보
  - summary                취약점 요약 (총 건수, 심각도별, 모듈별)
  - recentAnalyses         최근 분석 이력

StaticAnalysisRequest      정적 분석 요청 (S1 → S2)
  - projectId              대상 프로젝트
  - files                  분석 대상 파일 목록
  - options                추가 옵션

StaticAnalysisResponse     분석 응답 (S2 → S1)
  - success                성공 여부
  - data                   AnalysisResult (성공 시)
  - error                  에러 메시지 (실패 시)

AnalyzeRequest             LLM 분석 요청 (S2 → S3)
  - module                 분석 모듈 (static_analysis / dynamic_analysis / dynamic_testing)
  - sourceCode             소스코드 원문 (정적 분석 시)
  - canLog                 CAN 로그 데이터 (동적 분석 시)
  - testResults            테스트 결과 데이터 (동적 테스트 시)
  - ruleResults            1계층 룰 탐지 결과 (RuleResult[])
  - maxTokens              최대 토큰 수 (기본: 2048)
  - temperature            온도 (기본: 0.7)

AnalyzeResponse            LLM 분석 응답 (S3 → S2)
  - success                성공 여부
  - vulnerabilities        탐지된 취약점 목록 (VulnerabilityItem[])
  - error                  에러 메시지 (실패 시, null)

HealthResponse             헬스체크 응답 (공통)
  - service                서비스명
  - status                 상태 (ok / error)
  - version                버전
```

---

## 7. 화면 구성

### 7.1 화면 목록

프로젝트 중심 네비게이션 구조. 프로젝트를 선택한 후 각 분석 모듈에 진입한다.

| # | 화면 | 설명 |
|---|------|------|
| P1 | 프로젝트 목록 | 프로젝트 생성/조회, 취약점 수 요약, 프로젝트 진입점 |
| P2 | 프로젝트 Overview | 선택된 프로젝트의 분석 결과 종합 (심각도 분포, 모듈별 현황, 최근 이력) |
| P3 | 정적 분석 | 소스코드 업로드, 취약점 목록, 코드 뷰어 하이라이팅 |
| P4 | 동적 분석 | CAN 트래픽 실시간 모니터, 이상 탐지 알림 |
| P5 | 동적 테스트 | 퍼징/침투 대상 설정, 실행, 결과 |
| P6 | 취약점 상세 | 심각도, 설명, 코드 위치, LLM 분석 결과, 수정 코드 제안 |
| P7 | 리포트 | 분석 결과 보고서 PDF/HTML 내보내기 |
| P8 | 설정 | LLM 연결 설정, 룰 관리 |

### 7.2 공통 UI 컴포넌트

```
심각도 배지:    [Critical] [High] [Medium] [Low] [Info]
취약점 카드:    심각도 + 제목 + 위치 + 모듈 + 시각
코드 뷰어:     소스코드 + 취약점 위치 하이라이팅
통계 카드:     숫자 + 라벨 (취약점 수, 분석 횟수 등)
필터 바:       심각도, 모듈, 상태별 필터링
```

---

## 8. 데이터 흐름

### 8.1 정적 분석 흐름

```
사용자 → [S1] 소스코드 업로드 + 분석 요청
         [S1] → POST /api/analysis → [S2]
                [S2] 1계층: 패턴 매칭 (룰 엔진)
                [S2] 2계층: LLM 분석 요청
                [S2] → POST /v1/tasks → [S3]
                       [S3] 프롬프트 구성 → [S4] LLM 호출
                       [S4] 응답 생성 → [S3]
                [S3] → TaskResponse → [S2]
                [S2] 결과 종합 (룰 + LLM 결과 병합) + 저장
         [S2] → AnalysisResponse → [S1]
         [S1] 결과 시각화 + 리포트
```

### 8.2 동적 분석 흐름

```
CAN 데이터 소스 → [S2] WebSocket 수신
                  [S2] 1계층: 룰 기반 실시간 탐지
                  [S2] → WebSocket push → [S1] 실시간 모니터링 표시
                  [S2] 버퍼 축적 → 임계치 도달
                  [S2] 2계층: LLM 분석 요청
                  [S2] → POST /v1/tasks → [S3] → [S4]
                  [S2] → WebSocket push → [S1] 알림 + 분석 결과 표시
```

### 8.3 동적 테스트 흐름

```
사용자 → [S1] 테스트 대상 설정 + 실행 요청
         [S1] → POST /api/dynamic-test → [S2]
                [S2] 입력 생성 → ECU 전송 → 응답 수집
                [S2] → POST /v1/tasks → [S3] → [S4]
                [S2] 결과 종합
         [S2] → TestResponse → [S1]
         [S1] 결과 시각화 + 리포트
```

### 8.4 헬스체크 흐름

```
[S1] → GET /health → [S2] → 200 OK
[S2] → GET /v1/health → [S3] → 200 OK
```

---

## 9. 개발 단계

### v0.0.0 — 프로토타입 (2026-03-12 완료)

- [x] 프로젝트 구조 및 빌드 환경 구성
- [x] 서비스 간 통신 검증
- [x] 공유 데이터 모델/DTO 확정 (`@aegis/shared`)
- [x] Frontend 기본 UI (대시보드, 사이드바, 각 모듈 화면, 테마, 에러 핸들링)
- [x] Backend 정적 분석 API (업로드, 청크 분할, 룰+LLM 2계층, 결과 조회/삭제/보고서)
- [x] Backend 동적 분석 API (세션 관리, CAN 모니터링, 룰+LLM 2계층, CAN 주입, 시나리오)
- [x] Backend 동적 테스트 API (퍼징/침투, 3전략 입력 생성, 어댑터 통신, LLM 분석)
- [x] Backend 프로젝트 CRUD + Overview + 파일/룰/어댑터/설정 관리
- [x] Backend SQLite DB (14개 테이블)
- [x] Backend 코어 도메인 (Run, Finding 7-state, EvidenceRef, AuditLog, ResultNormalizer)
- [x] LLM Gateway v0 (Mock LLM + 모듈별 프롬프트 + 에러 분류 + 구조화 로깅)
- [x] LLM Gateway v1 뼈대 (Task API, prompt/model registry, schema/evidence validation, confidence)
- [x] Adapter + ECU Simulator (WS 중계, CAN 프레임, 주입 요청-응답)
- [x] MSA Observability (에러 클래스 계층, 구조화 로깅, Correlation ID, JSONL 파일 저장)
- [x] 서비스 관리 스크립트 (start.sh/stop.sh, DB 유틸)

### v0 → v1 전환기 (현재)

- [x] S4 문서 준비 (기능 명세, API 계약서, 인수인계서) — S3가 초안 작성
- [x] **S4(DGX Spark) 입주** — vLLM + Qwen3.5-35B-A3B FP8 서빙 완료
- [x] S3 `mock` → `real` 전환 완료 (ollama 경유 후 vLLM 직접 연동)
- [ ] S2 Quality Gate + Approval (3단계)
- [ ] S1 코어 도메인 UI (Finding triage, Run 상세, Evidence 탐색)

### v1 — LLM 실 연동

- [ ] LLM 실 연동 안정화 (프롬프트 튜닝, 성능 최적화)
- [ ] Agentic SAST (Tool calling, Prepared Guided Agent)
- [ ] 패턴 매칭 룰 확장 (L3~L4)
- [ ] 사용자 인증 (JWT)

### v2+ — 확장

- [ ] 실 ECU 데이터 기반 검증
- [ ] SIEM 통합
- [ ] CI/CD 파이프라인 통합

---

## 10. 문서 소유권

| 카테고리 | 문서 | 소유자 |
|----------|------|--------|
| 전체 개요 | `specs/technical-overview.md` | **S2 주도** |
| 서비스 명세 | `specs/frontend.md` | S1 |
| | `specs/backend.md`, `specs/adapter.md`, `specs/ecu-simulator.md` | S2 |
| | `specs/observability.md` | S2 |
| | `specs/llm-gateway.md` | S3 |
| | `specs/llm-engine.md` | **S4** |
| API 계약 | `api/shared-models.md` | **S2 단독** |
| | `api/llm-gateway-api.md` | S3 |
| | `api/llm-engine-api.md` | **S4** (S4 입주 후 소유권 이전 완료) |
| 인수인계서 | `{sN}-handoff/README.md` | 각 서비스 담당자 |
| 외부 피드백 | `외부피드백/` | 소유자 없음 (읽기 전용 참고) |

---

## 11. 관련 문서

- 서비스별 상세 명세
  - [S1. Frontend](frontend.md)
  - [S2. Backend](backend.md)
  - [S2. Adapter](adapter.md)
  - [S2. ECU Simulator](ecu-simulator.md)
  - [S3. LLM Gateway](llm-gateway.md)
  - [S4. LLM Engine](llm-engine.md)
- 인수인계서
  - [S1 Handoff](../s1-handoff/README.md)
  - [S2 Handoff](../s2-handoff/README.md)
  - [S3 Handoff](../s3-handoff/README.md)
  - [S4 Handoff](../s4-handoff/README.md)
- API 계약서
  - [S1↔S2 공유 모델](../api/shared-models.md)
  - [S2↔S3 API](../api/llm-gateway-api.md)
  - [S3↔S4 API](../api/llm-engine-api.md)
