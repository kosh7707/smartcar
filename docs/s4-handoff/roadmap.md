# S4 SAST Runner — 로드맵

> 다음 작업 + 후순위 계획. README.md에서 분리.
> **마지막 업데이트: 2026-04-04**

---

## 즉시 다음

### 1. S3 WR: Build Snapshot consumer seam 정렬

- 대상 WR:
  - `docs/work-requests/s3-to-s4-build-snapshot-consumer-alignment.md`
- 목표:
  - S4가 snapshot-first world에서 어떤 입력 provenance를 수용할지 정리
  - `/v1/build`, `/v1/scan`, `/v1/build-and-analyze`, `/v1/discover-targets`의 역할 재정의
  - S4 authoritative evidence vs upstream snapshot identity/pass-through 경계를 문서화
- 현재 산출물:
  - `docs/s4-handoff/build-snapshot-consumer-seam.md`
  - `docs/work-requests/s4-to-s3-build-snapshot-consumer-alignment-response.md`

### 2. S3 WR: SDK env 적용 빌드 `exitCode=127` 원인 정리

- 대상 WR:
  - `docs/work-requests/s3-to-s4-sdk-build-exit127-certificate-maker.md`
  - `docs/work-requests/s3-to-s4-sdk-env-build-fallback.md`
- 현재 판단:
  - `environment-setup` source 이후 host dependency / shared library load 실패 가능성이 큼
  - S4는 현재 `exitCode` + `buildOutput`만 노출하고 있어 원인 가시성이 낮음
- 다음 runtime 작업 후보:
  - env-setup 실패 분류/메시지 개선
  - `buildOutput` / 실행 보고서에 SDK setup provenance 보강
  - fallback 자체는 S4가 묵시적으로 수행하지 않고 caller(S3/S2)가 명시적으로 판단하도록 유지

### 3. S3 WR: 대형 프로젝트 `/v1/scan` degraded 상태 명확화

- 대상 WR:
  - `docs/work-requests/s3-to-s4-large-scan-stall-gateway-webserver.md`
  - `docs/work-requests/s3-to-s4-large-project-sast-timeout-floor.md`
- 현재 판단:
  - `gateway-webserver`는 hard hang보다는 heavy analyzer 장기 실행 + vendor 파일 timeout이 겹친 degraded 동작에 가깝다
  - 상위 호출자(S3)가 이를 stall과 구분하기 어려운 신호 공백이 있다
- 다음 runtime 작업 후보:
  - heavy analyzer(vendor/third_party) 완화 정책 검토
  - timeout-floor / timedOutFiles / degraded 상태를 더 직접적으로 노출
  - heartbeat/진행 신호를 호출자 입장에서 stall-safe 하게 재설계

---

## 최근 완료

- ~~S3 WR: heartbeat 진행 지표 보강~~ — **완료** (2026-04-02, session-6). progress/status 필드, per-file progress, queued/running 상태, 동시성 기본값 2
- ~~S2 WR: cweId 메타데이터 표준화~~ — **완료** (2026-04-02, session-6). 전 도구 `metadata.cweId` 추가
- ~~version hygiene 정리~~ — **완료** (2026-04-03, session-7). `/v1/health` 버전 상수화, 활성 문서 버전 정렬
- ~~code graph 품질 평가 기준 수립~~ — **완료** (2026-03-31, session-4)
- ~~스트리밍 per-file 진행 이벤트~~ — **완료** (2026-04-02, session-6). gcc-fanalyzer/scan-build에서 파일별 progress 보고

---

## 잔여 고도화 (후순위)

- CWE-457 (56%) 추가 개선 — gcc-fanalyzer 한계, Semgrep 불가. 도구 자체 한계로 당장 개선 여지 적음
  - 6개 메트릭 정의 (Function Recall/Precision, Call Recall/Precision, Origin Accuracy, Parse Rate)
  - ground truth fixture + 평가 엔진 + 13개 통합 테스트
  - 현재 결과: 전 메트릭 100% (10함수, 20호출 edge, 5파일)
- Build Snapshot seam이 실제로 열리면 optional provenance field / execution echo runtime 반영
- `/v1/build-and-analyze`를 canonical orchestration surface에서 convenience surface로 단계적 축소

---

## 알려진 이슈

- tinydtls 버전: `libcoap/ext/tinydtls`에 configure.ac 없음 → 버전 미탐지
- wakaama 버전: 하위 tinydtls의 configure.ac를 잡아서 오탐
- clang-tidy + compile_commands.json: `-p` 연동 불안정
- `build-and-analyze`: 빌드 환경(SDK, 컴파일러)이 서버에 설치되어 있어야 함
- SDK env-setup 적용 시 host shared library / toolchain mismatch로 `exitCode=127` 재현 가능
- 대형 프로젝트에서 heavy analyzer timeout-floor warning과 vendor timeout이 상위 호출자 stall로 보일 수 있음

---

## 통합테스트 메모

### 2026-03-31 baseline

S3 Build Agent + Analysis Agent가 S4를 호출한 전체 흐름:

```
Build Phase (6m31s):
  S3-build → S4 /v1/build (3회) → 1-2회 실패(empty CC), 3회 부분실패(3 entries)
  → S3가 빌드 스크립트 자동 생성/수정, S4는 정상 실행

Analyze Phase (4m19s):
  S3-agent → S4 /v1/scan       → 107 findings (6도구, 6.0s)
  S3-agent → S4 /v1/functions  → 18 함수 (1.7s)
  S3-agent → S4 /v1/libraries  → 0 라이브러리 (1ms)
  S3-agent → S5 KB ingest      → 53 nodes, 54 edges
  S3-agent → S5 batch search   → CWE 11개 위협 조회
  S3-agent → S7 LLM (6턴)      → 4 claims (critical)
```

### 2026-04-04 live 관측

- `certificate-maker` SDK 적용 빌드 첫 시도에서 `exitCode=127`, SDK 제거 재시도 시 성공
- `gateway-webserver` 대형 scan에서 timeout-floor warning + `gcc -fanalyzer` vendor timeout 다수
- 위 2건 모두 S3 WR로 접수됐고, 현재는 docs/contract 정렬을 먼저 진행 중
