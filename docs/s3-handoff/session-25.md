# S3 세션 25 — 2026-04-04

## 세션 요약

S4 v0.11 build-path 변경과 S5 readiness/provenance 변경에 맞춰 S3를 실제로 적응시켰고,
새로운 caller-provided build-script hint contract를 추가한 뒤,
RE100 4개 서브프로젝트를 **직접 endpoint-driven `build-resolve` 호출**로 재검증했다.

이번 세션의 핵심은 아래 4가지다.

1. **S4 v0.11 build-path 적응**
   - S3 build path에서 `sdkId` / S4 `sdk-registry` 구가정을 제거
   - S4에 넘기는 payload를 `buildCommand` + `buildEnvironment` + optional `provenance` 중심으로 재정렬
   - `TryBuildTool`이 S4 v0.11 `buildEvidence` / `failureDetail` shape를 이해하도록 수정

2. **S5 readiness / provenance 적응**
   - threat search는 더 이상 degraded fallback을 가정하지 않고 `KB_NOT_READY`를 명시 처리
   - code-graph/project-memory 호출에 optional provenance seam (`buildSnapshotId`, `buildUnitId`, `sourceBuildAttemptId`) 전달 준비

3. **새 hint field 도입**
   - `build.scriptHintText` / `buildScriptHintText`
   - **text-only**
   - **reference-only**
   - **직접 실행 금지**
   - 안전성 강화: 생성 스크립트에 `apt-get`, `sudo`, `curl`, `wget`, `git clone` 같은 forbidden content가 들어가면 write/edit 단계에서 차단

4. **RE100 4/4 build-resolve 검증**
   - `certificate-maker` ✅
   - `gateway` ✅
   - `gateway-webserver` ✅
   - `gateway-test` ✅
     - 단, `gateway-test`는 caller-provided text hint를 통해 통과
     - 이는 이번 슬라이스의 product rule(힌트 제공 시 참고만 해서 성공)을 만족하는 증거로 본다

---

## 주요 변경 파일

### Build Agent
- `services/build-agent/app/schemas/request.py`
- `services/build-agent/app/validators/build_request_contract.py`
- `services/build-agent/app/core/phase_zero.py`
- `services/build-agent/app/core/result_assembler.py`
- `services/build-agent/app/tools/implementations/try_build.py`
- `services/build-agent/app/tools/implementations/write_file.py`
- `services/build-agent/app/tools/implementations/edit_file.py`
- `services/build-agent/app/routers/tasks.py`
- `services/build-agent/scripts/build-test.sh`
- `services/build-agent/tests/test_build_request_contract.py`
- `services/build-agent/tests/test_result_assembler.py`
- `services/build-agent/tests/test_tools_try_build.py`
- `services/build-agent/tests/test_tools_write_file.py`
- `services/build-agent/tests/test_tools_edit_file.py`

### Analysis Agent
- `services/analysis-agent/app/core/phase_one.py`
- `services/analysis-agent/app/rag/threat_search.py`
- `services/analysis-agent/app/tools/implementations/knowledge_tool.py`
- `services/analysis-agent/scripts/build-and-analyze.sh`
- `services/analysis-agent/tests/test_phase_one.py`

### Docs
- `docs/api/build-agent-api.md`
- `docs/specs/build-agent.md`
- `docs/api/analysis-agent-api.md`
- `docs/specs/analysis-agent.md`
- `docs/s3-handoff/roadmap.md`
- `docs/s3-handoff/session-25.md`

---

## 회귀 검증

### 정적/문법
- `python3 -m py_compile ...` ✅
- `bash -n services/build-agent/scripts/build-test.sh` ✅
- `bash -n services/analysis-agent/scripts/build-and-analyze.sh` ✅
- `git diff --check` ✅

### 테스트
- build-agent targeted regression: **76 passed**
- analysis-agent targeted regression: **36 passed**

### live endpoint-driven build-resolve
- `cert-current-build` ✅
- `gateway-current-build` ✅
- `gateway-webserver-current-build` ✅
- `gateway-test-build-custom2` ✅

---

## Architect 판정

- architect review: **APPROVED**
- 판단 요약:
  - S4/S5 대응 목적 충족
  - hint field 요구사항 충족
  - `gateway-test`가 custom text hint를 요구한 것은 이번 슬라이스 목표와 모순이 아니라,
    새 contract가 실제로 작동한다는 증거로 해석 가능

---

## 남은 후속 과제

1. **S2 게이트 재개 신호 발행 여부 결정**
   - Build Snapshot / BuildAttempt 구현을 이제 열어도 되는지 S2에 통보할지 판단

2. **analysis integration 확장 여부 결정**
   - 이번 세션은 4/4 build-resolve 기준으로 목표를 달성함
   - 이후 `deep-analyze` / PoC까지 RE100 전체 확장 검증을 할지 결정

3. **gateway-test hint 최소치 정리**
   - hint 없이도 되는지
   - 최소 어떤 힌트면 되는지
   - product guidance로 문서화할지 판단
