# S4 Session 8 — Build Snapshot consumer seam 정렬 + S3 WR triage (2026-04-04)

## 배경

2026-04-04 오후 기준 `docs/work-requests/`에 S3→S4 WR이 다수 도착했다.

주요 축은 두 가지다.

1. **Build Snapshot consumer alignment**
   - `s3-to-s4-build-snapshot-consumer-alignment.md`
2. **runtime degraded behavior**
   - `s3-to-s4-sdk-build-exit127-certificate-maker.md`
   - `s3-to-s4-sdk-env-build-fallback.md`
   - `s3-to-s4-large-scan-stall-gateway-webserver.md`
   - `s3-to-s4-large-project-sast-timeout-floor.md`

동시에 S3가 live integration test / hot-reload 민감 구간에 있는 것으로 보여,
세션 초반에는 **docs/contract/handoff 정렬을 우선**했고,
이후 테스트 공백 구간에 실제 runtime contract rewrite까지 마무리했다.

## 이번 세션에서 한 일

### 1. `/plan` 성격의 grounding artifact 작성

- `.omx/context/s4-build-snapshot-alignment-20260404T081416Z.md`
- `.omx/plans/prd-s4-build-snapshot-alignment.md`
- `.omx/plans/test-spec-s4-build-snapshot-alignment.md`

핵심 제약:
- S4 only
- 다른 서비스 코드는 읽지 않음
- snapshot seam은 docs/WR/API 계약 수준에서 먼저 정렬
- hot-reload 민감 시간에는 runtime 수정 최소화

### 2. Build Snapshot consumer seam 설계 문서화

신규 문서:
- `docs/s4-handoff/build-snapshot-consumer-seam.md`

핵심 결론:
- snapshot identity (`buildSnapshotId`, `buildUnitId`, `snapshotSchemaVersion`)는 upstream canonical object가 authoritative
- S4는 build/scan execution evidence authority 유지
- 현 단계 migration-safe seam은 `reference-only`가 아니라
  `reference + concrete evidence` 혼합형이 안전
- `/v1/build-and-analyze`는 convenience surface로 남기되 canonical orchestration path에서는 축소
- `/v1/discover-targets`는 identity source가 아니라 identity hint source

### 3. roadmap/README 갱신

- `docs/s4-handoff/roadmap.md`
  - 즉시 다음 항목을 snapshot seam / SDK exit127 / 대형 scan degraded behavior 중심으로 재정렬
- `docs/s4-handoff/README.md`
  - 관리 문서 목록에 seam 설계 메모 추가

### 4. S3 회신 초안 준비

이번 세션에서 WR 응답 문서를 추가했다.
- `docs/work-requests/s4-to-s3-build-snapshot-consumer-alignment-response.md`
- `docs/work-requests/s4-to-s3-build-and-scan-degraded-behavior-response.md`

### 5. `/deep-interview -> ralplan -> ralph` 실행 후 runtime 구현

세션 후반부에 아래가 추가로 완료되었다.

- `/v1` breaking contract rewrite (`/v2` 미도입, compatibility shim 없음)
- `Build Snapshot provenance` 입력/echo
- `/v1/build` structured `buildEvidence` + `failureDetail`
- `/v1/scan` degraded-aware heartbeat / execution metadata
- `/v1/build-and-analyze` contract 정렬 (convenience / transitional surface 유지)

핵심 구현 파일:
- `services/sast-runner/app/config.py`
- `services/sast-runner/app/schemas/request.py`
- `services/sast-runner/app/schemas/response.py`
- `services/sast-runner/app/routers/scan.py`
- `services/sast-runner/app/scanner/build_runner.py`
- `services/sast-runner/app/scanner/orchestrator.py`
- `services/sast-runner/app/scanner/gcc_analyzer_runner.py`
- `services/sast-runner/app/scanner/scanbuild_runner.py`

핵심 테스트 파일:
- `services/sast-runner/tests/test_build_runner.py`
- `services/sast-runner/tests/test_scan_endpoint.py`
- `services/sast-runner/tests/test_orchestrator.py`

## 현재 판단

### Build Snapshot alignment

- S4는 snapshot persistence owner가 아님
- S4는 direct snapshot lookup consumer도 아님
- 따라서 현재 가장 안전한 seam은:
  - upstream이 `buildSnapshotId/buildUnitId/snapshotSchemaVersion`을 넘기고
  - 동시에 `projectPath`, `compileCommands`, `buildCommand`, `buildProfile`, `thirdPartyPaths` 같은
    concrete execution evidence를 함께 넘기는 방식

### SDK exit127

- 현재 코드/로그 관점에서는 SDK `environment-setup` source 이후 host dependency / shared library load 문제 가능성이 높음
- S4는 묵시적 fallback보다 **원인 가시화**를 먼저 강화하는 편이 맞음

### 대형 scan stall

- `gateway-webserver`는 hard hang보다는
  heavy analyzer 장기 실행 + vendor timeout이 겹친 degraded behavior에 가까움
- 상위 호출자(S3)가 이를 stall과 구분하기 어려운 현재 신호 공백이 존재

## 검증

- `pytest services/sast-runner/tests/test_build_runner.py services/sast-runner/tests/test_scan_endpoint.py services/sast-runner/tests/test_orchestrator.py`
  - **102 passed**
- `python -m py_compile`
  - request/response/router/build/orchestrator/heavy-analyzer runner 통과
- `pytest --collect-only`
  - **375 tests collected**

## 다음 세션

1. S2/S3의 downstream adaptation feedback 수신 시 contract drift 보정
2. 필요하면 `discover-targets` identity-hint → upstream durable identity 매핑 전략 논의
3. heavy analyzer vendor policy 자체 완화는 별도 판단
