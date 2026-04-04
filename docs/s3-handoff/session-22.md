# S3 세션 22 — 2026-04-04

## 세션 요약

Build Snapshot 논의 이후 바로 다음 실행 슬라이스로, S3 내부의 **strict compile-first canonical surface drift** 를 정리했다.

이번 세션의 목적은 새 객체를 더 만드는 것이 아니라, 이미 정해진 S3 의미를 **현재 런타임/문서/테스트가 같은 이름으로 말하게 만드는 것**이었다.

핵심은 세 가지였다.

1. **request canonicalization**
   - strict canonical surface를 `subprojectPath` / `subprojectName`
   - `contractVersion: "build-resolve-v1"`
   - nested `build.mode` / `build.sdkId`
   기준으로 고정
   - 동시에 `targetPath` / `targetName`, flat `buildMode` / `sdkId`, `compile-first-v1`는 migration alias로 계속 수용

2. **result semantics exposure**
   - strict contract 메타데이터 (`contractVersion`, `strictMode`)를 success/failure 응답 상단에 노출
   - `buildResult.declaredMode`, `buildResult.sdkId`를 보강해 future Build Snapshot production에 필요한 declared intent를 응답에서 바로 확인 가능하게 함

3. **docs/harness alignment**
   - `build-agent-api.md`, `build-agent.md`, `build-test.sh`, `analysis-agent/scripts/e2e.sh`를 현재 canonical strict surface에 맞게 정렬
   - failure terminology도 현재 런타임 기준(`INVALID_SCHEMA`, `SDK_MISMATCH`, `EXPECTED_ARTIFACTS_MISMATCH`, `artifactVerification`)으로 통일

---

## 변경 핵심

### 1. strict request canonical surface
- canonical strict 예시는 이제:
  - `subprojectPath`
  - `subprojectName`
  - `build: { mode, sdkId }`
  - `contractVersion: "build-resolve-v1"`
- legacy alias는 migration shim으로 유지

### 2. response/result surface
- `TaskSuccessResponse`, `TaskFailureResponse`
  - `contractVersion`
  - `strictMode`
  추가
- `BuildResult`
  - `declaredMode`
  - `sdkId`
  추가

### 3. harness
- `services/build-agent/scripts/build-test.sh`
  - canonical strict payload로 갱신
- `services/analysis-agent/scripts/e2e.sh`
  - build step payload를 `subproject*` + nested `build` 형태로 갱신

---

## 검증 포인트

- canonical strict payload acceptance
- legacy alias payload acceptance
- strict result semantics exposure
- expectedArtifacts verification 유지
- script example drift 제거

---

## 남은 후속 과제

1. **Ralph 전체 회귀/architect 검증**
   - 이번 canonical surface 변경을 포함한 전체 검증 필요

2. **analysis boundary 문서화 여부 결정**
   - Build Snapshot reference-first 경계를 analysis-agent API/spec에 지금 반영할지 판단

3. **RE100 live 재검증**
   - canonical strict payload 기준으로 gateway / gateway-webserver live stress path 재개
