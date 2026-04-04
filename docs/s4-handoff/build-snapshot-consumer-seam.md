# S4 Build Snapshot Consumer Seam 설계 메모

> 상태: **정렬 완료 / 구현 전**
> 마지막 업데이트: **2026-04-04**
>
> 이 문서는 S3/S2가 Build Snapshot reference-first seam을 도입할 때,
> S4가 어떤 입력/출력/provenance 경계를 가져가야 하는지 S4 관점에서 정리한 설계 메모다.
> **현재 API 계약을 즉시 바꾸는 문서가 아니다.**

---

## 1. 현재 상태

현재 S4의 build/scan consumer surface는 ad-hoc execution payload를 직접 소비한다.

핵심 입력:
- `projectPath`
- `buildCommand`
- `compileCommands`
- `buildProfile.sdkId`
- `thirdPartyPaths`

핵심 출력:
- `/v1/build`: `compileCommandsPath`, `entries`, `userEntries`, `exitCode`, `buildOutput`, `elapsedMs`
- `/v1/scan`: findings + `execution`
- `/v1/build-and-analyze`: build 결과 + scan/codeGraph/libraries/metadata
- `/v1/discover-targets`: `relativePath`, `buildSystem`, `buildFile`, `detectedBuildCommand`

즉, S4는 현재 **snapshot identity consumer** 가 아니라
**concrete build evidence / execution payload consumer + producer** 이다.

---

## 2. snapshot-first world에서 S4 역할

Build Snapshot 도입 후에도 S4의 핵심 역할은 바뀌지 않는다.

### 유지되는 역할
- 결정론적 build/scan 실행
- compile/build evidence 검증
- SAST / code graph / SCA / metadata 생성
- SDK 해석과 tool execution authority

### 바뀌는 점
- upstream build provenance의 canonical source가 ad-hoc payload가 아니라
  **S2-persisted Build Snapshot** 으로 이동한다.
- S4는 snapshot persistence owner가 아니라,
  **snapshot을 소비하는 deterministic worker** 가 된다.

---

## 3. authoritative vs pass-through 경계

### upstream snapshot / orchestration authority (S2 중심)

S4가 authoritative하지 않은 것:
- `buildSnapshotId`
- `buildUnitId`
- `snapshotSchemaVersion`
- lineage (`sourceBuildAttemptId`, parent/child 관계)
- declared build intent의 canonical persistence object

이 필드들은 S4가 **생성**하기보다,
상위 orchestrator가 넘긴 값을 **pass-through / echo** 하는 것이 맞다.

### S4 execution authority

S4가 직접 생산/검증하는 evidence:
- 실제 실행된 `buildCommand` (또는 auto-detected command)
- 실제 build 작업 디렉토리
- `compileCommandsPath`
- build `exitCode`
- `buildOutput`
- `entries`, `userEntries`
- scan execution metadata (`toolsRun`, `toolResults`, filtering)
- 필요 시 produced artifacts 탐지 결과

즉:

> **snapshot identity는 upstream canonical object가 authoritative하고,**
> **실제 build/scan execution evidence는 S4가 authoritative하다.**

---

## 4. endpoint별 영향

| surface | snapshot-first 영향 | S4 권장 방향 |
|---|---|---|
| `/v1/build` | build 결과를 snapshot으로 persist하기 위한 producer evidence 제공 필요 | optional provenance echo + build evidence 명확화 |
| `/v1/scan` | persisted snapshot을 기준으로 분석 시작 가능 | optional snapshot reference 수용 + execution/provenance echo |
| `/v1/build-and-analyze` | build와 analysis를 한 번에 묶는 convenience surface | canonical orchestration에서는 축소, transitional/manual helper로 유지 |
| `/v1/discover-targets` | stable target identity 필요 | S4는 deterministic locator 제공, durable `buildUnitId` mint는 S2가 담당 |

---

## 5. S4가 수용할 migration-safe 최소 seam

S4는 현재 S2 persistence를 직접 조회하지 않는다.
따라서 아래 원칙이 필요하다.

### 원칙

`buildSnapshotId` **만으로는 충분하지 않다.**

이유:
- S4에는 snapshot lookup API가 없다
- 실제 도구 실행에는 concrete evidence가 필요하다

### 권장 최소 seam

상위 호출자는 아래를 함께 보내는 것이 안전하다.

#### A. canonical reference
- `buildSnapshotId`
- `buildUnitId`
- `snapshotSchemaVersion`

#### B. resolved execution evidence
- `projectPath`
- `compileCommands` 또는 동등 evidence ref
- 필요 시 `buildCommand`
- 필요 시 `buildProfile.sdkId`
- 필요 시 `thirdPartyPaths`

권장 shape는 flat field보다 **nested `provenance` object** 다.

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

즉, 현 단계 S4 권장안은:

> **`buildSnapshotId + buildUnitId + snapshotSchemaVersion + resolved evidence fields`**

이다.

`buildSnapshotId` 단독, 또는 `buildSnapshotId + buildUnitId`만으로는
현재 S4에 충분하지 않다.

---

## 6. provenance echo 원칙

S4는 consumer 관점에서 받은 snapshot provenance를
**수정 없이 echo/pass-through** 하는 것이 적절하다.

권장 echo 위치:
- `/v1/build` 응답의 별도 `provenance` 블록
- `/v1/scan` 응답의 `execution.provenance`
- 향후 `/v1/functions`, `/v1/libraries`, `/v1/metadata`에도 필요 시 동일 패턴 적용

단, 아래는 S4가 임의 생성하면 안 된다.
- `buildSnapshotId`
- `buildUnitId`
- schema/version/lineage 값

S4는 받은 값만 echo하고,
실제 실행 결과는 별도 evidence 블록으로 반환하는 구조가 가장 안전하다.

---

## 7. `/v1/build-and-analyze`에 대한 S4 입장

`/v1/build-and-analyze`는 현재 편의 surface로는 유효하다.
하지만 snapshot-first architecture에서 canonical path로 두는 것은 바람직하지 않다.

### 이유
- build와 analysis는 계약/증적 관점에서 분리된 stage여야 함
- snapshot persistence boundary를 우회하면 provenance canonical source가 다시 흐려짐
- upstream orchestration이 `build` 성공 → snapshot persist → `scan`/`functions`/`libraries`로 이어져야 audit가 명확함

### S4 권장 방향
- 유지: manual helper / local convenience / transitional surface
- 축소: canonical orchestration surface
- 장기 권장 path:
  1. `/v1/build`
  2. upstream snapshot persist
  3. `/v1/scan`, `/v1/functions`, `/v1/libraries`, `/v1/metadata`

---

## 8. `/v1/discover-targets`와 `buildUnitId`

S4는 파일시스템 기반으로 deterministic target locator를 제공할 수 있다.

현재 제공값:
- `name`
- `relativePath`
- `buildSystem`
- `buildFile`
- `detectedBuildCommand`

S4 판단:
- durable `buildUnitId`를 **S4가 mint하는 것은 적절하지 않다**
- S4는 target locator / hint를 제공하고,
  S2가 이를 canonical `buildUnitId`로 승격하는 구조가 맞다

즉:

> **discover-targets는 identity source가 아니라 identity hint source** 로 유지한다.

---

## 9. 관련 runtime issue와 seam 연계

### SDK env `exitCode=127`

의미:
- snapshot seam과 별개로,
  S4 build evidence가 지금보다 더 명시적으로 실패 원인을 드러내야 한다

후속 runtime 작업:
- env-setup 실패 분류
- host dependency / shared library load 오류 메시지 개선
- build evidence 블록에 env-setup provenance 보강

### 대형 프로젝트 stall / timeout-floor

의미:
- snapshot seam과 별개로,
  상위 호출자가 long-running degraded scan과 실제 hang를 구분할 수 있어야 한다

후속 runtime 작업:
- heavy analyzer vendor policy 재검토
- timedOutFiles / degraded 상태 / budget 경고 가시화
- heartbeat/실행 보고서 보강

---

## 10. 결론

S4의 현재 입장은 아래로 요약된다.

1. **snapshot identity는 upstream canonical object가 authoritative하다**
2. **S4는 execution evidence authority를 유지한다**
3. **현 단계 migration-safe seam은 reference-only가 아니라 reference + concrete evidence 혼합형이다**
4. **`/v1/build-and-analyze`는 convenience surface로 남기되 canonical orchestration path에서는 축소하는 것이 맞다**
5. **`buildUnitId`는 S4가 mint하지 않고 S2가 durable identity로 관리하는 것이 맞다**
