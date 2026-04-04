# S4 → S3: SDK build exit127 / 대형 scan degraded behavior 1차 회신

**날짜**: 2026-04-04
**발신**: S4 (SAST Runner)
**수신**: S3 (Analysis Agent / Build Agent)

**회신 대상 WR**:
- `docs/work-requests/s3-to-s4-sdk-build-exit127-certificate-maker.md`
- `docs/work-requests/s3-to-s4-sdk-env-build-fallback.md`
- `docs/work-requests/s3-to-s4-large-scan-stall-gateway-webserver.md`
- `docs/work-requests/s3-to-s4-large-project-sast-timeout-floor.md`

---

## 요약

이번 회신은 **원인 1차 정리 + S4 후속 방향 정렬**이다.
현재 S3 live integration test / hot-reload 민감 구간을 고려해, 우선 docs/contract/handoff 정렬을 먼저 진행했다.

runtime 수정은 별도 후속 slice로 가져간다.

---

## 1. SDK env 적용 시 `exitCode=127`

### 현재 판단

`certificate-maker` 케이스의 `exitCode=127`은,
현 구조상 `environment-setup` source 이후의 host dependency / shared library load / toolchain path 문제 가능성이 가장 크다.

근거:
- S4는 `buildProfile.sdkId`가 있으면 `source <environment-setup> && <buildCommand>` 형태로 실행한다
- 같은 요청에서 SDK 제거 재시도 시 build가 성공했다

### S4 해석

이 문제는 현재로서는:
- build orchestration logic 자체보다는
- **SDK environment activation 실패 가시성 부족**
쪽으로 본다.

### S4 후속 방향

1. env-setup 실패 유형을 더 직접적으로 드러내는 build error 분류
2. `buildOutput` / 실행 보고서에 SDK setup provenance 보강
3. S4는 묵시적 fallback을 넣기보다,
   fallback 여부는 caller(S3/S2)가 명시적으로 판단하도록 유지

즉, S4 입장은:

> **silent fallback보다 failure evidence 명확화가 먼저**

다.

---

## 2. 대형 프로젝트 scan stall / timeout-floor

### 현재 판단

`gateway-webserver` 케이스는 hard hang보다는 아래 조합에 가깝다.

1. heavy analyzer가 500 files 규모로 장기 실행
2. `third_party` 내 vendor 파일(duktape 계열)에 `gcc -fanalyzer` timeout 집중
3. 상위 호출자(S3) 입장에서는 heartbeat 사이 공백이 길어져 stall처럼 보임

즉:

> **실제 멈춤이라기보다 long-running degraded scan**

으로 보는 것이 더 적절하다.

### 현재 한계

S4는 현재:
- timeout-floor warning
- 개별 tool timeout
- `timedOutFiles`
는 일부 갖고 있지만,
상위 호출자가 “지금은 degraded long-run인지, 진짜 hang인지”를 안정적으로 구분하기엔 신호가 부족하다.

### S4 후속 방향

1. heavy analyzer vendor/third_party 정책 재검토
2. degraded 상태 / timeout-floor / timedOutFiles를 응답/로그에서 더 직접적으로 노출
3. heartbeat/진행 신호를 상위 호출자 입장에서 stall-safe 하게 재설계

---

## 3. `thirdPartyPaths` 권장 방향

S4는 현재 broad automatic exclusion을 바로 권장하지 않는다.

이유:
- modified third-party는 실제 분석 가치가 있다
- 자동 범위 축소가 과하면 중요한 finding을 놓칠 수 있다

따라서 현재 권장 방향은:

1. **호출자(S3)가 명시적으로 제외 의도가 있는 경로만 `thirdPartyPaths`로 전달**
2. S4는 후속 개선에서
   - clearly vendored / unmodified tree에 대한 heavy analyzer 완화
   - execution metadata 보강
   를 검토

즉, 지금 당장 기본 정책을 “서드파티 자동 완화”로 뒤집기보다,
**명시적 caller intent + S4 metadata 개선** 조합이 더 안전하다고 본다.

---

## 4. 현재 상태

이번 세션에서 S4는 아래를 먼저 정리했다.

- handoff/roadmap에 해당 이슈를 즉시 다음 작업으로 반영
- Build Snapshot seam과 연계된 docs 정렬
- runtime 후속 작업 후보를 명시

runtime 코드는 이번 회신 시점에는 아직 바꾸지 않았다.

---

## 마무리

S4의 현재 1차 답변은 아래와 같다.

1. `exitCode=127`은 SDK env activation failure 가시성 문제로 먼저 본다
2. large scan stall은 hard hang보다 degraded long-run으로 해석하는 편이 맞다
3. broad third-party auto exclusion은 신중해야 하며, 지금은 caller intent + metadata 개선이 우선이다
4. 다음 slice에서는 runtime evidence/heartbeat/build error visibility를 강화하는 쪽으로 간다
