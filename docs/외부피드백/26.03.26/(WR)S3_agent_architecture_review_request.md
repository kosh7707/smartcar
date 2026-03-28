# S3 에이전트 아키텍처 리뷰 요청

> **작성일**: 2026-03-26
> **작성자**: S3 (Analysis Agent + Build Agent)
> **대상 독자**: 외부 리뷰어 (에이전트 시스템, LLM 기반 자동화, 보안 분석 도메인 전문가)
> **핵심 질문**: (1) 에이전트, 이 상태로 괜찮은가? (2) 어떻게 하면 더 나은 에이전트가 될 수 있는가?

---

## 1. Executive Summary

S3는 AEGIS 플랫폼에서 **보안 분석 자율 에이전트**와 **빌드 자동화 에이전트**를 담당한다.

- **Analysis Agent** (:8001) — 자동차 임베디드 C/C++ 소스를 SAST + LLM으로 심층 분석
- **Build Agent** (:8003) — SDK 기반 크로스컴파일 빌드 스크립트를 LLM이 작성 + 실행 + 실패 복구
- **agent-shared** — 두 에이전트의 공통 프레임워크 (LLM 통신, 도구 실행, 스키마, 정책)

### 핵심 설계 원칙

1. **결정론적 처리를 최대화하고, LLM의 결정 표면을 최소화한다**
2. **Evidence-first** — 모든 분석 결과는 증적에 근거
3. **Phase 분리** — 결정론적 Phase(0/1)가 먼저, LLM Phase(2/loop)가 나중
4. **예산 기반 종료** — 토큰, 턴, 시간, 증거 부재 등 5가지 종료 조건

### 최근 주요 변경 (2026-03-26, 이번 세션)

| 변경 | 영향 |
|------|------|
| TurnSummarizer 활성화 + tool_call/tool 쌍 보존 | 컨텍스트 무제한 증가 버그 해결 |
| read_file 50KB → 8KB + 절삭 공지 | 턴당 토큰 증가율 ~6x 감소 |
| `list_files` 도구 신설 | 140회 read_file → 1회 tree로 프로젝트 구조 파악 |
| Phase 0 결정론적 사전 분석 | LLM 전에 빌드 시스템/SDK/언어 자동 탐지 |
| BuildErrorClassifier | 빌드 실패 시 구조화된 에러 분류 + 복구 제안 |

---

## 2. 아키텍처 개요

### 2.1 Analysis Agent — Phase 1/2 분리

```
POST /v1/tasks (taskType: "deep-analyze")
  │
  ├── Phase 1: 결정론적 (LLM 없이)
  │   ├── sast.scan        → S4 SAST Runner → findings
  │   ├── code.functions   → S4 → 함수 + 호출 관계
  │   ├── sca.libraries    → S4 → 라이브러리 + 버전
  │   ├── cve.batch-lookup → S5 KB → 버전 매칭된 CVE
  │   ├── threat.search    → S5 KB → CWE별 위협 지식
  │   └── dangerous-callers → S5 KB → 위험 함수 호출자
  │
  ├── Phase 2: LLM 해석 (멀티턴 에이전트 루프)
  │   ├── Phase 1 결과를 프롬프트에 주입
  │   ├── LLM이 추가 tool 호출 가능: knowledge.search, code_graph.callers
  │   ├── S7 Gateway 경유 (POST /v1/chat)
  │   └── 구조화 JSON 출력 (claims + evidence refs)
  │
  └── 응답: TaskSuccessResponse (증거 검증 + 신뢰도 계산)
```

### 2.2 Build Agent — Phase 0 + 에이전트 루프

```
POST /v1/tasks (taskType: "build-resolve")
  │
  ├── Phase 0: 결정론적 사전 분석 (LLM 없이)
  │   ├── 빌드 시스템 탐지 (cmake/make/autotools/shell/unknown)
  │   ├── 빌드 파일 탐색 (글로브 + 노이즈 필터)
  │   ├── 프로젝트 트리 생성
  │   ├── SDK registry 조회 (S4)
  │   ├── 언어 탐지 + 기존 빌드 스크립트 탐지
  │   └── 결과를 시스템 프롬프트에 "사전 분석 결과" 섹션으로 주입
  │
  ├── 에이전트 루프: LLM + 도구
  │   ├── list_files → 프로젝트 구조 파악 (1회)
  │   ├── read_file → 핵심 빌드 파일 읽기 (1-2회)
  │   ├── write_file → build-aegis/aegis-build.sh 작성
  │   ├── try_build → S4에 빌드 실행 위임
  │   │   └── 실패 시 BuildErrorClassifier가 에러 분류 + 복구 제안 첨부
  │   ├── edit_file → 스크립트 수정 후 재시도
  │   └── 빌드 성공 또는 3회 연속 실패 → 보고서 강제
  │
  └── 응답: TaskSuccessResponse (buildResult + buildScript)
```

### 2.3 agent-shared 공통 프레임워크

```
agent-shared/
├── llm/caller.py           # S7 Gateway HTTP + adaptive timeout + exchange 로그
├── llm/message_manager.py  # 멀티턴 messages 배열 + compact()
├── llm/turn_summarizer.py  # tool_call/tool 쌍 보존 컨텍스트 압축
├── schemas/agent.py        # 17개 DTO: ToolCallRequest, LlmResponse, BudgetState 등
├── tools/base.py           # ToolImplementation Protocol
├── tools/executor.py       # 도구 실행 + async timeout
├── tools/registry.py       # 도구 스키마 등록 + OpenAI tools 포맷 변환
├── policy/retry.py         # RetryPolicy (503 circuit breaker 30s, 기타 exponential backoff)
├── errors.py               # S3Error 계층 (retryable 메타데이터)
├── context.py              # RequestId ContextVar
└── observability.py        # 구조화 JSON 로깅 + agent_log()
```

---

## 3. 핵심 설계 결정 + 트레이드오프

| 결정 | 근거 | 트레이드오프 / 한계 |
|------|------|---------------------|
| **Phase 분리 (결정론 → LLM)** | LLM이 "도구 안 쓸래"라고 판단하는 문제 방지. 모든 증거가 LLM 이전에 수집됨 | Phase 1 실행 시간이 고정 비용으로 발생. 불필요한 도구 호출 가능 |
| **3-tier 도구 예산 (cheap/medium/expensive)** | LLM의 무한 도구 호출 방지. 비싼 도구(SAST, try_build)는 제한적 | 예산이 타이트하면 LLM이 충분한 정보 수집 전에 종료될 수 있음 |
| **컨텍스트 압축 (16K 토큰 임계치)** | 40K 토큰 프롬프트 → 103초 레이턴시 사고 대응 | 오래된 턴 정보 손실. 현재는 단순 truncation (LLM 요약 아님) |
| **read_file 8KB 제한** | 컨텍스트 폭발 방지 | 대형 파일의 후반부를 볼 수 없음 |
| **Phase 0 결정론적 사전 분석** | LLM이 빌드 시스템 탐지에 3-5턴 소비하던 것을 0턴으로 | 파일 이름 기반 휴리스틱이라 비표준 프로젝트에서 실패 가능 |
| **빌드 에러 분류기 (regex)** | LLM에게 raw 컴파일러 출력 대신 구조화된 분류 제공 | 패턴 목록이 제한적. 새로운 에러 유형 추가 필요 |
| **force_report (빌드 성공/3회 실패)** | LLM이 성공 후에도 도구를 호출하는 문제 방지 | 3회 미만 실패에서 조기 포기 가능성 있음 |
| **duplicate call 차단 (args_hash)** | LLM이 같은 도구를 동일 인자로 반복 호출하는 루프 방지 | 의도적 재시도 (예: 서비스 일시 장애 후 재시도)도 차단됨 |
| **S7 Gateway 경유 LLM 호출** | 단일 관문으로 모델 교체/모니터링 용이 | 네트워크 홉 추가. Gateway 장애 시 전체 에이전트 작동 불가 |

---

## 4. 현재 상태 메트릭

### 테스트

| 서비스 | 테스트 수 | 커버리지 영역 |
|--------|----------|--------------|
| Analysis Agent | 134 | 에이전트 루프, Phase 1, 예산, 정책, 도구, 스키마, LLM caller |
| Build Agent | 185 | 도구 안전성, 정책, 예산, Phase 0, 에러 분류기, golden test |
| **합계** | **319** | |

### 최근 통합 테스트 결과 (log-analyzer 기준)

| 요청 | 소요 | 턴 | 최대 프롬프트 | 결과 |
|------|------|-----|-------------|------|
| `integ-*-build` | 3분 25초 | 6턴 | 24,494 토큰 | 빌드 성공 (exit=0) |
| `integ-*-analyze` | 1분 47초 | — | — | Phase 1 완료 (대부분 S4 SAST 시간) |

### 토큰 사용량 (24시간)

| 서비스 | Prompt 토큰 | Completion 토큰 | 비율 |
|--------|-----------|----------------|------|
| s3-build | 545,983 | 9,096 | 60:1 |

---

## 5. 알려진 한계 + 미해결 질문

### 5.1 현재 한계

1. **TurnSummarizer가 단순 truncation**: system + 마지막 N개 메시지 유지. LLM 기반 요약이 아니므로 중간 턴의 핵심 정보가 손실될 수 있음
2. **read_file 8KB로 대형 파일 후반부 접근 불가**: 빌드 에이전트가 큰 CMakeLists.txt의 후반부 설정을 못 볼 수 있음
3. **빌드 에러 분류기 패턴 제한**: 현재 9개 카테고리. 새로운 에러 유형은 수동 추가 필요
4. **Phase 0가 파일명 기반 휴리스틱**: 비표준 빌드 시스템(Bazel, Meson, Waf 등)은 "unknown"으로 분류
5. **에이전트 메모리 (프로젝트별 장기 기억)**: API는 존재하나 활용이 제한적
6. **동시 요청 처리 미검증**: 단일 요청 기준 설계. 동시 요청 시 리소스 경합 가능

### 5.2 아키텍처 수준 질문

1. **Build Agent는 LLM 에이전트여야 하는가?**
   - 현재: Phase 0(결정론) + LLM 루프(read → write → build → retry)
   - 대안: 결정론적 빌드 스크립트 생성기 + LLM은 실패 복구만?
   - 전 리뷰(26.03.25)에서도 이 질문이 제기됨

2. **도구 확장 정책이 필요한가?**
   - 현재: 코드에 하드코딩. 새 도구 추가 시 코드 변경 필요
   - 대안: 도구 레지스트리를 설정 파일로 분리? 런타임 도구 등록?

3. **컨텍스트 압축을 LLM 기반으로 전환해야 하는가?**
   - 현재: 단순 truncation (오래된 메시지 버림)
   - 대안: LLM에게 중간 턴을 요약시킨 뒤 요약문으로 교체?
   - 트레이드오프: 추가 LLM 호출 비용 vs 정보 보존

4. **Prompt 토큰:Completion 토큰 비율이 60:1인데 정상인가?**
   - 도구 결과(파일 내용)가 대부분을 차지
   - 더 줄일 수 있는가? 줄여야 하는가?

---

## 6. 리뷰어에게 묻는 질문

### Q1. 에이전트, 이 상태로 괜찮은가?

- Phase 분리 아키텍처(결정론 → LLM)는 건전한가?
- 예산/종료 정책은 충분히 보수적인가?
- 컨텍스트 압축 전략(16K 임계치 + truncation)은 적절한가?
- 도구 안전성(경로 순회 차단, 금지 명령어, 파일 정책)에 빈틈은 없는가?

### Q2. 어떻게 하면 더 나은 에이전트가 될 수 있는가?

- 에이전트 루프의 구조적 개선 방향은?
- LLM 호출 효율을 높이려면? (60:1 비율 개선)
- 빌드 에이전트의 성공률을 높이려면?
- 테스트 전략에서 빠진 것은?
- 프로덕션 운영 관점에서 준비해야 할 것은?

---

## 7. 첨부 코드

리뷰의 정확도를 위해, 아래 파일들의 전체 소스 코드를 첨부합니다.

---

### 7.1 agent-shared — 공통 프레임워크

#### `agent_shared/schemas/agent.py` — 핵심 DTO (17개)

```
첨부 대상: services/agent-shared/agent_shared/schemas/agent.py
```

#### `agent_shared/llm/caller.py` — LLM 호출 + adaptive timeout

```
첨부 대상: services/agent-shared/agent_shared/llm/caller.py
```

#### `agent_shared/llm/message_manager.py` — 멀티턴 메시지 관리 + compact()

```
첨부 대상: services/agent-shared/agent_shared/llm/message_manager.py
```

#### `agent_shared/llm/turn_summarizer.py` — 컨텍스트 압축

```
첨부 대상: services/agent-shared/agent_shared/llm/turn_summarizer.py
```

#### `agent_shared/tools/executor.py` — 도구 실행 + timeout

```
첨부 대상: services/agent-shared/agent_shared/tools/executor.py
```

#### `agent_shared/policy/retry.py` — 재시도 정책

```
첨부 대상: services/agent-shared/agent_shared/policy/retry.py
```

#### `agent_shared/errors.py` — 에러 계층

```
첨부 대상: services/agent-shared/agent_shared/errors.py
```

---

### 7.2 Analysis Agent — 심층 분석

#### `core/phase_one.py` — 결정론적 Phase 1

```
첨부 대상: services/analysis-agent/app/core/phase_one.py
```

#### `core/agent_loop.py` — 에이전트 루프

```
첨부 대상: services/analysis-agent/app/core/agent_loop.py
```

#### `core/result_assembler.py` — 응답 조립 + 검증

```
첨부 대상: services/analysis-agent/app/core/result_assembler.py
```

#### `tools/router.py` — 도구 디스패치 + 예산 + 중복 차단

```
첨부 대상: services/analysis-agent/app/tools/router.py
```

---

### 7.3 Build Agent — 빌드 자동화

#### `core/phase_zero.py` — 결정론적 사전 분석

```
첨부 대상: services/build-agent/app/core/phase_zero.py
```

#### `core/agent_loop.py` — 빌드 에이전트 루프 (force_report, 연속 실패 추적)

```
첨부 대상: services/build-agent/app/core/agent_loop.py
```

#### `routers/tasks.py` — 핸들러 + 시스템 프롬프트 + 도구 등록

```
첨부 대상: services/build-agent/app/routers/tasks.py
```

#### `tools/implementations/list_files.py` — 디렉토리 트리 (신규)

```
첨부 대상: services/build-agent/app/tools/implementations/list_files.py
```

#### `tools/implementations/try_build.py` — 빌드 실행 + 에러 분류기 연동

```
첨부 대상: services/build-agent/app/tools/implementations/try_build.py
```

#### `tools/implementations/read_file.py` — 파일 읽기 (8KB 제한)

```
첨부 대상: services/build-agent/app/tools/implementations/read_file.py
```

#### `pipeline/build_error_classifier.py` — 빌드 에러 분류기 (신규)

```
첨부 대상: services/build-agent/app/pipeline/build_error_classifier.py
```

#### `tools/router.py` — 빌드 에이전트 도구 라우터

```
첨부 대상: services/build-agent/app/tools/router.py
```

---

## 8. 참고: API 계약서 + 기능 명세

리뷰어가 S3의 외부 인터페이스를 파악하는 데 도움이 됩니다.

```
첨부 대상:
- docs/api/analysis-agent-api.md
- docs/api/build-agent-api.md
- docs/specs/analysis-agent.md
```
