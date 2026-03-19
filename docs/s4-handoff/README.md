# S4. SAST Runner 인수인계서

> **반드시 `docs/AEGIS.md`를 먼저 읽을 것.** 프로젝트 공통 제약 사항, 역할 정의, 소유권이 그 문서에 있다.
> 이 문서는 S4(SAST Runner) 개발을 이어받는 다음 세션을 위한 인수인계서다.
> 이것만 읽으면 현재 상태를 파악하고 바로 작업을 이어갈 수 있어야 한다.
> **마지막 업데이트: 2026-03-19**

---

## 1. AEGIS 전체 그림

### 7인 체제 (2026-03-19 확정)

```
                     S1 (Frontend :5173)
                          │
                     S2 (AEGIS Core :3000)
                    ╱     │     ╲      ╲
                 S3       S4     S5      S6
               Agent    SAST     KB    동적분석
              :8001    :9000   :8002    :4000
                │
              S7 (LLM Gateway :8000)
                │
           LLM Engine (DGX Spark)
```

| 역할 | 담당 | 포트 |
|------|------|------|
| S1 | Frontend + QA | :5173 |
| S2 | AEGIS Core (Backend) — 플랫폼 오케스트레이터 | :3000 |
| S3 | Analysis Agent — 보안 분석 자율 에이전트 | :8001 |
| **S4** | **SAST Runner (정적 분석 전담)** | **:9000** |
| S5 | Knowledge Base (Neo4j + Qdrant) | :8002 |
| S6 | Dynamic Analysis (ECU Sim + Adapter) | :4000 |
| S7 | LLM Gateway + LLM Engine 관리 | :8000, DGX |

### S4의 정체성

> S4는 **SAST Runner(:9000) 전담**이다.
> 6개 SAST 도구 + SCA(라이브러리+CVE) + 코드 구조 + 빌드 자동화를 제공한다.
> **결정론적 처리를 최대화하고, LLM의 결정 표면을 최소화**하는 것이 핵심 원칙이다.

---

## 2. 너의 역할과 경계

### 너는

- **SAST Runner 전담 개발자** (`services/sast-runner/`)
- `docs/api/sast-runner-api.md` API 계약서 소유
- `docs/specs/sast-runner.md` 명세서 소유
- `scripts/start-sast-runner.sh` + `services/sast-runner/.env` 소유
- 7개 엔드포인트 관리: scan, functions, includes, metadata, libraries, build-and-analyze, health

### 너는 하지 않는다

- DGX Spark / LLM Engine 관리 → **S7** (2026-03-19 S3에서 S7로 분리 신설)
- 프롬프트 작성, LLM 응답 파싱 → S3
- 지식 그래프, 벡터 검색 → S5
- 분석 결과 최종 판정, findings 심각도 정규화 → S2
- 동적 분석, ECU 시뮬레이션 → S6
- UI → S1
- `scripts/start.sh` / `scripts/stop.sh` 직접 수정 금지 → S2에 work-request

### API 계약 소통 원칙 (필수)

- **다른 서비스의 동작은 반드시 API 계약서(`docs/api/`)로만 파악한다**
- **다른 서비스의 코드를 절대 읽지 않는다** — 코드를 보고 동작을 파악하거나 거기에 맞춰 구현하는 것은 금지
- 계약서에 없는 필드/엔드포인트는 "존재하지 않는다"고 간주한다
- 계약서와 실제 코드가 다르면, 해당 서비스 소유자에게 계약서 갱신을 work-request로 요청한다
- **공유 모델(`shared-models.md`) 또는 API 계약서가 변경되면, 영향받는 상대 서비스에게 반드시 work-request로 고지한다**

### 작업 요청 주고받기

- **경로**: `docs/work-requests/`
- **파일명**: `{보내는쪽}-to-{받는쪽}-{주제}.md`
- 다른 서비스에 요청할 일이 있으면 이 폴더에 문서를 작성한다
- **작업 완료 후 해당 요청 문서를 반드시 삭제한다**

---

## 3. SAST Runner 서비스

### 개요

- **위치**: `services/sast-runner/` (monorepo 내, WSL2 로컬)
- **스택**: Python 3.12 + FastAPI + Uvicorn
- **포트**: 9000
- **API 계약**: `docs/api/sast-runner-api.md`
- **명세서**: `docs/specs/sast-runner.md`

### 6개 SAST 도구

| 도구 | 역할 | 출력 형식 | 비고 |
|------|------|-----------|------|
| Semgrep | 패턴 매칭 | SARIF JSON | C++ 프로젝트에서 자동 스킵 |
| Cppcheck | 코드 품질 + CTU | XML | `--project=` compile_commands 지원 |
| clang-tidy | CERT 코딩 표준 + 버그 | 텍스트 | `-p` compile_commands 지원 |
| Flawfinder | 위험 함수 빠른 스캔 | CSV | |
| scan-build | Clang Static Analyzer | plist | 경로 민감 분석 |
| gcc -fanalyzer | GCC 내장 정적 분석 | stderr 텍스트 | gcc 10+ 필요 |

### 7개 엔드포인트

| 엔드포인트 | 역할 |
|-----------|------|
| `POST /v1/scan` | 6개 도구 병렬 실행 → SastFinding[] |
| `POST /v1/functions` | clang AST → 함수 목록 + 호출 관계 |
| `POST /v1/includes` | gcc -E -M → 인클루드 트리 |
| `POST /v1/metadata` | gcc -E -dM → 빌드 매크로/아키텍처 |
| `POST /v1/libraries` | SCA: 라이브러리 식별 + upstream diff + CVE |
| `POST /v1/build-and-analyze` | bear 빌드 + 위 전부 통합 실행 |
| `GET /v1/health` | 6개 도구 가용성 확인 |

### 코드 구조

```
services/sast-runner/
├── app/
│   ├── main.py              — FastAPI 앱, JSON 로깅, lifespan
│   ├── config.py            — pydantic-settings (SAST_ prefix .env)
│   ├── context.py           — contextvars 기반 requestId 전파
│   ├── errors.py            — 커스텀 에러 4종
│   ├── routers/
│   │   └── scan.py          — 7개 엔드포인트 라우터
│   ├── schemas/
│   │   ├── request.py       — ScanRequest, BuildProfile, FileEntry
│   │   └── response.py      — SastFinding, ScanResponse, HealthResponse
│   └── scanner/
│       ├── orchestrator.py   — 6도구 병렬 실행 + SDK 해석 + 필터링
│       ├── semgrep_runner.py
│       ├── cppcheck_runner.py
│       ├── clangtidy_runner.py
│       ├── flawfinder_runner.py
│       ├── scanbuild_runner.py
│       ├── gcc_analyzer_runner.py
│       ├── sarif_parser.py   — SARIF→SastFinding 변환
│       ├── ruleset_selector.py — BuildProfile 기반 룰셋 자동 선택
│       ├── sdk_resolver.py   — SDK 인클루드 경로 레지스트리
│       ├── ast_dumper.py     — clang AST 함수/호출 그래프 추출
│       ├── include_resolver.py — gcc -E -M 인클루드 트리
│       ├── build_metadata.py — gcc -E -dM 매크로 추출
│       ├── build_runner.py   — bear 빌드 자동화
│       ├── library_identifier.py — vendored 라이브러리 식별
│       ├── library_differ.py — upstream diff (해시 기반)
│       ├── library_hasher.py — SHA256 파일 해시 비교
│       └── cve_lookup.py     — OSV/NVD API CVE 조회
├── tests/
│   ├── conftest.py          — 오케스트레이터 mock fixture
│   ├── test_sarif_parser.py — SARIF 파싱 14개 테스트
│   ├── test_ruleset_selector.py — 룰셋 선택 17개 테스트
│   ├── test_scan_endpoint.py — API 엔드포인트 11개 테스트
│   └── fixtures/sample.sarif.json
└── requirements.txt
```

### 기동 방법

```bash
# 기동 스크립트 (단독 실행)
./scripts/start-sast-runner.sh

# 또는 수동
cd services/sast-runner
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 9000
```

### 초기 세팅 (venv이 없을 때)

```bash
cd services/sast-runner
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
semgrep --version  # 설치 확인
```

### 동작 확인

```bash
# 헬스체크
curl http://localhost:9000/v1/health

# 스캔 테스트
curl -X POST http://localhost:9000/v1/scan \
  -H "Content-Type: application/json" \
  -d '{
    "scanId": "test-001",
    "projectId": "proj-test",
    "files": [{"path": "main.c", "content": "#include <stdio.h>\nint main(){char buf[10];gets(buf);return 0;}"}],
    "rulesets": ["p/c"]
  }'
```

### 테스트

```bash
cd services/sast-runner
source .venv/bin/activate
pytest tests/ -v   # 42개 테스트
```

### 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| `SEMGREP_NOT_AVAILABLE` (503) | Semgrep 미설치 | `pip install semgrep` |
| `SCAN_TIMEOUT` (504) | 큰 파일/많은 파일 | `timeoutSeconds` 상향 또는 파일 분할 |
| `SARIF_PARSE_ERROR` (502) | Semgrep 출력 이상 | venv에서 수동 `semgrep scan --sarif` 실행하여 출력 확인 |
| 포트 9000 충돌 | 다른 프로세스 | `lsof -i :9000`으로 확인 후 종료 |

### 로그 확인

```bash
# SAST Runner 로그 (로컬)
tail -20 logs/s4-sast-runner.jsonl
```

---

## 4. 현재 상태

### 완료된 것

- [x] SAST Runner 서비스 구축 (Python + FastAPI, 포트 9000)
- [x] 6개 SAST 도구 통합 (Semgrep, Cppcheck, clang-tidy, Flawfinder, scan-build, gcc -fanalyzer)
- [x] BuildProfile 기반 도구 자동 선택 (C++이면 Semgrep 스킵 등)
- [x] SDK 자동 해석 (ti-am335x 레지스트리, 헤더 7개 경로 자동 주입)
- [x] SDK 노이즈 필터링 (254건 → 28건)
- [x] projectPath + compile_commands.json 지원
- [x] 코드 그래프 추출 (/v1/functions) — 3단계 필터링, NamespaceDecl 재귀
- [x] 인클루드 트리 추출 (/v1/includes) — gcc -E -M
- [x] 빌드 메타데이터 추출 (/v1/metadata) — gcc -E -dM
- [x] SCA 라이브러리 식별 (/v1/libraries) — git, CMake, configure.ac 등
- [x] SCA upstream diff — SHA256 해시 기반 비교
- [x] CVE 조회 — OSV/NVD API 실시간
- [x] 빌드 자동화 (/v1/build-and-analyze) — bear 기반 compile_commands 생성
- [x] contextvars 기반 requestId 전 레이어 전파
- [x] JSON structured logging (epoch ms, s4-sast-runner.jsonl)
- [x] API 계약서 + 명세서 작성
- [x] 42개 테스트 통과 (SARIF 14 + 룰셋 17 + API 11)
- [x] S3 통합 테스트 성공 (confidence 0.865, schemaValid=true)

### 미완료 (S4 소관)

- [ ] S2 연동 테스트 (S2가 `scripts/start.sh`에 SAST Runner 추가 후)
- [ ] 커스텀 규칙셋 (자동차/임베디드 특화 Semgrep 규칙)
- [ ] 코드 버전 동기화 (`main.py` v0.2.0 → v0.3.0으로 수정 필요)

### RE100 실측 결과

- RE100 IoT 게이트웨어 코드 (C++17, 33파일, 2,650 SLOC)
- `/v1/build-and-analyze`: 빌드(5s) + SAST + 코드 그래프 + SCA + CVE = 236초
- SAST 도구별: Semgrep 0건, Flawfinder 95건, Cppcheck 19건, clang-tidy 145건, scan-build 0건, gcc -fanalyzer 0건
- SCA: 6개 라이브러리 식별, 3개 수정 탐지 (15초)
- 코드 그래프: 73개 사용자 함수, 242개 호출 관계

---

## 5. 활동 이력

### 2026-03-18

- `/v1/build-and-analyze` 엔드포인트 구현 (빌드 자동 실행 + 전체 분석 통합)
- CVE 조회 통합 (NVD/OSV API) — `/v1/libraries`에 추가
- 통합 테스트 v2/v3 성공
- SCA 라이브러리 분석 완성 (SHA256 해시 기반 upstream diff)
- 코드 그래프 품질 혁신 (NamespaceDecl 재귀, CallExpr 처리, 3단계 필터링)
- SAST Runner v0.3.0 (6개 도구 + 목적별 MCP Tool)
- **LLM Engine → S7 분리 완료** (S4→S3 인수인계 후, S3→S7 분리 신설)

### 2026-03-17

- RE100 실 코드 정적 분석 실험 + 에이전트 아키텍처 전환 제안
- SAST Runner 서비스 구축 완료 (`services/sast-runner/`)
- BuildProfile 지원 추가 (S2 요청 대응)
- 에이전트 PoC 성공 — Qwen 35B로 254건 → RELEVANT 8건 (97% 노이즈 제거)
- 아키텍처 결정: B안 (목적별 Tool) 확정, "결정론적 처리 최대화" 원칙

### 2026-03-16

- 정적분석 통합테스트 완료 (S1→S2→S3→S4 전 구간)
- Structured output 실 검증 완료

---

## 6. 향후 로드맵

| 항목 | 시기 | 설명 |
|------|------|------|
| S2 연동 테스트 | 다음 | S2가 start.sh에 추가 후 |
| 커스텀 규칙셋 | v1.0 | MISRA C, 자동차 임베디드 특화 Semgrep 규칙 |
| 코드 버전 동기화 | 즉시 | main.py + HealthResponse 버전을 v0.3.0으로 |
| AUTOSAR/Qt 대응 | v1.5 | 복잡한 빌드 시스템의 compile_commands.json 지원 확대 |

---

## 7. 관리하는 문서

| 문서 | 경로 | 용도 |
|------|------|------|
| SAST Runner 명세서 | `docs/specs/sast-runner.md` | SAST Runner 아키텍처, 도구 통합 |
| SAST Runner API 계약서 | `docs/api/sast-runner-api.md` | S2↔S4, S3↔S4 인터페이스 명세 |
| 이 인수인계서 | `docs/s4-handoff/README.md` | 다음 세션용 |

---

## 8. 참고할 문서들

| 문서 | 경로 | 왜 봐야 하는지 |
|------|------|--------------|
| 전체 기술 개요 | `docs/specs/technical-overview.md` | 프로젝트 전체 구조 이해 |
| SAST Runner API | `docs/api/sast-runner-api.md` | S2↔S4 계약 (본인 소유) |
| SastFinding 타입 | `docs/api/shared-models.md` | 응답 형식의 근거 |
| S3 API 명세 | `docs/api/llm-gateway-api.md` | S3가 S4를 호출하는 방식 |
| 외부 피드백 | `docs/외부피드백/S3_agentic_sast_design_feedback.md` | 에이전트 성능 가이드 |

---

## 9. 핵심 설계 원칙 (참고)

- **결정론적 처리 최대화, LLM 결정 표면 최소화** — 도구 실행/필터링/정규화는 결정론적. LLM은 판단만.
- **Phase 1(도구 자동 실행) → Phase 2(LLM 해석) 분리** — LLM에게 도구 호출 선택권을 주면 안 부름 → 강제 분리 필요
- **Evidence-first** — 모든 Finding은 증적에 근거
- **SDK 노이즈 사전 제거** — LLM에게 노이즈를 보내지 않음 (254건 → 28건)
- **"범용 정적 분석"이 아니라 "자동차 보안 특화"** — 도메인 특화 = LLM에게 먹이는 지식의 차이 (MISRA C, CAN 프로토콜, ISO 21434)
