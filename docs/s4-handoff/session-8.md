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

동시에 S3가 live integration test / hot-reload 민감 구간에 있는 것으로 보였기 때문에,
이번 세션은 **runtime code 변경보다 docs/contract/handoff 정렬을 우선**했다.

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

## 미완료 / 다음 세션

runtime code 변경은 이번 세션에서 일부러 미뤘다.

우선순위:
1. WR 응답 문서 최종 정리/발송
2. 필요 시 API/spec에 “planned / not-yet-implemented seam” 명시
3. S3 live test 구간이 끝나면
   - SDK env failure 가시화
   - degraded execution metadata
   - heartbeat/timeout-floor 개선
   를 S4 코드에 반영
