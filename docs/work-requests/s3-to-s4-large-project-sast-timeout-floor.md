# S3 → S4: 대형 서브프로젝트 스캔 시 timeout-floor / vendor fanalyzer timeout 경고 재현

**날짜**: 2026-04-04
**발신**: S3 (Analysis Agent)
**수신**: S4 (SAST Runner)

---

## 배경

S3 Analysis Agent integration test 중 `gateway-webserver` 서브프로젝트에 대해 `deep-analyze`를 수행했을 때, S4 SAST 스캔 단계에서 여러 warning이 재현됐습니다.

현재 요청은 아직 진행 중이지만, warning 자체는 깨끗한 로그 창에서 안정적으로 재현되었습니다.

---

## 재현 정보

- **requestId**: `e2e-1775276005-analyze`
- **프로젝트 루트**: `/home/kosh/AEGIS/uploads/proj-60bf5eb4-bc1f-4275-b7d5-15db1f939935`
- **targetPath**: `gateway-webserver`
- **S3 호출 surface**: `POST /v1/tasks` (`deep-analyze`)
- **S4 연계 surface**: `POST /v1/scan`

### 재현된 warning (`log-analyzer search_errors` 기준)

1. `Per-file timeout floor (10s) may exceed budget (450s for 63 batches)` ×2
2. `gcc -fanalyzer timed out for libraries/civetweb/src/third_party/duktape-1.8.0/src-separate/duk_js_compiler.c (10s)`
3. `gcc -fanalyzer timed out for libraries/civetweb/src/third_party/duktape-1.8.0/src/duktape.c (10s)`
4. `gcc -fanalyzer timed out for libraries/civetweb/src/third_party/duktape-1.8.0/src-noline/duktape.c (10s)`
5. `gcc -fanalyzer timed out for libraries/civetweb/src/third_party/duktape-1.5.2/src/duktape.c (10s)`
6. `gcc -fanalyzer timed out for libraries/civetweb/src/third_party/duktape-1.5.2/src-noline/duktape.c (10s)`

### S3 관측 영향

- S3 쪽 trace에 반복적으로 `SAST stall 감지` / heartbeat가 발생하며 Phase 1 대기 시간이 길어짐
- vendor/third_party 성격이 강한 파일에서 fanalyzer timeout이 집중적으로 발생

---

## 기대 동작

- 대형 프로젝트 + third_party 코드가 섞인 경우에도 budget 설명과 degraded 상태가 더 예측 가능해야 함
- 가능하다면 vendor/third_party 계열 파일에 대한 heavy analyzer 기본 정책이 더 명확해지면 좋음

---

## 요청 사항

1. 위 requestId 기준으로 S4에서 timeout-floor warning과 fanalyzer timeout이 의도된 degraded 동작인지 확인해 주세요.
2. 의도된 동작이라면, 호출자(S3/S2)가 이를 안정적으로 해석할 수 있도록 응답/로그 의미를 더 명확히 해 주세요.
3. 기본적으로 third_party/vendor 계열 경로를 자동 완화할지, 아니면 S3가 `thirdPartyPaths`를 더 적극적으로 넘겨야 하는지 권장 방향을 알려 주세요.

