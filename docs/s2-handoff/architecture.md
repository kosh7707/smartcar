# S2 아키텍처 상세

> 구현 현황, DB 스키마, 핵심 로직, 의존성, 실행/운영 메모
> 진입점: `README.md` → 필요 시 이 문서 참조

---

## 3. 구현 현황

### 현재 활성 구조

S2의 실제 런타임 표면은 다음 3개 축이다.

1. **Backend API / Orchestration** — `services/backend/`
2. **Shared contracts** — `services/shared/`
3. **S2 소유 운영 스크립트** — `scripts/`

연동 판단은 항상 **다른 서비스 코드가 아니라** `docs/api/*.md` 계약서를 기준으로 한다.

### 파일 구조

```
services/backend/
├── package.json                  # Express 5 + better-sqlite3 + ws + pino
├── tsconfig.json
├── .env.example
└── src/
    ├── index.ts                  # 앱 진입점
    ├── config.ts                 # 환경변수 중앙화
    ├── db.ts                     # SQLite 초기화 + 21개 테이블 스키마
    ├── composition.ts            # DI/AppContext 구성
    ├── router-setup.ts           # 전 라우터 마운트
    ├── bootstrap.ts              # 기동 시 admin 시딩
    ├── controllers/              # 21개 라우터 엔트리
    │   ├── health.controller.ts
    │   ├── analysis.controller.ts
    │   ├── project.controller.ts
    │   ├── project-source.controller.ts
    │   ├── build-target.controller.ts
    │   ├── pipeline.controller.ts
    │   ├── target-library.controller.ts
    │   ├── sdk.controller.ts
    │   ├── dynamic-analysis.controller.ts
    │   ├── dynamic-test.controller.ts
    │   ├── finding.controller.ts
    │   ├── quality-gate.controller.ts
    │   ├── approval.controller.ts
    │   ├── report.controller.ts
    │   ├── notification.controller.ts
    │   ├── auth.controller.ts
    │   └── ...
    ├── services/                 # 31개 서비스/클라이언트
    │   ├── analysis-orchestrator.ts
    │   ├── pipeline-orchestrator.ts
    │   ├── project-source.service.ts
    │   ├── build-target.service.ts
    │   ├── sdk.service.ts
    │   ├── result-normalizer.ts
    │   ├── finding.service.ts
    │   ├── quality-gate.service.ts
    │   ├── approval.service.ts
    │   ├── report.service.ts
    │   ├── notification.service.ts
    │   ├── user.service.ts
    │   ├── activity.service.ts
    │   ├── agent-client.ts       # S3 Analysis Agent
    │   ├── build-agent-client.ts # S3 Build Agent
    │   ├── sast-client.ts        # S4 SAST Runner
    │   ├── kb-client.ts          # S5 Knowledge Base
    │   ├── llm-task-client.ts    # S7 Gateway
    │   ├── adapter-client.ts     # S6 Adapter WS
    │   ├── adapter-manager.ts
    │   ├── ws-broadcaster.ts
    │   └── ...
    ├── dao/                      # 21개 DAO
    │   ├── project.dao.ts
    │   ├── analysis-result.dao.ts
    │   ├── build-target.dao.ts
    │   ├── target-library.dao.ts
    │   ├── sdk-registry.dao.ts
    │   ├── notification.dao.ts
    │   ├── user.dao.ts
    │   └── ...
    ├── can-rules/                # 동적 분석 CAN 룰 엔진
    ├── middleware/               # request-id / logging / auth / error handling
    ├── lib/                      # logger / errors / vulnerability-utils / utils
    └── test, __tests__/          # 계약/통합/서비스 테스트

services/shared/src/
├── models.ts                     # 플랫폼 공용 모델
├── dto.ts                        # API/WS DTO
└── index.ts                      # barrel export

scripts/
├── start.sh                      # 전체 서비스 통합 기동 (S2 소유)
├── stop.sh                       # 전체 서비스 통합 종료 (S2 소유)
├── start-backend.sh              # backend 단독 기동
├── backend/
│   ├── reset-db.sh
│   ├── db-stats.sh
│   └── backup-db.sh
└── common/reset-logs.sh
```

### 내부 아키텍처

```
index.ts
  → config.ts
  → db.ts
  → createAppContext(config, db)
  → runStartupTasks(ctx)
  → createAuthMiddleware(...)
  → mountRouters(app, ctx)
  → attachWsServers(server, [...8 broadcasters...])

Controller → Service → DAO → SQLite
             ↘ External Clients (S3/S4/S5/S6/S7)
             ↘ WsBroadcaster<T>
             ↘ CanRuleEngine
```

핵심 wiring:

- `index.ts`: Express + middleware + DI + HTTP server + WS attach
- `composition.ts`: AppContext 생성
  - **DAO 21개**
  - **서비스 31개**
  - **WS broadcaster 8개**: `dynamic-analysis`, `static-analysis`, `dynamic-test`, `analysis`, `upload`, `pipeline`, `notification`, `sdk`
- `router-setup.ts`: 프로젝트/글로벌 라우터 일괄 마운트

### 외부 연동 클라이언트

S2는 아래 클라이언트만 통해 하위 서비스를 호출한다.

| 클라이언트 | 대상 | 계약 문서 |
|------------|------|-----------|
| `LlmTaskClient` | S7 Gateway | `docs/api/llm-gateway-api.md` |
| `AgentClient` | S3 Analysis Agent | `docs/api/analysis-agent-api.md` |
| `BuildAgentClient` | S3 Build Agent | `docs/api/build-agent-api.md` |
| `SastClient` | S4 SAST Runner | `docs/api/sast-runner-api.md` |
| `KbClient` | S5 Knowledge Base | `docs/api/knowledge-base-api.md` |
| `AdapterClient` / `AdapterManager` | S6 Adapter | `docs/api/adapter-api.md` |

### 코어 기능 묶음

#### 1) Quick→Deep 분석

- `analysis-orchestrator.ts`
- `analysis.controller.ts`
- `result-normalizer.ts`

흐름:

1. 소스/타겟 확인
2. S4 Quick scan
3. S3 deep-analyze
4. 결과 정규화 → Run/Finding/EvidenceRef/Gate
5. `/ws/analysis` 진행률 브로드캐스트

#### 2) 소스 업로드 / 빌드 타겟 / 서브프로젝트 파이프라인

- `project-source.service.ts`
- `build-target.service.ts`
- `pipeline-orchestrator.ts`
- `target-library.controller.ts`
- `sdk.service.ts`

흐름:

1. 소스 업로드/clone
2. 빌드 타겟 탐색/수정
3. Build Agent resolve
4. S4 build/scan
5. S5 code-graph ingest
6. 타겟 라이브러리 및 SDK 레지스트리 반영

#### 3) 동적 분석 / 동적 테스트

- `dynamic-analysis.service.ts`
- `dynamic-test.service.ts`
- `adapter-manager.ts`
- `can-rules/*`

동적 분석은 세션/메시지/알림 저장 + CAN 룰 평가 + 필요한 경우 S7 task 호출,
동적 테스트는 능동 주입과 결과 요약/정규화를 담당한다.

#### 4) 코어 도메인 / 워크플로우

- `finding.service.ts`
- `run.service.ts`
- `quality-gate.service.ts`
- `approval.service.ts`
- `report.service.ts`
- `activity.service.ts`
- `notification.service.ts`
- `user.service.ts`

현재 코어 도메인은 Run / Finding / EvidenceRef / Gate / Approval / Notification / User까지 확장된 상태다.

### 제거된 레거시 (현재 활성 구조 아님)

다음 항목은 더 이상 현재 구조 설명에 포함하지 않는다.

- 정적 룰 엔진 (`rules/`, `rule.dao.ts`, `rule.service.ts`, `project-rules.controller.ts`)
- `LlmV1Adapter`
- `MockEcu`
- 레거시 `static-analysis.service.ts` 기반 설명

역사적 배경은 `session-10.md` ~ `session-14.md`를 참고한다.

---

## 4. 데이터베이스

SQLite(`better-sqlite3`), WAL 모드. DB 파일 기본값은 `services/backend/aegis.db`.

### 현재 테이블 21개

| 테이블 | 용도 |
|--------|------|
| `projects` | 프로젝트 기본 정보 |
| `uploaded_files` | 업로드된 파일 메타/본문 |
| `analysis_results` | 분석 결과 원본/정규화 |
| `dynamic_analysis_sessions` | 동적 분석 세션 |
| `dynamic_analysis_alerts` | 동적 분석 알림 |
| `dynamic_analysis_messages` | CAN 메시지 로그 |
| `dynamic_test_results` | 동적 테스트 결과 |
| `adapters` | 프로젝트 어댑터 |
| `project_settings` | 프로젝트 설정 KV |
| `audit_log` | 감사 로그 |
| `runs` | Run 도메인 |
| `findings` | Finding 도메인 |
| `evidence_refs` | 증적 참조 |
| `gate_results` | Quality Gate 결과 |
| `approvals` | 승인 요청 |
| `build_targets` | 서브프로젝트/빌드 타겟 |
| `notifications` | 프로젝트 알림 |
| `users` | 사용자 |
| `sessions` | 로그인 세션 |
| `sdk_registry` | 등록 SDK |
| `target_libraries` | 타겟별 서드파티 라이브러리 |

### 마이그레이션 주의사항

- `db.ts`는 **CREATE TABLE → CREATE INDEX → ALTER TABLE(legacy compatibility)** 흐름이 섞여 있으므로 수정 시 순서를 신중히 볼 것.
- 인덱스가 의존하는 컬럼은 기존 DB 호환을 위해 반드시 적절한 컬럼 추가 이후 존재해야 한다.
- hot-reload 중 DB 파일 삭제는 금지. 서버 완전 종료 후 삭제/재생성.

---

## 5. 실행 / 운영 메모

> **서비스 기동 스크립트는 사용자 허락 없이 실행하지 않는다.**

### 현재 통합 기동 순서 (`scripts/start.sh`)

1. `llm-gateway`
2. `sast-runner`
3. `knowledge-base`
4. `build-agent`
5. `analysis-agent`
6. `adapter`
7. `backend`
8. `ecu-simulator` (옵션)
9. `frontend` (옵션)

`stop.sh`는 역순 종료 + 포트 잔류 정리를 수행한다.

### 주요 스크립트

| 파일 | 역할 |
|------|------|
| `scripts/start.sh` | 전체 기동 |
| `scripts/stop.sh` | 전체 종료 |
| `scripts/start-backend.sh` | backend 단독 watch 기동 |
| `scripts/backend/db-stats.sh` | DB 테이블 건수/크기 조회 |
| `scripts/backend/reset-db.sh` | DB 삭제 |
| `scripts/backend/backup-db.sh` | DB 백업 |
| `scripts/common/reset-logs.sh` | JSONL 로그 초기화 |

### 환경변수

핵심 backend 환경변수:

- `PORT`
- `LLM_GATEWAY_URL`
- `ANALYSIS_AGENT_URL`
- `SAST_RUNNER_URL`
- `KB_URL`
- `BUILD_AGENT_URL`
- `UPLOADS_DIR`
- `DB_PATH`
- `LOG_DIR`
- `LOG_LEVEL`

---

## 6. Observability

공통 규약은 `docs/specs/observability.md`가 기준이다.

S2 구현 포인트:

- `request-id.middleware.ts`: `X-Request-Id` 생성/전파
- `request-logger.middleware.ts`: 요청 시작/종료 구조화 로그
- `error-handler.middleware.ts`: Observability 규약 에러 응답 형식 적용
- `lib/logger.ts`: pino JSON logger
- `lib/errors.ts`: `AppError` 계층

로그는 기본적으로 프로젝트 루트 `logs/`의 JSONL 파일에 쌓인다.
