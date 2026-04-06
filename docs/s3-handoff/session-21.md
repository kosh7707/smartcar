# S3 세션 21 — 2026-04-04

## 세션 요약

S2의 Build Snapshot 관련 재질의 WR 2건을 읽고, S3의 권한 모델을 명확히 한 뒤 회신 초안을 작성했다.

이번 세션의 핵심은 다음과 같다.

1. **권한 모델 재정렬**
   - S3는 canonical contract semantics를 **통보하는 쪽**
   - S2는 그 semantics를 platform persistence / lifecycle / API seam으로 **운영하는 쪽**

2. **S2 회신 요구를 4개 축으로 재정리**
   - stable identity
   - reference-first
   - schema + lineage
   - failure semantics

3. **S3의 canonical reply를 WR로 작성**
   - `docs/work-requests/s3-to-s2-build-snapshot-clarification-reply.md`

---

## S3가 이번 세션에서 확정한 semantic 답변

### 1. canonical use cases
S3는 Build Snapshot 중심 build user flow를 아래 canonical flow + variant 집합으로 정의한다.

- project asset registration
- subproject selection
- explicit build declaration
- strict compile-first build execution
- build execution evidence persistence
- successful build일 경우 Build Snapshot persistence
- downstream analysis / S4는 persisted Build Snapshot 기준으로 시작

허용 variant:
- build-only / native
- build-only / sdk
- build → analysis
- re-analysis from existing Build Snapshot
- build failure / remediation loop

### 2. owner / boundary
- semantic owner: **S3**
- persistence / lifecycle owner: **S2**
- Build Snapshot은 “S3가 정의한 canonical build boundary contract를 S2가 영속화한 object”로 정리

### 3. stable identity
- canonical identity axis는 `buildUnitId`
- `buildUnitId`는 project 아래 subproject/build unit의 durable identity
- S3는 `buildUnitId`를 **UUID 기반 durable ID**로 두는 방향을 지지
- `subprojectPath` / `subprojectName`은 locator / label 성격

### 4. reference-first
- downstream canonical handoff는 **`buildSnapshotId` reference-first**
- embedded snapshot object는 convenience/read model 수준으로만 허용 가능

### 5. schema + lineage
v1 hard-required에 가깝다고 본 항목:
- `buildUnitId`
- `buildSnapshotId`
- `snapshotSchemaVersion`
- `buildDeclarationFingerprint`
- `sourceBuildAttemptId`

그 외 required:
- declared build mode / sdkId
- subprojectPath / subprojectName
- expectedArtifacts
- source/sdk asset refs
- actual build command/script/dir
- produced artifacts
- third-party inventory + version metadata
- compileCommandsRef 또는 동등 build evidence ref
- buildCompletedAt / success metadata

later-phase enrichment:
- artifact hash / checksum
- full build log payload
- retry histogram / timing breakdown
- parent snapshot lineage
- richer provenance detail

### 6. replacement scope
Build Snapshot이 우선 대체하는 범위:
1. BuildTarget에 박혀 있는 build result provenance의 canonical 역할
2. analysis 시작 직전 ad-hoc build metadata 표현

즉, BuildTarget은 장기적으로 canonical build result object가 아니어야 한다.

### 7. failure semantics
- 성공한 결과물: `BuildSnapshot`
- 실패 포함 모든 실행 시도: `BuildAttempt` 또는 `BuildEvidence`

즉,
**실패를 성공 snapshot과 같은 타입으로 넣지 않는다.**

---

## 이번 세션 산출물

### 1. context / interview / spec
- `.omx/context/s2-build-snapshot-reply-20260404T064514Z.md`
- `.omx/interviews/s2-build-snapshot-reply-20260404T064514Z.md`
- `.omx/specs/deep-interview-s2-build-snapshot-reply.md`

### 2. S2용 회신 WR
- `docs/work-requests/s3-to-s2-build-snapshot-clarification-reply.md`

이 WR은 S2에 대해:
- canonical flow
- variant 집합
- owner/boundary
- v1 minimum required fields
- later-phase fields
- replacement scope
- Analysis/S4 minimum handoff contract
- failure semantics
- S3-first implementation slice
를 명시적으로 답한다.

---

## 검증 상태

- deep-interview ambiguity: `0.14`
- threshold: `0.20`
- gate 충족:
  - non-goals explicit
  - decision boundaries explicit
  - pressure pass complete

문서 검증:
- `git diff --check` 예정/필수
- WR 초안 존재 및 핵심 키워드 포함 확인 필요

---

## 남은 후속 과제

1. S2가 `buildUnitId` / `buildSnapshotId` / BuildAttempt 분리에 동의하는지 확인
2. analysis-agent 쪽 docs/API에 Build Snapshot boundary를 반영할지 결정
3. 이후 필요 시 S2 회신을 기반으로 canonical wording / field refinement 진행
