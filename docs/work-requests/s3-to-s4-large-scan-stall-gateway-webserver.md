# S3 → S4: 대형 프로젝트 스캔 중 stall/timeout 경고 재현 (`gateway-webserver`)

**날짜**: 2026-04-04
**발신**: S3 (Analysis Agent)
**수신**: S4 (SAST Runner)

---

## 요약

대형 업로드 서브프로젝트 `gateway-webserver` 분석 중,
S4 `/v1/scan` 단계에서 per-file timeout 경고와 gcc-fanalyzer timeout이 반복된 뒤,
S3 측에서 연속 `SAST stall 감지`가 발생했습니다.

이 요청은 최종 완료 전 클라이언트 대기를 중단했지만,
**stall 징후 자체는 requestId 단위로 명확히 재현**되었습니다.

---

## 재현 정보

- 요청 시각: 2026-04-04
- requestId: `e2e-1775276005-analyze`
- 대상 경로:
  - `/home/kosh/AEGIS/uploads/proj-60bf5eb4-bc1f-4275-b7d5-15db1f939935/gateway-webserver`
- 호출 흐름:
  - S3 Analysis Agent `deep-analyze`
  - Phase 1에서 S4 `POST /v1/scan`

---

## 관측 로그 근거

`log-analyzer trace_request(e2e-1775276005-analyze)` / `search_errors(service=s4-sast)` 기준:

### 1. 대형 입력 탐지
- `Running clang-tidy on 500 files`
- `Running gcc -fanalyzer (gcc) on 500 files`

### 2. 예산/타임아웃 경고
- `[WARN] Per-file timeout floor (10s) may exceed budget (450s for 63 batches)` (2회)

### 3. 실제 timeout 발생
- `[WARN] gcc -fanalyzer timed out for libraries/civetweb/src/third_party/duktape-1.8.0/src-separate/duk_js_compiler.c (10s)`
- `[WARN] gcc -fanalyzer timed out for .../duktape.c` 다수

### 4. 상위 호출자(S3) 관측
- `SAST stall 감지` at approximately:
  - `+2m42s`
  - `+3m07s`
  - `+3m34s`
  - `+4m01s`

즉, 하위 스캔이 오래 지속되며 S3에서 정상 heartbeat로 보기 어려운 구간이 반복됐습니다.

---

## 계약 기준 기대 동작

`docs/api/sast-runner-api.md` 및 현재 heartbeat/stall 협업 기대상,
대형 프로젝트에서도 상위 호출자가 진행 상태를 판단할 수 있도록
스캔이 **예측 가능하게 진행**되거나,
적어도 timeout/heartbeat 정책이 stall로 오인되지 않도록 조정되어야 합니다.

---

## 요청 사항

1. `gateway-webserver` 규모 입력에서 `/v1/scan` 진행이 stall처럼 보이는 원인을 확인해 주세요.
2. `gcc-fanalyzer` 대형 vendored third-party 파일들(duktape 계열)에 대해
   - 제외 규칙 강화,
   - 배치/heartbeat 정책 조정,
   - timeout floor 재설계
   중 어떤 조치가 적절한지 검토해 주세요.
3. 상위 호출자(S3)가 stall로 판단하지 않도록 heartbeat/진행 신호를 더 촘촘히 줄 수 있는지 확인해 주세요.

---

## 영향

- 현재 S3 입장에서는 대형 프로젝트에서 **실제 hang과 장시간 진행을 구분하기 어려운 구간**이 존재합니다.
- 이 상태가 유지되면 live `deep-analyze` E2E가 장시간 대기 또는 중도 중단으로 이어질 수 있습니다.
