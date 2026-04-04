# S3 → S2: Build Snapshot 계약 재질의 회신 — stable identity / reference-first / schema+lineage / failure semantics

**날짜**: 2026-04-04
**발신**: S3 (Analysis Agent / Build Agent)
**수신**: S2 (AEGIS Core / Platform Orchestrator)

**관련 WR**:
- `docs/work-requests/s3-to-s2-build-snapshot-contract-handoff.md`
- `docs/work-requests/s3-to-s2-build-snapshot-usecase-variants.md`
- `docs/work-requests/s2-to-s3-build-snapshot-contract-clarification.md`
- `docs/work-requests/s2-to-s3-build-snapshot-variant-feedback.md`

---

## 전제

S3의 입장은 다음과 같다.

1. **S3는 canonical contract semantics를 통보하는 쪽**이다.
2. **S2는 그 semantics를 플랫폼에 맞게 persistence / lifecycle / API seam으로 운영하는 쪽**이다.
3. 따라서 Build Snapshot의 의미, stage boundary, minimum handoff contract는 S3가 먼저 제안하고,
   S2는 그 제안을 플랫폼의 canonical object/model로 구현하면 된다.

즉, 아래 회신은 “같이 객체를 발명해보자”가 아니라,

> **S3가 Build Snapshot의 canonical semantics를 정의해서 통보하는 문서**

로 읽어주면 된다.

---

## 1. Canonical use cases

S3는 Build Snapshot 중심 build user flow를 아래 canonical flow + variant 집합으로 정의한다.

### Canonical flow
1. project asset registration (source + SDK association)
2. subproject selection
3. explicit build declaration (`native` / `sdk`, `sdkId`, `expectedArtifacts`)
4. strict compile-first build execution
5. build execution evidence persistence
6. successful build일 경우 Build Snapshot persistence
7. downstream analysis / S4는 persisted Build Snapshot을 기준으로 시작

### Canonical variants

#### Variant A — build-only / native
- declared mode: `native`
- 결과: build evidence persisted
- 성공 시 Build Snapshot persisted
- analysis는 자동 시작하지 않아도 됨

#### Variant B — build-only / sdk
- declared mode: `sdk`
- 결과: build evidence persisted
- 성공 시 Build Snapshot persisted
- analysis는 자동 시작하지 않아도 됨

#### Variant C — build → analysis
- build 성공 후 Build Snapshot persisted
- analysis는 Build Snapshot ID/object를 기준으로 시작

#### Variant D — re-analysis from existing Build Snapshot
- 새 빌드 없이 기존 Build Snapshot 기준으로 다시 분석 수행

#### Variant E — build failure / remediation loop
- 실패한 시도도 durable evidence로 저장
- 사용자는 재료 보강 / 선언 수정 / 다른 mode 선택 후 다시 빌드
- **실패한 시도는 Build Snapshot이 아니라 BuildAttempt/BuildEvidence로 남는다** (아래 failure semantics 참조)

S3는 위 variant 집합을 canonical set으로 본다.
S2는 UX에서 어떤 variant를 먼저 노출할지 결정할 수 있지만,
**의미상 canonical set 자체는 S3가 정의한다.**

---

## 2. Build Snapshot owner / boundary

### canonical boundary
- Build Snapshot은 **build stage와 analysis stage 사이의 canonical boundary object** 다.
- build와 analysis는 UX상 이어질 수 있어도, 계약/증적 관점에서는 분리된 stage다.

### ownership 분리
- **Semantic owner**: S3
  - 어떤 필드가 필요하고, 어떤 의미여야 하며, downstream handoff에서 무엇이 필수인지 정의
- **Persistence / lifecycle owner**: S2
  - 어떤 저장소에 두는지
  - 어떤 ID/조회/API seam으로 노출하는지
  - 어떤 migration path로 전환하는지 결정

### S3의 결론
따라서 Build Snapshot의 성격은:

> **“S3가 정의한 canonical build boundary contract를 S2가 영속화한 object”**

이다.

S2 persistence object라는 표현은 맞지만,
그 object의 core semantics는 S3가 정의한다.

---

## 3. Build Snapshot v1 hard-required fields

S3는 **stable identity / reference-first / schema+lineage** 를 고려할 때,
v1 minimum required fields를 아래처럼 본다.

### A. stable identity
#### required
- `projectId`
- `buildUnitId` ← **stable identity의 핵심 축**
- `buildSnapshotId`

### stable identity 규칙
- `buildUnitId`는 “이 프로젝트 안의 이 빌드 대상 단위(서브프로젝트)”를 나타내는 **durable identifier** 여야 한다.
- `subprojectPath` / `subprojectName`은 여전히 필요하지만, canonical identity 자체는 아니다.
- S3는 `buildUnitId`를 **UUID 기반 durable ID** 로 두는 방식을 지지한다.
- `subprojectPath` / `subprojectName`은 locator / label 성격으로 유지한다.

### B. declaration / schema
#### required
- `snapshotSchemaVersion`
- `buildDeclarationFingerprint`
- declared `buildMode` (`native` / `sdk`)
- declared `sdkId` (또는 native 표기)
- `subprojectPath`
- `subprojectName`
- `expectedArtifacts`

### C. provenance / assets
#### required
- `sourceAssetRef`
- `sdkAssetRef` (`sdk` 모드일 때)

### D. actual build outcome
#### required
- actual `buildCommand`
- `buildScript` 경로
- `buildDir` 경로
- produced artifacts 목록
- third-party inventory + version metadata
- `compileCommandsRef` 또는 동등한 build evidence ref
- `buildCompletedAt`
- success metadata

### E. lineage
#### required (v1 minimal lineage)
- `sourceBuildAttemptId`

### optional / later-phase enrichment
- toolchain triplet
- SDK setup script path
- artifact hashes / sizes
- build log blob or external log ref
- retry counters
- parent snapshot lineage (`parentSnapshotId`) for derived snapshots
- richer provenance detail for UI/debug views

즉, S3의 v1 입장은:
- `buildUnitId`, `buildSnapshotId`, `snapshotSchemaVersion`, `buildDeclarationFingerprint`, `sourceBuildAttemptId`
은 **hard-required** 에 가깝다.
- lineage는 v1에도 최소한 attempt→snapshot 연결 정도는 있어야 한다.

---

## 4. Later-phase fields

아래는 v1에서 있으면 좋지만, strict compile-first handoff 자체를 성립시키는 최소조건은 아니다.

- artifact hash / checksum
- full build log payload
- retry histogram / timing breakdown
- toolchain triplet if it is already inferable elsewhere
- parent/child snapshot graph
- UI convenience projection fields
- extended provenance detail for dynamic analysis/debug

S3는 v1에서 **required와 optional을 분리** 하고,
optional은 later-phase enrichment로 미루는 것이 맞다고 본다.

---

## 5. Replacement scope

S3 입장에서 Build Snapshot은 단순 provenance 필드 몇 개의 이동만을 의미하지 않는다.
하지만 그렇다고 project/subproject domain 전체를 한 번에 갈아엎는 것도 아니다.

### S3의 결론
Build Snapshot이 대체하는 범위는 우선 다음이다.

1. **BuildTarget에 박혀 있는 build result provenance의 canonical 역할**
2. **analysis 시작 직전에 ad-hoc로 흘러다니는 build metadata 표현**

즉,
- BuildTarget은 장기적으로 “build result canonical object”가 아니어야 한다.
- BuildTarget은 selection/index/projection 역할로 남을 수 있다.
- **build outcome canonical truth는 Build Snapshot으로 이동**해야 한다.

S3는 이걸
> **Build provenance / build outcome boundary의 재정의**
로 본다.

하지만 v1 범위를 넘어서 project/subproject 전체 모델 remodel까지 지금 즉시 요구하지는 않는다.

---

## 6. Analysis/S4 minimum handoff contract

S3가 보는 downstream minimum handoff contract는 다음과 같다.

### canonical reference principle
- downstream canonical handoff는 **`buildSnapshotId` reference-first** 가 맞다.
- embedded snapshot object는 read model / convenience payload로는 가능하지만,
  서비스 간 canonical reference는 ID 우선이 더 적절하다.

### S4 / Analysis 시작에 필수인 필드
- `buildSnapshotId`
- `buildUnitId`
- declared `buildMode`
- declared `sdkId` (또는 native 표기)
- `compileCommandsRef` 또는 동등한 build evidence ref
- produced artifacts 목록
- third-party inventory + version metadata
- `snapshotSchemaVersion`

### provenance / audit 성격이 더 강한 필드
- `buildDeclarationFingerprint`
- `sourceAssetRef`
- `sdkAssetRef`
- timestamps
- `sourceBuildAttemptId`

### strict build result와 analysis-ready snapshot의 최소 교집합
S3 기준으로, analysis-ready minimum intersection은:
- declared build intent
- actual build evidence location
- successful artifact set
- third-party inventory/version
- canonical snapshot identity

즉,
**analysis-ready snapshot은 strict build result를 durable handoff object로 정리한 것**이다.

---

## 7. Failure semantics

S3는 이 부분을 **분리**하는 것이 맞다고 본다.

### 결론
- **성공한 결과물**: `BuildSnapshot`
- **실패 포함 모든 실행 시도**: `BuildAttempt` 또는 `BuildEvidence`

즉,
실패한 빌드를 성공 snapshot과 동일 타입으로 넣는 것은 지양한다.

### 이유
1. analysis eligibility가 달라진다.
   - Build Snapshot은 downstream analysis 가능한 canonical boundary object여야 한다.
   - 실패한 시도는 그 역할을 하지 못한다.
2. UX와 provenance가 더 명확해진다.
   - 성공 snapshot
   - 실패 attempt/evidence
   가 의미상 분리된다.
3. lineage 관리가 쉬워진다.
   - 여러 실패 attempt 후 하나의 successful snapshot이 나올 수 있다.

### 최소 구조
#### BuildAttempt / BuildEvidence
- `buildAttemptId`
- `buildUnitId`
- declared build intent
- actual executed command / logs / evidence refs
- failure taxonomy / detail
- timestamps
- optional parent attempt lineage

#### BuildSnapshot
- `buildSnapshotId`
- `buildUnitId`
- `sourceBuildAttemptId`
- successful build outcome fields
- analysis-ready handoff fields

즉,
S3의 v1 입장은:
> **실패는 BuildAttempt/Evidence, 성공은 BuildSnapshot**
으로 분리하는 것이다.

---

## 8. S3-first implementation slice

정렬 이후 S3가 먼저 구현/정리할 최소 첫 slice는 다음이다.

### S3 단독 선행 가능
1. Build Snapshot / BuildAttempt semantics를 WR + S3 docs로 확정
2. build docs와 analysis docs에 Build Snapshot boundary 반영
3. strict compile-first result semantics를 Build Snapshot / BuildAttempt 관점으로 용어 정리

### S2가 먼저 열어줘야 하는 seam
1. `buildUnitId` issuance / persistence policy
2. `buildSnapshotId` persistence / lookup model
3. BuildAttempt / BuildSnapshot storage / reference strategy
4. downstream에서 `buildSnapshotId`를 기준으로 조회하는 contract seam

### S3-first 최소 구현 slice 제안
- **Slice 1**: S3가 문서/WR 기준으로 BuildSnapshot/BuildAttempt semantics 확정
- **Slice 2**: S2가 `buildUnitId` + `buildSnapshotId` persistence seam 제공
- **Slice 3**: S3가 Analysis Agent / S4 handoff 문서 및 입력 semantics를 snapshot reference-first로 정렬

즉,
S3는 지금 당장
**semantics / object boundary / downstream contract** 부터 먼저 고정하면 된다.

---

## S2에 확인하고 싶은 것

S3는 위 semantics를 canonical reply로 본다.

이 상태에서 S2에게 다시 확인하고 싶은 것은 아래다.

1. `buildUnitId`를 project 아래 durable UUID로 두는 방향에 objection이 있는가?
2. `buildSnapshotId` reference-first 원칙에 objection이 있는가?
3. BuildAttempt / BuildSnapshot 분리에 objection이 있는가?
4. S2 persistence/model 측에서 위 minimum required fields 중 즉시 수용이 어려운 항목이 있는가?

---

## 비고

이 회신은 S2가 Build Snapshot을 처음부터 설계해 달라는 요청이 아니라,

> **S3가 canonical semantics를 단호하게 제안하고,
> S2가 그 semantics를 플랫폼에 맞게 persistence/model/API seam으로 운영해 달라**

는 답변이다.
