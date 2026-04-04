# S3 → S4: SDK environment 적용 시 build exit 127 재현

**날짜**: 2026-04-04
**발신**: S3 (Build Agent)
**수신**: S4 (SAST Runner)

---

## 배경

S3 Build Agent integration test 중 `certificate-maker` 서브프로젝트 빌드에서, S4가 sdk-registry 기반 SDK 환경을 적용한 첫 번째 `try_build`가 `exitCode=127`로 실패했습니다.

Build Agent는 두 번째 시도에서 SDK를 제거하고 호스트 기본 툴체인으로 재시도하여 빌드는 성공했지만, 결과적으로 **ARM 크로스 빌드가 아니라 x86_64 fallback 빌드**가 되었습니다.

---

## 재현 정보

- **requestId**: `e2e-1775275657-build`
- **프로젝트 루트**: `/home/kosh/AEGIS/uploads/proj-60bf5eb4-bc1f-4275-b7d5-15db1f939935`
- **targetPath**: `certificate-maker`
- **S3 호출 surface**: `POST /v1/tasks` (`build-resolve`)
- **S4 연계 surface**: `GET /v1/sdk-registry`, `POST /v1/build`

### 관측 로그

`log-analyzer trace_request(e2e-1775275657-build)` 기준:

- S4 sdk-registry 조회는 성공
- 첫 `try_build` 시 S4가 아래처럼 SDK 환경을 적용
  - `SDK environment-setup applied: /home/kosh/sdks/ti-am335x/linux-devkit/environment-setup-armv7at2hf-neon-linux-gnueabi`
- 직후 S3 쪽에서 수신한 결과:
  - `[try_build] S4 응답 검증: 빌드 exit code=127 (실패).`
- 이후 Build Agent가 SDK를 제거하고 재시도했고, 두 번째 `try_build`는 성공

### 최종 S3 응답 요약

`/tmp/aegis-e2e/build.json` 기준 caveat:

- `SDK(ti-am335x) 환경 설정 스크립트를 source할 때 라이브러리 로드 오류가 발생하여 시스템 기본 컴파일러로 변경하여 빌드했습니다.`
- `빌드된 실행 파일은 x86_64 아키텍처용이며, 타겟 ARM 아키텍처용 cross-compilation은 SDK 환경 설정 문제 해결 시 재시도 필요합니다.`

---

## 기대 동작

- S4가 `sdkId=ti-am335x` 적용 시 `POST /v1/build`가 실제 크로스 컴파일 가능한 환경을 구성해야 함
- 최소한 실패 시, `exitCode=127`만이 아니라 **환경 스크립트/동적 라이브러리 로드 실패 원인**이 호출자에게 더 직접적으로 드러나면 좋음

---

## 요청 사항

1. `ti-am335x` SDK environment-setup 적용 시 `exitCode=127`이 나는 원인을 확인해 주세요.
2. 가능하면 S4 `buildOutput` / 오류 메시지에 SDK 환경 실패 원인(예: shared library load, missing host dependency)을 더 명확히 남겨 주세요.
3. 재현 후 수정되면, S3가 동일 request shape로 재검증하겠습니다.

