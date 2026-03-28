# S3 로드맵

> 다음 작업 + 장기 계획. README에서 분리.

---

## 다음 세션 목표: 에이전트 통합 테스트

**목표**: 전 서비스 기동 → Build Agent 빌드 → Analysis Agent 정적 분석 → PoC 생성까지 E2E 검증.

### 사전 준비

1. **서비스 기동 확인**: S7(:8000) → S4(:9000) → S5(:8002, Neo4j 포함) → S3 Analysis(:8001) + Build(:8003)
2. **테스트 대상 프로젝트**: RE100 (`~/projects/re100-gateway/`) — 12개 C 소스, CMake 빌드

### 통합 테스트 시나리오

#### 1. Build Agent E2E

```bash
# build-resolve: RE100 프로젝트 빌드 자동화
curl -X POST http://localhost:8003/v1/tasks -H 'Content-Type: application/json' -d '{
  "taskType": "build-resolve",
  "taskId": "integ-build-01",
  "context": {
    "trusted": {
      "projectPath": "/home/kosh/projects/re100-gateway",
      "targetPath": ""
    }
  }
}'
```

**검증 포인트**:
- Phase 0 빌드 시스템 탐지 (cmake 예상)
- `build-aegis-{shortId}/aegis-build.sh` 생성 확인
- `generate_initial_script()` cmake 템플릿 활용 여부
- try_build 성공 (exitCode=0)
- 응답: `buildResult.success == true`, `audit.agentAudit.model_name` 포함

#### 2. Analysis Agent E2E (deep-analyze)

```bash
# deep-analyze: RE100 전반 보안 분석
curl -X POST http://localhost:8001/v1/tasks -H 'Content-Type: application/json' -d '{
  "taskType": "deep-analyze",
  "taskId": "integ-analyze-01",
  "context": {
    "trusted": {
      "projectPath": "/home/kosh/projects/re100-gateway"
    }
  }
}'
```

**검증 포인트**:
- Phase 1: SAST findings + 코드 그래프(src/ 외 디렉토리 포함) + SCA + CVE + 위협 조회 + 위험 호출자
- Phase 2: LLM claims 4건 이상, confidence > 0.5
- evidence refs 검증: tool-generated refs(`eref-sast-*`, `eref-func-*`)가 allowed_refs에 포함
- 위험 함수 추출: word boundary regex 동작 확인 (false positive 없음)
- `audit.agentAudit.model_name` + `prompt_version` 포함
- revisionHint 전달 (additive, S5 로그에서 확인)

#### 3. PoC 생성 (generate-poc)

```bash
# deep-analyze 결과의 첫 번째 claim에 대해 PoC 생성
curl -X POST http://localhost:8001/v1/tasks -H 'Content-Type: application/json' -d '{
  "taskType": "generate-poc",
  "taskId": "integ-poc-01",
  "context": {
    "trusted": {
      "projectPath": "/home/kosh/projects/re100-gateway",
      "targetClaim": { ... }
    }
  }
}'
```

**검증 포인트**:
- PoC 코드 생성 (Python/C)
- KB 위협 지식 참조

### 이번 세션 미완료 백로그 (통합 테스트와 함께 처리)

1. **API 계약서 갱신**: `docs/api/analysis-agent-api.md`에 `audit.agentAudit.model_name`/`prompt_version` 필드 추가
2. **Build Agent 초기 스크립트 라우터 연동**: Phase 0 `generate_initial_script()` 결과를 `build-aegis-{shortId}/aegis-build.sh`에 기록 + 프롬프트에 "템플릿 스크립트 생성됨" 안내. 코드는 `phase_zero.py`에 구현 완료, `tasks.py` 연동만 남음
3. **MCP 로그 도구 활용**: 통합 테스트 후 `trace_request`, `llm_stats`, `search_errors`로 파이프라인 건강성 검증

### 관측 도구

```bash
# 통합 테스트 후 MCP 도구로 검증
trace_request(request_id)      # 전 서비스 워터폴 추적
search_errors(since_minutes=30) # 최근 에러 확인
llm_stats(since_minutes=30)     # LLM 호출 통계
service_stats("s3-agent")       # Agent 서비스 통계
```

---

## 구현 로드맵

### 1단계: Task API 뼈대 — 완료

- task type enum + allowlist
- `POST /v1/tasks` 엔드포인트
- prompt registry + model profile registry
- schema/evidence validation + confidence calculator

### 2단계: 핵심 Task 구현 — 미착수

- static-explain, dynamic-annotate, report-draft (레거시 → S7 담당으로 이관됨)

### 3단계: Provenance / Audit / Trust — 부분 완료

- provenance metadata (model_name, prompt_version 추가 완료)
- budget / timeout / cache (구현 완료)
- input trust labeling, confidence 산출 (구현 완료)

### 4단계: Planner + Safety — 미착수

- test-plan-propose, static-cluster, safety/policy integration

### 5단계: Evaluation — 미착수

- evaluation harness, golden set 관리, regression 검증

---

## v2 추후 구현 사항

### 동적 분석: QEMU + GDB MCP (Phase 3)

정적 분석(Phase 1/2)이 발견한 취약점을 **동적으로 확인**하는 단계.

```
Phase 1 (결정론적)  →  "여기가 의심됨" (SAST finding)
Phase 2 (LLM 해석)  →  "이런 이유로 위험함" (상세 claim)
Phase 3 (GDB 확인)  →  "실제로 이 값이 들어옴. 확정." (동적 검증)
```

- QEMU user-mode: ARM 크로스컴파일 바이너리를 x86에서 실행
- GDB MCP 서버: debug.launch, breakpoint, continue, inspect, backtrace, terminate
- S6(Dynamic Analysis) 영역. S3는 Phase 3 오케스트레이션 담당.

### 동적 분석: 트래픽 주입 템플릿

PoC를 구조화된 실행 가능 템플릿으로 생성 (HTTP, gRPC, CAN, UDS, MQTT).

### 에이전트 메모리 고도화

- revision-aware 메모리 (commit/branch별 분리)
- diff 기반 변경 보고서 자동 생성
- 사용자 피드백(claim 승인/기각) → false positive 학습

### DPO 파인튜닝

AEGIS 분석 로그 축적 → DPO로 Qwen 122B 도메인 특화. S7 영역, S3는 학습 데이터 제공.

### AEGIS 분석 범위 (확정)

| IN-SCOPE | OUT-OF-SCOPE |
|----------|-------------|
| 바이너리 (소스→빌드→실행→내부 로직 검증) | 부채널 공격 (전력, 타이밍, EM) |
| 네트워크 (서비스 간 통신, 트래픽 주입, 프로토콜 퍼징) | 하드웨어 결함 주입 (voltage glitching) |
| | GPIO/SPI/I2C 런타임 분석 |
