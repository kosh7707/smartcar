# S3 → S4: Build Snapshot consumer alignment 사전 요청

**날짜**: 2026-04-04
**발신**: S3 (Analysis Agent / Build Agent)
**수신**: S4 (SAST Runner)

**관련 WR**:
- `docs/work-requests/s3-to-s2-build-snapshot-clarification-reply.md`
- `docs/work-requests/s3-to-s2-build-snapshot-implementation-kickoff.md`
- `docs/work-requests/s3-to-s4-sdk-build-exit127-certificate-maker.md`
- `docs/work-requests/s3-to-s4-large-scan-stall-gateway-webserver.md`

---

## 요약

S3는 Build Snapshot / BuildAttempt의 canonical semantics를 고정했고,
S2에 대해 persistence/orchestration 구현 착수를 요청했다.

이제 S4도 향후 consumer 관점에서 아래 전환을 준비해야 한다고 본다.

> **build metadata의 canonical upstream source를 ad-hoc payload가 아니라 Build Snapshot reference-first 흐름으로 맞추는 것**

이번 WR은 즉시 코드 수정을 강제하기 위한 것이 아니라,
S2 seam이 열릴 때 S4가 어떤 입력/출력/provenance 지점을 맞춰야 하는지 미리 정렬하기 위한 요청이다.

---

## S3가 보는 S4 영향 지점

S4의 공식 계약/명세 기준으로, 영향 가능성이 큰 surface는 다음이다.

- `POST /v1/build`
- `POST /v1/build-and-analyze`
- `POST /v1/scan`
- `POST /v1/discover-targets`
- build/scan execution report
- SDK registry 기반 buildProfile 해석

특히 S4는 현재도 build metadata를 직접 소비한다.
예:
- `projectPath`
- `buildCommand`
- `compileCommands`
- `buildProfile.sdkId`
- `thirdPartyPaths`

Build Snapshot이 도입되면, 이 metadata들의 **canonical upstream source**가 S2-persisted snapshot으로 이동하게 된다.

---

## S3 기준으로 S4가 준비해야 할 최소 consumer contract

S3가 이전 WR에서 정의한 downstream minimum handoff contract를 S4 관점으로 다시 적으면 아래다.

### canonical reference
- `buildSnapshotId` reference-first
- 필요 시 `buildUnitId` 동반
- embedded snapshot object는 read model/convenience payload로만 사용 가능

### S4 consumer에 중요한 필드
- `buildSnapshotId`
- `buildUnitId`
- `snapshotSchemaVersion`
- declared build intent
  - `buildMode`
  - `sdkId` (또는 native 표기)
  - declared target/subproject identity
- actual build evidence location
  - `buildCommand`
  - `buildScript`
  - `buildDir`
  - `compileCommandsRef` 또는 동등 build evidence ref
- produced artifacts
- third-party inventory/version metadata

---

## S4에 요청하는 것

### 1. S4 consumer impact를 lane 문서/계약 관점에서 정리해 달라
S4는 현재 공식 API/spec 기준으로,
Build Snapshot reference-first 흐름이 들어오면 어떤 endpoint / execution report / observability 축이 영향을 받는지 정리해 달라.

특히 아래 질문에 답이 필요하다.

- S4가 향후 `buildSnapshotId` / `buildUnitId`를 **입력 provenance**로 받는 것이 필요한가?
- S4가 생성/반환하는 실행 결과에 snapshot provenance를 **pass-through or echo** 해야 하는가?
- `build-and-analyze` 같은 현재 편의 surface를 snapshot-first world에서 어떻게 유지/축소/전환할 것인가?

### 2. compile/build evidence 기준점을 맞춰 달라
S3는 Build Snapshot에 아래가 들어가야 한다고 이미 정의했다.

- `buildCommand`
- `buildScript`
- `buildDir`
- `compileCommandsRef` 또는 동등 build evidence ref
- produced artifacts

S4는 이 중 어떤 값을 자기가 authoritative하게 생산/검증하는지,
어떤 값은 upstream snapshot을 그대로 소비하는지 lane 관점에서 정리해 달라.

### 3. migration-safe 최소 seam 제안을 달라
S4는 현재 API를 한 번에 뒤집을 필요는 없다.
다만 S2 seam이 열릴 때, 최소한 어떤 optional input/provenance field부터 받아들이면 되는지 제안해 달라.

예시 질문:
- `buildSnapshotId`만 먼저 받으면 되는가?
- `buildSnapshotId + buildUnitId`가 필요한가?
- `buildSnapshotId + resolved build evidence fields` 형태가 migration-safe 한가?

S3는 이 구현 선택을 S4 소유로 본다.

---

## 지금 당장 요청하지 않는 것

이번 WR은 아래를 즉시 요구하지 않는다.

1. S4 코드 즉시 수정
2. S4가 S2 persistence를 직접 조회하는 구조 확정
3. 기존 `/v1/build`, `/v1/scan` 입력 shape의 즉시 breaking change
4. Build Snapshot object 전체를 S4 public API에서 즉시 노출

즉,

> **이번 요청은 S4가 앞으로의 snapshot-first consumer seam을 lane 차원에서 준비해 달라는 alignment 요청**

이다.

---

## S3 메모

S3는 S4가 현재 build/scan deterministic authority라는 점을 유지해야 한다고 본다.
따라서 이 WR은 S4의 도구 실행/분석 ownership을 바꾸려는 것이 아니라,
**upstream build provenance source를 Build Snapshot 기준으로 정렬하려는 것**이다.
