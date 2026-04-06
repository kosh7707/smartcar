# S4 Session 9 — build path boundary inversion (`sdkId` 제거, autodetect 제거, sdk-registry 제거) (2026-04-04)

## 배경

사용자 검토 결과, S4 build path가 MCP/tool surface 이상의 일을 하고 있다는 구조적 문제가 드러났다.

문제였던 기존 동작:
- `sdkId` 기반 local SDK/toolchain 해석
- `buildCommand` 자동 감지 (`detect_build_command()`)
- public `/v1/sdk-registry` 제공

결론:
- build path는 execution-only여야 한다
- 잘못된 caller input이면 실패가 정답이다
- SDK metadata ownership은 upstream(S3 via S2)로 올린다

## 이번 세션에서 한 일

### 1. build path contract inversion
- `/v1/build`
  - `sdkId` 제거
  - `buildCommand` 필수
  - `buildEnvironment` explicit env 주입 도입
- `/v1/build-and-analyze`
  - build portion에 동일 원칙 적용
  - analysis portion은 `scanProfile`로 분리
- `/v1/sdk-registry`
  - public API 제거

### 2. runtime 구현
- `services/sast-runner/app/scanner/build_runner.py`
  - SDK/environment-setup 해석 제거
  - caller-supplied command/env만 실행
- `services/sast-runner/app/routers/scan.py`
  - build/build-and-analyze router contract rewrite
  - sdk-registry endpoints 제거
- `services/sast-runner/app/schemas/request.py`
  - build path request shape 재정의
- `services/sast-runner/app/schemas/response.py`
  - build evidence shape를 execution-only boundary에 맞게 단순화

### 3. 문서/WR 반영
- `docs/api/sast-runner-api.md`
- `docs/specs/sast-runner.md`
- `docs/s4-handoff/README.md`
- `docs/work-requests/s4-to-s3-build-snapshot-consumer-alignment-response.md`
- `docs/work-requests/s4-to-s3-build-and-scan-degraded-behavior-response.md`
- `docs/work-requests/s4-to-s2-build-path-boundary-inversion-notice.md`

### 4. 처리 완료 WR 삭제
- `s3-to-s4-build-snapshot-consumer-alignment.md`
- `s3-to-s4-sdk-build-exit127-certificate-maker.md`
- `s3-to-s4-sdk-env-build-fallback.md`
- `s3-to-s4-large-scan-stall-gateway-webserver.md`
- `s3-to-s4-large-project-sast-timeout-floor.md`

## 검증
- `pytest services/sast-runner/tests/test_build_runner.py services/sast-runner/tests/test_scan_endpoint.py` → 통과
- `py_compile` → 통과

## 현재 상태
- build path는 이제 caller-materialized execution-only
- analysis path 철학은 그대로 유지
- downstream(S2/S3) adaptation 필요
