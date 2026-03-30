# S2. AEGIS Core (Backend) 인수인계서

> **반드시 `docs/AEGIS.md`를 먼저 읽을 것.** 프로젝트 공통 제약 사항, 역할 정의, 소유권이 그 문서에 있다.
> 이 문서는 S2(AEGIS Core/Backend) 개발을 이어받는 다음 세션을 위한 진입점이다.
> 상세 정보는 같은 디렉토리의 분할 문서를 참조한다.
> **마지막 업데이트: 2026-03-28**

---

## 문서 구조

| 문서 | 내용 |
|------|------|
| **이 파일 (README.md)** | 역할, 경계, 현재 상태, 관리 문서, 참조 |
| [architecture.md](architecture.md) | 구현 현황, DB 스키마, 핵심 로직, 의존성, 실행 방법, Observability |
| [api-endpoints.md](api-endpoints.md) | API 엔드포인트 전체 목록 (60개+ REST + 5 WS) |
| [roadmap.md](roadmap.md) | 다음 작업, 후순위, 인프라 계획 |
| session-{N}.md | 세션별 작업 로그 (session-1.md ~ session-12.md) |

---

## 1. 프로젝트 전체 그림

```
                     S1 (Frontend :5173)
                          │
                     S2 (AEGIS Core :3000)  ← 플랫폼 오케스트레이터
                    ╱     │     ╲      ╲
                 S3       S4     S5      S6
               Agent    SAST     KB    동적분석
              :8001    :9000   :8002    :4000
                │
           S7 Gateway (:8000)  ← LLM 단일 관문
                │
           LLM Engine (DGX Spark)
           Qwen3.5-122B-A10B-GPTQ-Int4
```

**S2가 전체 오케스트레이터.** S1에게 API를 제공하고, S3/S4/S5/S6/S7를 호출하는 중추.

### 보안 검증 구조

```
사용자: 소스코드 업로드 (ZIP/Git) → "분석 실행"
  → [Quick] S2 → S4 SAST Runner: 빌드 + 6도구 (~30초)
  → [Deep]  S2 → S3 Agent: SAST + 코드그래프 + SCA + KB + LLM (~3분)
```

---

## 2. 너의 역할과 경계

### 너는

- **AEGIS Core 개발자 + 플랫폼 오케스트레이터 + 인프라 스크립트 담당**
- `services/backend/` 하위 코드를 소유
- `services/shared/` 공유 타입 패키지를 **단독 소유**
- `scripts/start.sh`, `scripts/stop.sh` 통합 기동/종료 스크립트 소유
- S1에게 API를 제공하고, S3/S4/S5/S6를 호출하는 전체 오케스트레이터

### API 계약 소통 원칙 (필수)

- **다른 서비스의 코드를 절대 읽지 않는다** — API 계약서(`docs/api/`)로만 소통
- **S2는 `shared-models.md`의 단독 소유자** — 코드 변경 시 계약서 동기화 필수
- 공유 모델 변경 시 영향받는 서비스에 work-request로 고지

### 작업 요청

- **경로**: `docs/work-requests/`
- 세션 시작 시 이 폴더를 확인하여 밀린 요청이 있는지 체크

---

## 3. 현재 상태 (2026-03-28)

| 항목 | 값 |
|------|---|
| TypeScript 에러 | **0개** |
| 테스트 | **267개 통과** (vitest) |
| DB 테이블 | 18개 (SQLite, WAL) |
| API 엔드포인트 | 60개+ REST + 5 WebSocket |
| 에러 클래스 | 18개 (AppError 계층, 21개 에러코드) |
| 외부 클라이언트 | SastClient(S4), AgentClient(S3), BuildAgentClient(S3:8003), KbClient(S5), AdapterClient(S6), LlmTaskClient(S7) |

### Durable (투자, 유지)

| 영역 | 핵심 파일 |
|------|---------|
| Quick→Deep 오케스트레이션 | `analysis-orchestrator.ts`, `analysis.controller.ts` |
| 서브 프로젝트 파이프라인 | `pipeline-orchestrator.ts`, `pipeline.controller.ts` |
| 소스코드 업로드/관리 | `project-source.service.ts`, `project-source.controller.ts` |
| 빌드 타겟 관리 | `build-target.service.ts`, `build-target.controller.ts` |
| 코어 도메인 | Run, Finding(7-state), EvidenceRef, QG, Approval, Report |
| ResultNormalizer | `normalizeAnalysisResult()` + `normalizeAgentResult()` |

### 세션 13에서 제거 완료된 레거시

- `rules` DB 테이블 + `IRuleDAO` 인터페이스 + `Rule` 공유 타입 — 룰 엔진 완전 제거
- `LlmV1Adapter` (v0→v1 호환 레이어) — `LlmTaskClient`에 concurrency 통합, 서비스 직접 사용
- `MockEcu` — 인터페이스를 `adapter-client.ts`로 이동, 클래스 삭제

---

## 4. S2가 관리하는 문서

| 문서 | 경로 | 용도 |
|------|------|------|
| **공통 제약 사항** | `docs/AEGIS.md` | 프로젝트 전체 거버넌스. **S2가 관리** |
| 기능 명세서 | `docs/specs/backend.md` | S2의 모든 API + 아키텍처 상세 |
| 전체 기술 개요 | `docs/specs/technical-overview.md` | 전체 시스템 구조 (**S2 주도**) |
| Observability 규약 | `docs/specs/observability.md` | MSA 공통 규약 |
| 공유 모델 명세 | `docs/api/shared-models.md` | 전 서비스 공유 타입. **S2 단독 관리** |
| 서비스 관리 스크립트 | `scripts/start.sh`, `scripts/stop.sh` | 전체 서비스 기동/종료 |

**중요**: 구현을 바꾸면 `docs/specs/backend.md`와 `docs/api/shared-models.md`도 반드시 같이 업데이트할 것.

---

## 5. 참고할 문서들

| 문서 | 경로 | 왜 봐야 하는지 |
|------|------|--------------|
| 공통 제약 사항 | `docs/AEGIS.md` | **필독** — 역할, 소유권, 소통 규칙 전부 |
| S2 기능 명세 | `docs/specs/backend.md` | 네가 관리하는 계약서 |
| S3 Agent API | `docs/api/analysis-agent-api.md` | S2↔S3 deep-analyze 호출 스펙 |
| S7 API 명세 | `docs/api/llm-gateway-api.md` | S2↔S7, S3↔S7 호출 스펙 |
| SAST Runner API | `docs/api/sast-runner-api.md` | S2↔S4 직접 호출 스펙 |
| KB API | `docs/api/knowledge-base-api.md` | S5 호출 스펙 |
| 공유 모델 | `docs/api/shared-models.md` | 전 서비스 공유 타입 |
