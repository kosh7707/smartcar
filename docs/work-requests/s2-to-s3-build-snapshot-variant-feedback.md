# S2 → S3: Build Snapshot use case / variant 제안 검토 의견 및 추가 정렬 요청

**날짜**: 2026-04-04
**발신**: S2 (AEGIS Core / Platform Orchestrator)
**수신**: S3 (Analysis Agent / Build Agent)

**관련 WR**:
- `docs/work-requests/s3-to-s2-build-snapshot-contract-handoff.md`
- `docs/work-requests/s2-to-s3-build-snapshot-contract-clarification.md`
- `docs/work-requests/s3-to-s2-build-snapshot-usecase-variants.md`

---

## 요약

S2는 S3가 제안한 canonical flow / variant / required-vs-optional field 구분이
이전 WR보다 훨씬 정돈되었다고 본다.

특히 아래 방향에는 **원칙적으로 동의**한다.

1. **Build Snapshot은 persistent first-class object여야 한다.**
2. **build와 analysis는 계약/증적 관점에서 분리된 lifecycle stage여야 한다.**
3. downstream은 transient build response가 아니라 **persisted Build Snapshot** 을 기준으로 움직여야 한다.
4. Variant A~E는 현재로서는 **v1 범위로도 충분히 타당한 canonical variant 집합**으로 보인다.

즉, S2 입장에서 이 WR은 이제 “추상 제안”이 아니라
**실제 설계/구현 planning으로 이어갈 수 있는 수준의 문서**에 가까워졌다.

다만 S2가 실제 persistence / migration / API seam 설계로 들어가기 전에,
아래 4가지는 S3와 추가로 더 명확히 맞춰야 한다.

---

## 1. `subprojectPath` / `subprojectName`만으로는 부족하다

현재 WR은 canonical flow를 여전히 subproject 중심으로 설명하고 있다.
이 표현 자체는 이해 가능하지만,
S2 persistence 관점에서는 **stable identifier** 가 하나 더 필요하다.

S2가 필요하다고 보는 최소 추가 식별자 후보:
- `buildUnitId` 또는 그에 준하는 안정 ID
- `buildDeclarationId` 또는 declaration fingerprint / hash

이유:
- `subprojectPath` / `subprojectName`은 rename·move·normalization의 영향을 받을 수 있다.
- Build Snapshot을 재참조(re-analysis / retry / lineage 조회)할 때,
  path/name만으로는 canonical identity가 흔들릴 위험이 있다.
- S2는 장기적으로 snapshot이 단순 UI payload가 아니라
  **ID 기반 참조 가능한 durable object** 여야 한다고 본다.

### S2 요청
S3는 canonical variant 문맥에서,
**path/name 외에 어떤 stable identity를 v1에 요구할지**를 명시해 달라.

---

## 2. downstream canonical reference는 `buildSnapshotId` 우선이어야 한다

선행 WR에서 S2는 reference 방식(ID / embedded / 둘 다)을 질문했고,
이번 variant 문서에서는 여전히 선택지가 열려 있는 것으로 읽힌다.

S2의 현재 입장은 명확하다.

> **서비스 간 canonical handoff reference는 `buildSnapshotId` 우선으로 고정하는 편이 맞다.**

embedded snapshot object는 있을 수 있지만,
그것은 canonical transport라기보다:
- UI read model
- detail projection
- convenience response
수준으로 제한되는 편이 낫다.

이유:
- snapshot object는 시간이 지나며 커질 가능성이 높다.
- S4 / S5 / analysis 경계에서 embedded object를 관성적으로 전달하기 시작하면
  drift와 schema skew 가능성이 높아진다.
- ID reference를 기본으로 하면,
  S2가 persistence / lifecycle / access control / audit / re-fetch를 일관되게 관리하기 쉽다.

### S2 요청
S3는 downstream canonical contract를 기술할 때,
**`buildSnapshotId` reference-first 원칙을 받아들일 수 있는지**를 답해 달라.

---

## 3. 최소 required fields에 `schema/version/lineage` 계열이 더 필요하다

S3가 제안한 required fields는 build evidence 관점에서 상당히 좋다.
다만 S2 persistence / migration 관점에서는 아래 계열이 추가로 더 필요하다.

### S2가 required 또는 near-required로 보는 추가 후보
- `snapshotSchemaVersion`
- `sourceAssetRef` 또는 동등한 source provenance ref
- `sdkAssetRef` 또는 SDK registry ref
- `buildDeclarationFingerprint` 또는 equivalent declaration identity
- retry / 재생성 / 파생 관계를 표현할 수 있는 `parentSnapshotId` 또는 equivalent lineage ref

이유:
- 이 객체는 단순 build 결과 캐시가 아니라,
  **재현 가능한 canonical evidence object** 여야 한다.
- schema/version 정보가 없으면 필드 진화 시 마이그레이션과 compatibility 판단이 어려워진다.
- lineage가 없으면 retry / remediation / rebuild history를 깨끗하게 추적하기 어렵다.

### S2 요청
S3는 현재 required/optional 구분안 위에,
위 필드들 중 무엇이 v1 hard-required인지 / later-phase인지 입장을 정리해 달라.

---

## 4. failure object semantics를 더 분리해서 정해야 한다

현재 WR은 build failure도 Build Snapshot 또는 동등한 build evidence object로 남길 수 있다고 한다.
방향 자체는 동의하지만,
S2 구현 관점에서는 여기서 한 단계 더 명확해야 한다.

핵심 질문:
- **실패도 동일한 `BuildSnapshot` 타입으로 저장할 것인가?**
- 아니면 **`BuildAttempt` / `BuildEvidence` 같은 하위 개념을 따로 둘 것인가?**

이 선택은 아래에 직접 영향을 준다.
- DB 모델링
- API 응답 shape
- retry / remediation UX
- downstream analysis eligibility 판정

S2는 실패 build도 durable evidence로 남겨야 한다는 점엔 동의한다.
하지만 “성공 snapshot”과 “실패 attempt/evidence”를 동일 타입으로 다룰지 여부는
지금 결정하지 않으면 나중에 API가 흔들릴 가능성이 높다고 본다.

### S2 요청
S3는 v1 기준으로 failure case를
- 동일 `BuildSnapshot` 타입으로 보려는지,
- 별도 attempt/evidence 개념으로 분리하려는지
명시해 달라.

---

## migration / platform 제약에 대한 S2 메모

S2에는 이미 `BuildTarget`에 build provenance가 일부 박혀 있다.

예:
- `buildCommand`
- `compileCommandsPath`
- `buildLog`
- `sastScanId`
- `codeGraphNodeCount`
- `lastBuiltAt`

관련 근거:
- `services/shared/src/models.ts`
- `services/backend/src/dao/build-target.dao.ts`

또한 현재 `/pipeline/status`도 위 필드 일부를 직접 노출하고 있다.

관련 근거:
- `services/backend/src/controllers/pipeline.controller.ts`

즉 이번 전환은 단순 신규 객체 추가가 아니라,

> **현재 BuildTarget에 붙어 있는 build provenance를 어떻게 걷어내고,
> 어떤 read model만 남길지를 포함한 migration 설계**

다.

S2 입장에서 중요한 제약은 다음과 같다.

1. **dual source of truth를 오래 유지하면 안 된다.**
2. 장기적으로 `BuildTarget`은 build result canonical object가 아니어야 한다.
3. 다만 migration 동안에는 어떤 read compatibility를 유지할지 단계가 필요하다.

---

## S2의 현재 답변 요약

### 1. 추가 variant 필요 여부
현재 기준으로는 **추가 variant가 꼭 필요해 보이지 않는다.**
S3가 정리한 A~E면 v1 canonical variant 집합으로 충분해 보인다.

### 2. minimum field 추가 필요 여부
**있다.**
S2는 특히 아래를 중요하게 본다.
- stable build unit identity
- declaration identity / fingerprint
- snapshot schema/version
- source/sdk provenance ref
- lineage / retry ref

### 3. reference 방식 선호
S2는 **`buildSnapshotId` reference-first** 를 선호한다.
embedded object는 보조적 read model로는 가능하지만,
서비스 간 canonical handoff는 ID 우선이 더 적절하다.

### 4. migration constraint 존재 여부
**매우 크다.**
현재 S2에는 이미 `BuildTarget` 및 `/pipeline/status`에 provenance가 박혀 있으므로,
Build Snapshot 도입 시 read/write 경계와 migration 단계가 반드시 필요하다.

---

## 요청 사항

S3가 다음 회신에서 가능하면 아래를 추가로 명시해 주길 요청한다.

1. `subprojectPath` / `subprojectName` 외 stable identity (`buildUnitId` 등) 필요 여부
2. `buildSnapshotId` reference-first 원칙 수용 여부
3. `schema/version/lineage` 계열 필드의 v1 required/optional 구분
4. failure case를 동일 snapshot 타입으로 볼지, 별도 attempt/evidence로 분리할지

이 4가지가 정리되면,
S2는 그 답을 바탕으로 다음 planning 단계에서
- persistence model
- migration seam
- external API boundary
를 더 구체화할 수 있다.

---

## 메모

이 WR은 반대가 아니라,

> **S3가 제안한 variant 문서를 S2 persistence / migration 관점에서 더 설계 가능하게 만들기 위한 보강 요청**

이다.

S2는 방향 자체는 동의하며,
이제 남은 것은 **canonical semantics를 실제 플랫폼 전환 가능한 수준으로 더 단단히 잠그는 것**이라고 본다.
