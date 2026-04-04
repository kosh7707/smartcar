# S3 → S4: `/v1/build` SDK 적용 시 `exitCode=127` 재현 (certificate-maker)

**날짜**: 2026-04-04
**발신**: S3 (Analysis / Build Agent)
**수신**: S4 (SAST Runner)

---

## 요약

S3 live integration test 중 `certificate-maker` 서브프로젝트 빌드에서,
S4 `/v1/build`가 `sdkId=ti-am335x` 경로를 적용한 첫 시도에서 `exitCode=127`을 반환했습니다.
같은 요청에서 S3가 SDK 적용을 제거한 뒤 재시도하자 빌드는 성공했습니다.

즉, **SDK 적용 경로에서만 실패가 재현**되고 있습니다.

---

## 재현 정보

- 요청 시각: 2026-04-04
- requestId: `e2e-1775275657-build`
- 대상 경로:
  - project root: `/home/kosh/AEGIS/uploads/proj-60bf5eb4-bc1f-4275-b7d5-15db1f939935`
  - targetPath: `certificate-maker`
- 호출 흐름:
  - S3 Build Agent `build-resolve`
  - S4 `GET /v1/sdk-registry` 성공 후 `sdkId=ti-am335x` 사용
  - S4 `POST /v1/build` 첫 시도 실패 (`exitCode=127`)
  - S3가 스크립트 수정 후 SDK 없이 `POST /v1/build` 재시도 → 성공

---

## 관측 로그 근거

`log-analyzer trace_request(e2e-1775275657-build)` 기준:

1. S4 SDK 적용 로그
   - `SDK environment-setup applied: /home/kosh/sdks/ti-am335x/linux-devkit/environment-setup-armv7at2hf-neon-linux-gnueabi`
2. 직후 빌드 시작 로그
   - `Build started: SDK_DIR=/home/kosh/sdks/ti-am335x bash .../certificate-maker/build-aegis-.../aegis-build.sh`
3. S3 검증 경고
   - `[try_build] S4 응답 검증: 빌드 exit code=127 (실패).`
4. 같은 요청 후반 재시도 성공
   - `Build completed: 3 entries (2 user), exit=0, 1882ms`

최종 S3 응답(`build.json`) caveat에도 아래가 기록됨:
- `SDK(ti-am335x) 환경 설정 스크립트를 source할 때 라이브러리 로드 오류가 발생하여 시스템 기본 컴파일러로 변경하여 빌드했습니다.`

---

## 계약 기준 기대 동작

`docs/api/sast-runner-api.md` 기준:
- `GET /v1/sdk-registry`는 등록된 SDK를 정상 노출해야 함
- `POST /v1/build`는 `buildProfile.sdkId`를 받으면 해당 SDK 환경을 적용해 빌드를 수행해야 함

현재는 registry 노출은 정상인데, **SDK 적용 빌드 경로가 실사용에서 실패**하고 있습니다.

---

## 요청 사항

1. `ti-am335x` SDK 적용 시 `/v1/build`에서 `exitCode=127`이 나는 원인을 확인해 주세요.
2. 특히 `environment-setup-armv7at2hf-neon-linux-gnueabi` source 이후 런타임 라이브러리/경로 해석 문제 여부를 점검해 주세요.
3. 가능하면 동일 request shape로 `certificate-maker` 경로 재현 후, 실패 원인과 수정 방안을 WR 답변 또는 계약/인수인계서에 남겨 주세요.

---

## 영향

- 현재 S3 Build Agent는 SDK 적용 실패 시 **SDK를 제거한 fallback**으로 빌드를 성공시킬 수는 있습니다.
- 하지만 이 경우 결과물이 **x86_64 기준 빌드**가 되어, 원래 의도한 ARM cross-compilation 보장이 깨집니다.
- 따라서 downstream `compile_commands.json`/정적분석 품질에도 영향을 줄 수 있습니다.
