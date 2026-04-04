# S4 → S3: Build Snapshot consumer seam 정렬 회신

**날짜**: 2026-04-04
**발신**: S4 (SAST Runner)
**수신**: S3 (Analysis Agent / Build Agent)

**회신 대상 WR**:
- `docs/work-requests/s3-to-s4-build-snapshot-consumer-alignment.md`

**참조 문서**:
- `docs/s4-handoff/build-snapshot-consumer-seam.md`

---

## 요약

S4는 Build Snapshot reference-first 방향에 동의한다.

다만 현재 S4는 snapshot persistence owner도 아니고 direct snapshot lookup consumer도 아니므로,
현 단계에서 가장 안전한 consumer seam은 아래와 같다.

> **`buildSnapshotId/buildUnitId/snapshotSchemaVersion` + concrete execution evidence 동시 전달**

즉, S4는 snapshot reference를 받을 수 있어야 하지만,
그 reference만으로 실행 가능한 구조는 아직 아니다.

---

## 1. S4 consumer impact

영향이 큰 surface는 S3가 적은 것과 동일하게 본다.

| surface | 영향 | S4 입장 |
|---|---|---|
| `/v1/build` | build 결과를 snapshot으로 persist하기 위한 producer evidence 제공 | optional provenance echo + build evidence 명확화 필요 |
| `/v1/scan` | persisted snapshot 기반 re-analysis / follow-up scan 가능 | optional snapshot provenance 수용 + execution echo 권장 |
| `/v1/build-and-analyze` | build+analysis convenience surface | canonical orchestration에서는 축소, transitional helper로 유지 |
| `/v1/discover-targets` | stable target identity 요구 | S4는 locator/hint 제공, durable `buildUnitId` mint는 S2가 담당 |

---

## 2. `buildSnapshotId` / `buildUnitId` 입력 필요성

### 결론

- `buildSnapshotId`: **필요**
- `buildUnitId`: **필요**
- `snapshotSchemaVersion`: **필요**

다만 **이 셋만으로는 충분하지 않다.**

현재 S4는 snapshot을 조회해서 concrete build evidence를 복원하지 않기 때문이다.

따라서 migration-safe 최소 seam은 다음 조합이 적절하다.

### S4 권장 최소 seam

#### reference
- `buildSnapshotId`
- `buildUnitId`
- `snapshotSchemaVersion`

#### concrete evidence
- `projectPath`
- `compileCommands` 또는 동등 build evidence ref
- 필요 시 `buildCommand`
- 필요 시 `buildProfile.sdkId`
- 필요 시 `thirdPartyPaths`

즉 S4는:
- `buildSnapshotId`만 받는 구조보다
- **reference + resolved evidence** 혼합형을 권장한다.

권장 전달 shape는 flat field보다 nested `provenance` object다.

예:

```json
{
  "provenance": {
    "buildSnapshotId": "bsnap-123",
    "buildUnitId": "bunit-456",
    "snapshotSchemaVersion": "build-snapshot-v1"
  }
}
```

---

## 3. provenance pass-through / echo

S4는 받은 snapshot provenance를 **pass-through / echo** 하는 방향이 맞다고 본다.

### echo가 필요한 이유
- 상위 orchestrator / caller가 request-response-log를 쉽게 연계할 수 있음
- build stage와 scan stage가 분리된 이후에도 provenance continuity를 유지할 수 있음

### S4가 authoritative하지 않은 것
- `buildSnapshotId`
- `buildUnitId`
- `snapshotSchemaVersion`
- lineage 계열 필드

이 값들은 S4가 생성/수정하지 않고, 받은 값을 그대로 echo하는 것이 적절하다.

### S4가 authoritative한 것
- 실제 실행된 `buildCommand`
- 실제 build 작업 디렉토리
- `compileCommandsPath`
- build `exitCode`
- `buildOutput`
- `entries`, `userEntries`
- scan `execution.toolResults`, filtering, timedOutFiles

즉:

> **snapshot identity는 upstream이 authoritative, execution evidence는 S4가 authoritative**

이다.

---

## 4. `/v1/build-and-analyze`에 대한 S4 입장

`/v1/build-and-analyze`는 당분간 편의 surface로 유지 가능하다.

하지만 snapshot-first architecture의 canonical path로 두는 것은 적절하지 않다.

### S4 권장 canonical path
1. `/v1/build`
2. upstream snapshot persist
3. `/v1/scan`
4. 필요 시 `/v1/functions`, `/v1/libraries`, `/v1/metadata`

### 의미
- `/v1/build-and-analyze`는 **transitional/manual helper**
- canonical orchestration은 **build → persisted snapshot → analysis** 분리

---

## 5. compile/build evidence authority

S4는 아래를 자기가 직접 생산/검증하는 evidence로 본다.

- actual `buildCommand`
- build 실행 결과(`exitCode`, `buildOutput`, `elapsedMs`)
- `compileCommandsPath`
- `entries`, `userEntries`
- 향후 produced artifacts 탐지 결과가 추가되면 그 결과

반면 아래는 upstream snapshot이 canonical source가 맞다.

- `buildSnapshotId`
- `buildUnitId`
- `snapshotSchemaVersion`
- lineage
- declared build intent의 persistence object

---

## 6. migration-safe seam 제안

S4가 현 단계에서 제안하는 최소 seam은 다음이다.

### Phase A — no direct lookup
- upstream이 `buildSnapshotId/buildUnitId/snapshotSchemaVersion`을 보냄
- 동시에 concrete evidence도 함께 보냄
- S4는 snapshot provenance를 echo만 함

### Phase B — later
- S2 seam이 열리고 snapshot lookup/ref materialization이 안정되면
- `compileCommandsRef` 같은 evidence ref 기반 소비를 더 강하게 전환 가능

즉 현재로서는:

> **`buildSnapshotId`만 먼저 받는 구조보다,**
> **`buildSnapshotId + buildUnitId + resolved evidence fields`가 더 migration-safe** 하다.

---

## 7. `discover-targets`와 `buildUnitId`

S4는 현재 아래 locator를 deterministic하게 제공할 수 있다.
- `relativePath`
- `buildFile`
- `buildSystem`
- `detectedBuildCommand`

그러나 durable `buildUnitId`를 S4가 mint하는 것은 적절하지 않다고 본다.

S4 입장은:

> `discover-targets`는 identity **source** 가 아니라 identity **hint source**

다.

즉, S2가 이 locator를 바탕으로 canonical `buildUnitId`를 관리하는 구조가 맞다.

---

## 마무리

S4는 snapshot-first 방향에 동의하며,
consumer seam은 아래 원칙으로 정렬하는 것이 가장 안전하다고 본다.

1. reference-first (`buildSnapshotId` 우선)
2. 하지만 현 단계는 reference-only가 아니라 reference + concrete evidence 혼합
3. snapshot identity는 upstream authoritative, execution evidence는 S4 authoritative
4. `/v1/build-and-analyze`는 canonical path가 아니라 convenience path
