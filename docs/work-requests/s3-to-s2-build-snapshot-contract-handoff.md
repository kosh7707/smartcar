# S3 → S2: strict compile-first 전체 유즈케이스 + Build Snapshot 계약 제안

**날짜**: 2026-04-04
**발신**: S3 (Analysis Agent / Build Agent)
**수신**: S2 (AEGIS Core / Platform Orchestrator)

---

## 배경

S3는 Build Agent를 느슨한 "가능하면 빌드해보는" 자동화가 아니라,
**선언된 조건에서 실제 컴파일을 성립시키는 strict compile-first control plane** 으로 재정의했다.

이번 세션에서 S3 내부 계약은 다음 방향으로 정리됐다.

- 서브프로젝트 단위 빌드
- 호출자의 명시적 build mode 선언 (`native` / `sdk`)
- `sdk` 모드일 때 explicit `sdkId`
- `expectedArtifacts` 기반 성공 판정
- silent native fallback 금지
- silent third-party exclusion 금지
- partial compile_commands / partial build를 성공으로 간주하지 않음

그런데 여기서 더 중요한 문제는,
**S2↔S3 경계가 단순 `build-resolve` payload 수준으로는 부족하다**는 점이다.

사용자 입장의 실제 유즈케이스는 다음 전체 흐름으로 보아야 한다.

1. SDK / project asset 등록
2. 서브프로젝트 선택
3. explicit build mode 선언
4. strict compile-first build 실행
5. build 결과를 **Build Snapshot** 으로 영속 저장
6. 이후 S4 / Analysis Agent가 그 Build Snapshot을 기준으로 분석 시작

즉, build와 analysis는 UX 상 이어질 수 있어도,
**계약과 증적(provenance) 관점에서는 명확히 분리된 두 단계**여야 한다.

---

## 제안 핵심

### 1. S2는 전체 build user flow를 오케스트레이션한다

S2는 단순 필드 전달자가 아니라 아래를 명시적으로 관리해야 한다.

- 프로젝트 자산 등록 (source + SDK association)
- 서브프로젝트 선택
- build mode 선언 (`native` / `sdk`)
- `sdk` 모드일 경우 `sdkId` 선택
- 성공 기준 산출물(`expectedArtifacts`) 선언
- build 완료 후 Build Snapshot 저장
- 후속 분석 시 Build Snapshot 참조

### 2. Build Snapshot을 persistent first-class object로 정의한다

분석 단계는 더 이상 ephemeral build response를 그대로 이어받아서는 안 된다.

대신 S2는 build 완료 후 아래 정보를 담은 **Build Snapshot** 을 영속 저장하고,
이후 S4 / Analysis Agent는 이 객체를 기준으로 동작해야 한다.

#### Build Snapshot 최소 필드

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
- request / correlation metadata (`taskId`, `requestId`, timestamps 등)

### 3. Build와 Analysis는 분리된 lifecycle stage여야 한다

S2가 사용자 UX 상에서 build 직후 analyze를 이어 붙일 수는 있다.
하지만 계약/증적 관점에서는 아래가 필요하다.

- **Build stage 완료** → Build Snapshot persisted
- **Analysis stage 시작** → Build Snapshot ID/object를 입력으로 사용

즉, Analysis / S4는:
- transient build response
- UI 메모리 상의 임시 metadata
가 아니라,
**저장된 Build Snapshot** 을 기준으로 해야 한다.

---

## S2에게 필요한 계약 변화

### A. strict build request 입력

S2는 strict compile-first 호출 시 적어도 아래를 넘겨야 한다.

- `contractVersion`
- `strictMode`
- `projectPath`
- `subprojectPath`
- `subprojectName`
- `build.mode`
- `build.sdkId` (`sdk` 모드일 때)
- `expectedArtifacts[]`

### B. Build Snapshot persistence 책임

S2는 build 완료 후 다음을 해야 한다.

1. S3 응답을 기반으로 Build Snapshot 생성
2. Build Snapshot 영속 저장
3. 이후 분석 요청 시 Build Snapshot ID/object 참조
4. build와 analysis를 단일 opaque job으로 섞지 않기

### C. phased adoption 권장

S3는 이 전환이 한 번에 강제되기보다 단계적으로 가는 것이 맞다고 본다.

#### 권장 단계
1. **Phase 1** — S3→S2 WR/coordination artifact로 전체 flow + Build Snapshot 정의
2. **Phase 2** — S2가 Build Snapshot persistence/reference semantics 도입
3. **Phase 3** — Analysis / S4가 Build Snapshot을 canonical handoff object로 소비

---

## 왜 이렇게 가야 하는가

1. **user flow가 선명해진다**
   - build request 한 번의 필드가 아니라, 사용자의 전체 journey가 정의된다.

2. **provenance / evidence 경계가 생긴다**
   - 어떤 SDK/native mode였는지
   - 어떤 third-party가 실제 포함됐는지
   - 실제 어떤 build command가 실행됐는지
   - 어떤 artifact가 나왔는지
   를 durable object로 남길 수 있다.

3. **build와 analysis가 덜 꼬인다**
   - analysis가 build response 재해석기가 되지 않는다.

4. **S2 / S3 / S4 책임이 분리된다**
   - S2: orchestration + persistence
   - S3: strict compile-first build result 생산
   - S4 / Analysis: Build Snapshot 소비

---

## S3 쪽 현재 상태

S3는 이미 아래 방향으로 내부 계약을 정리했다.

- `docs/api/build-agent-api.md`
- `docs/specs/build-agent.md`
- Build Agent request preflight / failure taxonomy / expectedArtifacts enforcement

즉, **S3 내부는 strict compile-first 방향으로 선행 정리되었고**,
이제 병목은 **S2가 어떤 end-to-end contract를 받아들이느냐**로 이동했다.

---

## 요청 사항

1. S2가 위 제안을 기준으로 **전체 build user flow 계약**을 검토해 달라.
2. 특히 아래 3가지를 우선 판단해 달라.
   - Build Snapshot을 coordination artifact로 먼저 도입할지
   - 즉시 persistent first-class object로 도입할지
   - analysis 시작을 Build Snapshot reference 기반으로 고정할지
3. 가능하면 이후 S2 소유 문서/계약/데이터 모델 관점에서
   - 어떤 필드가 필요한지
   - 어떤 저장 단위를 사용할지
   - 어떤 migration path가 적절한지
   를 회신해 달라.

---

## 비고

- 이 WR은 **S2 코드 수정을 직접 요구하는 구현 diff** 가 아니라,
  S2↔S3 경계 재정의를 위한 **계약 제안**이다.
- S3는 후속으로 필요 시:
  - Build Snapshot field refinement
  - Analysis API/spec alignment
  - S4 handoff expectation 정리
  를 이어서 맞출 수 있다.
