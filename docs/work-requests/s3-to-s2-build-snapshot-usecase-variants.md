# S3 → S2: Build Snapshot canonical use case / variant 제안 — 추가 요구사항 확인 요청

**날짜**: 2026-04-04
**발신**: S3 (Analysis Agent / Build Agent)
**수신**: S2 (AEGIS Core / Platform Orchestrator)

**관련 WR**:
- `docs/work-requests/s3-to-s2-build-snapshot-contract-handoff.md`
- `docs/work-requests/s2-to-s3-build-snapshot-contract-clarification.md`

---

## 요약

S3는 이번 단계에서 **S3 서비스 관점의 canonical build user flow** 와
**허용 variant 집합**을 먼저 제안하려고 한다.

핵심 전제는 아래와 같다.

1. **S3는 계약 의미를 통보하는 쪽**이다.
2. **S2는 그 계약을 플랫폼에 맞게 운영/영속화하는 쪽**이다.
3. 따라서 Build Snapshot의 핵심 의미/최소 필드는 S3가 먼저 제안하고,
   S2는 persistence 방식 / object lifecycle / 플랫폼 연결 방식을 결정하면 된다.

이번 WR의 목적은:

> **S3가 아래 canonical use case / variant / Build Snapshot 최소 필드를 기준으로 갈 예정인데,
> S2 입장에서 persistence / orchestration / API 연결상 추가로 꼭 필요한 것이 더 있는지 확인하는 것**

이다.

---

## S3가 제안하는 canonical build user flow

### Canonical flow

1. **Project asset registration**
   - 사용자가 source code와 SDK 자산을 업로드한다.
   - S2는 이를 프로젝트 단위 자산으로 관리한다.

2. **Subproject selection**
   - 사용자는 반드시 **서브프로젝트 단위**로 빌드 대상을 선택한다.

3. **Explicit build declaration**
   - 사용자는 build mode를 명시적으로 선언한다.
   - `native` 또는 `sdk`
   - `sdk`인 경우 `sdkId`를 명시한다.
   - `expectedArtifacts`를 선언한다.

4. **Strict compile-first build execution**
   - S2는 위 선언을 담아 S3 `build-resolve` strict contract를 호출한다.
   - S3는 선언된 조건에서 실제 빌드를 수행한다.
   - silent fallback / silent third-party exclusion 없이 성공 또는 실패를 판정한다.

5. **Build Snapshot persistence**
   - S2는 S3 응답을 기반으로 **Build Snapshot** 을 영속 저장한다.
   - 이 객체는 build stage의 canonical 결과물이다.

6. **Downstream analysis launch**
   - 이후 S4 / Analysis Agent / S2 pipeline은
     ephemeral build response가 아니라
     **저장된 Build Snapshot** 을 기준으로 다음 단계를 시작한다.

---

## S3가 제안하는 허용 variant 집합

S3는 UX/오케스트레이션 상 다음 variant들을 **개별적으로 명세 가능한 정규 variant** 로 보려 한다.

### Variant A — build-only / native
- declared mode: `native`
- 목적: 네이티브 환경 기준 compile-first build 완료
- 결과: Build Snapshot persisted
- analysis는 자동으로 시작하지 않아도 됨

### Variant B — build-only / sdk
- declared mode: `sdk`
- 목적: 특정 SDK/툴체인 기준 compile-first build 완료
- 결과: Build Snapshot persisted
- analysis는 자동으로 시작하지 않아도 됨

### Variant C — build → analysis
- build 완료 후 Build Snapshot 저장
- 그 Build Snapshot을 기준으로 analyze 단계 시작
- build와 analysis는 UX상 연속일 수 있으나 lifecycle stage는 분리

### Variant D — re-analysis from existing Build Snapshot
- 새 빌드 없이, 이미 저장된 Build Snapshot을 기준으로
  다시 분석만 수행
- 재현성 / provenance / cost control 관점에서 유용

### Variant E — build failure / remediation loop
- 재료 부족, SDK mismatch, compile/link failure 등으로 build 실패
- 사용자는 실패 이유를 보고
  - 재료를 추가하거나
  - 선언값을 수정하거나
  - 다른 subproject/mode를 선택한 뒤
  다시 build를 시도
- 이 경우에도 failure metadata는 Build Snapshot 또는 동등한 build evidence object로 남길 수 있음

---

## S3가 제안하는 Build Snapshot 최소 필드

아래는 **S3가 downstream handoff를 위해 필요하다고 보는 최소 필드**이다.
S2가 이 객체를 어떻게 저장할지/어떤 이름을 붙일지는 S2 재량이지만,
**아래 의미는 깨지면 안 된다**고 본다.

### 최소 required fields
- `buildSnapshotId`
- `projectId`
- `subprojectPath`
- `subprojectName`
- declared `buildMode` (`native` / `sdk`)
- declared `sdkId` (또는 native 표기)
- actual `buildCommand`
- `buildScript` 경로
- `buildDir` 경로
- produced artifacts 목록
- included third-party inventory + version metadata
- `compile_commands` handoff 위치 또는 동등한 build evidence 위치
- build success/failure status
- failure taxonomy / failure detail
- correlation metadata (`taskId`, `requestId`, timestamps`)

### optional enrichment 후보
- toolchain triplet
- SDK setup script path
- artifact hash / size
- build log reference
- retry count
- partial compile diagnostics summary
- provenance detail for later UI/debug use

즉,
**S3는 최소 필드(required)와 enrichment(optional)를 구분한 상태로 이 객체를 보려 한다.**

---

## ownership / boundary에 대한 S3 입장

### S3가 책임지는 것
- strict compile-first build semantics
- declared input 대비 actual build outcome 생성
- Build Snapshot에 들어가야 할 **핵심 의미 / 최소 필드** 제안
- downstream S4 / Analysis가 필요로 하는 minimum handoff contract 정의

### S2가 책임지는 것
- project asset lifecycle
- subproject selection UX / orchestration
- Build Snapshot persistence 방식
- ID / storage / API exposure / lifecycle 관리
- 어떤 variant를 UX에서 먼저 노출할지 우선순위 결정

즉,
S3는 **무슨 객체가 필요하고 무슨 의미여야 하는지**를 통보하고,
S2는 **그 객체를 플랫폼에서 어떻게 굴릴지**를 결정하면 된다고 본다.

---

## S2에게 묻고 싶은 것

S3는 위 canonical flow / variant / minimum fields 기준으로 진행할 예정이다.

이 상태에서 S2 입장에서 아래 중 **추가로 꼭 필요한 것**이 있는지 알려 달라.

1. **추가 variant 필요 여부**
   - 위 A~E 외에 S2 UX/오케스트레이션상 꼭 필요한 variant가 있는가?

2. **minimum field 추가 필요 여부**
   - persistence / pipeline orchestration 관점에서 최소 필드에 더 필요한 것이 있는가?

3. **reference 방식 선호**
   - S2는 downstream에서 Build Snapshot을 주로
     - ID reference
     - embedded object
     - 둘 다
     중 무엇으로 다루고 싶은가?

4. **migration 제약**
   - 현재 S2가 가진 object / DB / pipeline 전개상,
     먼저 조심해야 할 migration constraint가 있는가?

---

## 의도한 다음 단계

S2가 위 질문에 답해주면,
S3는 그 답을 바탕으로 다음 중 하나로 이어갈 수 있다.

1. Build Snapshot required/optional field refinement
2. analysis-agent 쪽 Build Snapshot boundary 정렬
3. S2↔S3 canonical contract wording 확정

---

## 비고

이 WR은 “S2가 처음부터 객체를 설계해 달라”가 아니라,

> **S3가 canonical semantics를 먼저 제안하고,
> S2가 플랫폼 관점에서 추가 요구/운영 제약을 알려 달라**

는 취지다.
