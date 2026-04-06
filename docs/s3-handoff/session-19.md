# S3 세션 19 — 2026-04-04

## 세션 요약

S3 agent integration test를 실제 서비스 기동 상태에서 수행했다. Build Agent `build-resolve`, Analysis Agent `deep-analyze`, `generate-poc`, Build Agent `sdk-analyze`를 순차 검증했고, 외부 서비스(S4) 경고는 WR로 분리했다. 동시에 S3-owned warning/bug 2건을 직접 수정했다.

---

## 실행한 검증

### 1. 서비스 기동/정리

- `./scripts/stop.sh`
- `./scripts/common/reset-logs.sh`
- `./scripts/start.sh --no-ecu --no-frontend`
- 이후 추가 수정 반영을 위해 스택 재기동 3회 수행

### 2. 결정론적 회귀 게이트

- `services/analysis-agent`
  - `tests/test_skeleton_smoke.py`
  - `tests/test_upstream_contracts.py`
  - `tests/test_phase_one.py`
  - `tests/test_sast_tool.py`
  - 결과: **57 passed, 1 warning**
  - 후속 조치: pydantic `model_name` protected namespace warning 제거
- `services/build-agent`
  - `tests/test_health.py`
  - `tests/test_contract_build.py`
  - `tests/test_golden.py`
  - `tests/test_tools_try_build.py`
  - `tests/test_result_assembler.py`
  - `tests/test_sdk_prompt.py`
  - `tests/test_sdk_analyze_deterministic.py`
  - 결과: **16 passed** (최종 보강 세트)

### 3. live Build Agent — certificate-maker

- requestId: `e2e-1775275657-build`
- 대상: `uploads/proj-60bf5eb4-bc1f-4275-b7d5-15db1f939935/certificate-maker`
- 결과: **completed**
- 관측:
  - 첫 `try_build`는 `sdkId=ti-am335x` 적용 상태에서 `exitCode=127`
  - 이후 SDK 제거 fallback으로 빌드 성공
  - 최종 `build-aegis-e2e-1775/aegis-build.sh` 생성

### 4. live Analysis Agent — certificate-maker

- requestId: `e2e-1775275874-analyze`
- 결과: **completed**, claims 0건
- Phase 1 (S4/S5)와 결과 저장(S5 project-memory) 모두 정상 동작
- 자연 PoC 경로는 claims 0건으로 미실행

### 5. live generate-poc 직접 검증

- requestId: `poc-live-20260404-1`
- 대상 claim: `certificate-maker` `main.cpp:30` `popen()` 지점 기반 수동 claim
- 결과: **completed**
- 의미: `generate-poc` 엔드포인트 자체의 live 응답/감사 경로 확인 완료

### 6. live sdk-analyze 검증

초기 재현:
- `sdk-live-20260404-1`: `INVALID_GROUNDING`
- `sdk-live-20260404-2~4`: directory discovery 부재/비효율로 tool-call loop 재현

최종 수정 후:
- `sdk-live-20260404-7`: **completed**
- 결정론적 shortcut으로 environment-setup / compiler 경로 추출

---

## 이번 세션 S3 수정

### A. 공용 DTO warning 제거

- `services/agent-shared/agent_shared/schemas/agent.py`
  - `AgentAuditInfo`에 `protected_namespaces=()` 추가
- `services/analysis-agent/tests/test_agent_schemas.py`
  - 해당 warning 비재현 회귀 테스트 추가

### B. sdk-analyze live 안정화

- `services/build-agent/app/routers/tasks.py`
  - sdk-analyze prompt에 `list_files → read_file` 순서와 ref 사용 규칙 명시
  - sdk-analyze 전용 `list_files` 도구 추가
  - deterministic SDK profile extraction shortcut 추가
  - 상대 `CC` 토큰을 실제 compiler 경로로 매칭하도록 보정
- `services/build-agent/tests/test_sdk_prompt.py`
  - sdk prompt 회귀 테스트 추가
- `services/build-agent/tests/test_sdk_analyze_deterministic.py`
  - deterministic extraction 회귀 테스트 추가

---

## WR 발행

### S4 대상

1. `docs/work-requests/s3-to-s4-sdk-build-exit127-certificate-maker.md`
   - `sdkId=ti-am335x` 적용 빌드에서 `exitCode=127` 재현
2. `docs/work-requests/s3-to-s4-large-scan-stall-gateway-webserver.md`
   - 대형 프로젝트 스캔에서 timeout floor / gcc-fanalyzer timeout / S3 stall 감지 재현

---

## 남은 리스크

1. `sdk-analyze`는 이제 completed 되지만, 현재 `gccVersion`은 빈 문자열로 둘 수 있다.
2. 실 SDK env script가 반환하는 `sysroot` 값은 현재 `/home/kosh/ti-sdk/...` 형태로 남는다. S4/SDK 설치 상태와 실제 사용 경로 일치 여부는 별도 검증 필요.
3. `gateway-webserver` 급 대형 프로젝트는 여전히 S4 stall 경고 이슈가 있어, full live analyze/poc는 S4 조치 전까지 불안정하다.
4. Build Agent live fallback은 동작하지만, ARM cross-build 보장은 아직 없다 (`exitCode=127` WR 참고).

---

## 다음 세션 권장 시작점

1. `docs/AEGIS.md`
2. `docs/s3-handoff/README.md`
3. `docs/work-requests/` (특히 S4 답변 여부)
4. `docs/s3-handoff/session-19.md`
5. S4 WR 회신 전까지는 `certificate-maker` 기준 smoke/live 재검증 우선
