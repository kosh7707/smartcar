# S4 SAST Runner — 로드맵

> 다음 작업 + 후순위 계획. README.md에서 분리.
> **마지막 업데이트: 2026-04-02**

---

## 즉시 다음

현재 밀린 WR 없음.

---

## 최근 완료

- ~~S3 WR: heartbeat 진행 지표 보강~~ — **완료** (2026-04-02, session-6). progress/status 필드, per-file progress, queued/running 상태, 동시성 기본값 2
- ~~S2 WR: cweId 메타데이터 표준화~~ — **완료** (2026-04-02, session-6). 전 도구 `metadata.cweId` 추가
- ~~code graph 품질 평가 기준 수립~~ — **완료** (2026-03-31, session-4)
- ~~스트리밍 per-file 진행 이벤트~~ — **완료** (2026-04-02, session-6). gcc-fanalyzer/scan-build에서 파일별 progress 보고

---

## 잔여 고도화 (후순위)

- CWE-457 (56%) 추가 개선 — gcc-fanalyzer 한계, Semgrep 불가. 도구 자체 한계로 당장 개선 여지 적음
  - 6개 메트릭 정의 (Function Recall/Precision, Call Recall/Precision, Origin Accuracy, Parse Rate)
  - ground truth fixture + 평가 엔진 + 13개 통합 테스트
  - 현재 결과: 전 메트릭 100% (10함수, 20호출 edge, 5파일)

---

## 알려진 이슈

- tinydtls 버전: `libcoap/ext/tinydtls`에 configure.ac 없음 → 버전 미탐지
- wakaama 버전: 하위 tinydtls의 configure.ac를 잡아서 오탐
- clang-tidy + compile_commands.json: `-p` 연동 불안정
- `build-and-analyze`: 빌드 환경(SDK, 컴파일러)이 서버에 설치되어 있어야 함

---

## 통합테스트 결과 (2026-03-31)

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

PoC Phase (4건, 각 1-2분):
  S3-agent → S7 LLM            → PoC 생성 (S4 미관여)
```

S4 에러: **0건** | S4 경고: 4건 (빌드 실패 — S3 스크립트 문제)
