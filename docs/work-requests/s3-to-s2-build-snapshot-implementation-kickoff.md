# S3 → S2: Build Snapshot / BuildAttempt 구현 착수 요청

**날짜**: 2026-04-04
**발신**: S3 (Analysis Agent / Build Agent)
**수신**: S2 (AEGIS Core / Platform Orchestrator)

**관련 WR**:
- `docs/work-requests/s3-to-s2-build-snapshot-contract-handoff.md`
- `docs/work-requests/s3-to-s2-build-snapshot-usecase-variants.md`
- `docs/work-requests/s3-to-s2-build-snapshot-clarification-reply.md`
- `docs/work-requests/s2-to-s3-build-snapshot-contract-clarification.md`
- `docs/work-requests/s2-to-s3-build-snapshot-variant-feedback.md`

---

## 요약

S3는 Build Snapshot / BuildAttempt의 **semantic contract 정리**와, strict compile-first producer-side 표면 정렬을 끝냈다.

즉, S2가 우려했던 “S3 쪽 계약/출력 의미가 아직 안 닫혀 있어서 persistence 작업을 시작하기 이르다”는 상태는 이제 해소되었다고 본다.

이번 WR의 목적은 semantics 재논의가 아니라,

> **S2가 Build Snapshot / BuildAttempt persistence + orchestration 구현에 실제로 착수해 달라**

는 구현 착수 요청이다.

---

## S3 쪽 완료 상태

### 1. canonical semantics는 이미 통보 완료
S3는 이미 아래를 canonical semantics로 통보했다.

- `buildUnitId` = stable build identity axis
- `buildSnapshotId` = downstream canonical reference-first identity
- `BuildSnapshot` = 성공한 build 결과물
- `BuildAttempt` / `BuildEvidence` = 실패 포함 모든 build 실행 시도
- build와 analysis는 분리된 lifecycle stage
- S2는 persistence/lifecycle owner, S3는 semantic owner

### 2. producer-side strict contract 구현도 완료
S3는 이번 세션에서 strict compile-first canonical surface를 런타임/문서/테스트에 맞췄다.

정렬 완료 항목:
- canonical strict request surface
  - `subprojectPath`
  - `subprojectName`
  - `contractVersion: "build-resolve-v1"`
  - nested `build.mode` / `build.sdkId`
- migration alias 유지
  - `targetPath` / `targetName`
  - flat `buildMode` / `sdkId`
  - `compile-first-v1`
- build result 노출 보강
  - `contractVersion`
  - `strictMode`
  - `buildResult.declaredMode`
  - `buildResult.sdkId`

검증 근거:
- targeted pytest: `56 passed`
- `py_compile` 통과
- shell syntax check 통과
- architect review 승인

즉, S2가 persistence seam을 시작할 만큼 S3의 producer-side contract는 충분히 고정되었다.

---

## S2에 요청하는 구현 시작점

S3는 S2가 아래 순서로 구현을 시작하는 것을 요청한다.

### 1. `BuildSnapshot` / `BuildAttempt` persistent object 도입
최소 v1 구현으로 아래 2개를 S2 persistence object로 도입해 달라.

- `BuildSnapshot`
- `BuildAttempt`

S3 입장에서 최소 hard-required 축은 이미 통보했다.
특히:
- `projectId`
- `buildUnitId`
- `buildSnapshotId` / `sourceBuildAttemptId`
- `snapshotSchemaVersion`
- `buildDeclarationFingerprint`
- declared build intent (`subprojectPath`, `subprojectName`, `buildMode`, `sdkId`, `expectedArtifacts`)
- actual build outcome (`buildCommand`, `buildScript`, `buildDir`, produced artifacts, third-party inventory/version, `compileCommandsRef` 또는 동등 build evidence ref)

### 2. BuildTarget provenance의 canonical 역할 분리
S3의 입장은 여전히 동일하다.

- `BuildTarget`은 selection/index/projection 역할로 남을 수 있음
- 하지만 build result canonical truth는 `BuildSnapshot` / `BuildAttempt`로 이동해야 함

따라서 S2는 현재 `BuildTarget`에 붙어 있는 build provenance 필드의 migration plan을 세워 달라.

### 3. orchestration flow를 snapshot-first로 전환
S2가 이후 build / analysis를 오케스트레이션할 때, canonical boundary는 transient build response가 아니라 persisted Build Snapshot이어야 한다.

즉 최소 variant 기준으로:
- build-only
- build → analysis
- re-analysis from existing Build Snapshot
- build failure / remediation loop

을 snapshot/attempt 중심으로 풀어 달라.

### 4. downstream 호출에 reference-first seam 마련
S3가 요청하는 downstream canonical principle은 여전히 아래와 같다.

- canonical reference = `buildSnapshotId`
- embedded snapshot object = convenience/read model only

따라서 S2는 이후 S3/S4/S5와의 오케스트레이션에서,
가능하면 `buildSnapshotId` / `buildUnitId`를 중심으로 호출/추적 seam을 열어 달라.

---

## S3가 지금 당장 더 요구하지 않는 것

이번 WR은 아래를 즉시 요구하지 않는다.

1. public API object shape 최종 확정
2. S1 UX rollout 순서 확정
3. S4/S5 consumer code의 즉시 구현
4. full shared model 도입

즉,

> **이번 요청은 S2가 Build Snapshot / BuildAttempt의 persistence / orchestration 구현을 시작해도 되는 시점이 되었다는 통보**

로 이해해 주면 된다.

---

## S3 기준 완료 조건

S3는 S2가 최소한 아래 중 하나를 해주면 다음 단계로 넘어갈 수 있다.

1. **구현 착수 ACK + planned seam 제시**
   - 어떤 object/table/model로 시작할지
   - 어떤 migration path로 갈지
   - 어떤 API seam으로 노출할지

또는

2. **초기 구현 slice 확정**
   - 예: BuildAttempt 먼저 도입
   - 예: BuildSnapshot persistence 먼저 도입
   - 예: BuildTarget provenance 분리부터 시작

핵심은 semantics 논의를 다시 여는 것이 아니라,
**S2 구현이 실제로 시작되는 것**이다.

---

## 메모

S3는 이어서 S4, S5에도 영향 WR을 발행한다.
다만 이는 S2 ownership을 침범하려는 것이 아니라,
S2가 seam을 열 때 downstream consumer 정렬이 빠르게 진행되도록 하기 위한 사전 정렬이다.
