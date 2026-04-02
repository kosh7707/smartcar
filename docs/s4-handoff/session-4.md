# Session 4 — 코드그래프 품질 평가 기준 수립 (2026-03-31)

## 목표

S4가 생성하는 코드그래프(dump_functions)의 품질을 정량적으로 관리할 수 있는 평가 체계 수립.
S5(KB) 연동 완료 상태에서 그래프 품질이 S3 Agent 분석 정확도에 직접 영향을 주므로 기준 필요.

## 산출물

### 1. Ground truth fixture (`tests/fixtures/codegraph_project/`)

Multi-file C 서버 프로젝트 (5 소스 파일, 3 헤더, 1 서드파티 라이브러리):
- `src/main.c` — 진입점, 크로스 파일 호출
- `src/server.c` — 서버 초기화 + 클라이언트 핸들링
- `src/handler.c` — 요청 처리 + 위험 함수(`system`) 호출
- `src/logger.c` — 로깅 + 자기 참조 호출
- `third-party/minijson/minijson.c` — 서드파티 라이브러리 (origin 태깅 테스트)

### 2. 기대 코드그래프 (`expected_codegraph.json`)

10개 함수, 20개 호출 edge, origin 태깅 2세트 (unmodified/modified), skip_paths 테스트, 임계값 정의.

### 3. 평가 엔진 (`benchmark/codegraph_evaluator.py`)

- `evaluate_codegraph()` — Function Recall/Precision, Call Recall/Precision, Parse Rate
- `evaluate_origin()` — Origin Accuracy
- `CodeGraphMetrics` — 메트릭 클래스 (to_dict, to_markdown, check_thresholds)

### 4. 통합 테스트 (`tests/test_codegraph_quality.py`)

13개 테스트 (5 클래스):

| 클래스 | 테스트 수 | 검증 내용 |
|--------|:---:|------|
| TestCodeGraphQuality | 4 | 함수/호출 recall+precision, parse rate, 임계값 일괄 |
| TestHeaderFiltering | 2 | 시스템 헤더 함수 미혼입, __builtin 미혼입 |
| TestOriginTagging | 3 | unmodified, modified, user code 태깅 정확도 |
| TestSkipPaths | 1 | 서드파티 경로 제외 |
| TestGraphConnectivity | 3 | 크로스 파일 호출, 위험 함수, edge density |

### 5. 문서 갱신

- `docs/specs/sast-runner.md` — 9절에 "코드그래프 품질 평가 기준" 서브섹션 추가
- `docs/s4-handoff/roadmap.md` — 완료 항목 이동
- `docs/s4-handoff/README.md` — 테스트 수 351개로 갱신

## 6개 품질 메트릭 (현재 결과)

| 메트릭 | 현재 값 | 임계값 |
|--------|:---:|:---:|
| Function Recall | **100%** | 90% |
| Function Precision | **100%** | 90% |
| Call Recall | **100%** | 80% |
| Call Precision | **100%** | 85% |
| Origin Accuracy | **100%** | 100% |
| Parse Rate | **100%** | 100% |

## 테스트 결과

```
351 passed, 1 warning in 7.86s
```

기존 338개 테스트 + 신규 13개 = 351개 전부 통과. 기존 테스트에 영향 없음.
