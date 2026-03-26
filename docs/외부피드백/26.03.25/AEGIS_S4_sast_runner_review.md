# S4 리뷰: SAST-runner

## 검토 범위

- `docs/specs/sast-runner.md`
- `docs/api/sast-runner-api.md`
- `docs/s4-handoff.md`
- `services/sast-runner/app/*`
- `services/sast-runner/app/scanner/*`
- `services/sast-runner/rules/automotive/*`
- `services/sast-runner/tests/*`

---

## 한 줄 판단

S4는 10일 내 개발된 서비스라는 사실을 감안하면 **비정상적으로 성숙한 결정론적 코어**다.  
이 서비스는 이미 “여러 도구를 한데 묶은 래퍼” 수준을 넘어서, AEGIS 전체의 기술적 신뢰도를 떠받치는 핵심 엔진이다.

---

## 지금 이미 잘 된 점

### 1. 역할 정의가 명확하다

S4는 자신이 무엇을 하지 말아야 하는지까지 안다.

- UI를 하지 않는다
- CVE 판단이나 고수준 추론을 하지 않는다
- LLM을 직접 다루지 않는다
- 결정론적 전처리/분석/빌드 보조에 집중한다

이런 자기 절제는 좋다.  
특히 보안 플랫폼에서는 “여기서도 저기서도 판단”이 시작되면 결과 의미가 흐려진다.

### 2. endpoint 구성이 실제로 유용하다

`scan`, `functions`, `includes`, `metadata`, `libraries`, `build`, `build-and-analyze`, `discover-targets`, `sdk-registry`, `health`는 매우 좋은 조합이다.

이 구성이 좋은 이유:
- 스캔 결과만 주지 않는다
- 함수/인클루드/메타데이터/라이브러리 같은 **중간 산물**을 제공한다
- S2와 S3가 상위 워크플로를 짤 수 있게 해 준다

즉, S4는 단순 실행기가 아니라 **정적 분석 데이터 공급자**다.

### 3. multi-tool orchestration이 진지하다

`semgrep`, `cppcheck`, `flawfinder`, `clang-tidy`, `scan-build`, `gcc-fanalyzer`를 병렬로 돌리고,
언어군이나 build profile에 따라 ruleset을 선택하며,
SDK include path를 보정하는 구조는 상당히 좋다.

이건 단순 툴 실행이 아니라 **정적 분석 조정 계층**에 가깝다.

### 4. code graph와 SCA까지 연결한다

project path 기반 스캔에서 라이브러리 식별, SCA 라이브러리 결과, code graph dump까지 엮는 점은 매우 좋다.  
이 덕분에 S4는 S5, S3와 연결될 때 큰 레버리지를 만든다.

### 5. benchmark 의식이 있다

Juliet benchmark 수치를 문서에 넣은 것은 좋다.  
정확한 수치의 절대값보다 중요한 것은, **서비스가 스스로를 측정 가능한 대상으로 본다**는 점이다.

---

## 서비스 경계 / 계약 관점 피드백

### 강한 점

S4는 서비스 경계가 매우 선명하다.  
문서에서도 “무엇을 제공하고 무엇을 제공하지 않는지”가 분명하며, S2/S3가 소비할 수 있는 결정론적 API로 자신을 정의한다.

이건 “서로 코드를 안 본다”는 팀 구조와 매우 잘 맞는다.  
S4는 다른 서비스에게 결과와 중간 산물을 주면 되고, 해석은 위로 넘긴다.

### 더 좋아질 점

지금도 좋지만, S4는 앞으로 더 “플랫폼적인 API”가 될 수 있다.  
즉, 단순 엔드포인트 설명을 넘어서 다음이 더 명확해지면 좋다.

- execution report schema
- tool별 partial failure semantics
- path validation / exclusion semantics
- code graph 산물의 버전과 안정성
- build artifact / compile command 산출 규격

---

## 코드 레벨 상세 피드백

### 1. 라우터와 오케스트레이션의 책임이 크다

`router/scan.py`와 `orchestrator.py`는 매우 중요한 일을 많이 한다.  
현재는 잘 돌아가더라도, 시간이 지나면 이 레이어가 너무 많은 분기를 품을 위험이 있다.

권장:
- 입력 정규화
- 툴 실행 계획 수립
- 툴 실행
- 결과 통합
- 부가 산물(code graph, library, metadata) 생성
- 응답 변환
을 더 의식적으로 분리하라.

현재 S4는 이미 규모가 작지 않다.

### 2. path 검증과 외부 결과 필터링은 좋다

절대경로/상위 디렉터리 탈출 방지, 빌드/외부 디렉터리 제외, external finding 필터링 같은 부분은 아주 좋은 습관이다.  
이런 부분이 쌓여야 나중에 “도구 신뢰도”가 생긴다.

### 3. ruleset selector와 automotive rules는 가치가 크다

자동차 도메인을 목표로 한다면 S4가 가장 많은 도메인 가치가 들어가는 곳이다.  
현재 automotive rules를 별도 자산으로 둔 것은 좋다.

권장 방향:
- CWE/Rule ID/Severity/Justification 구조 정교화
- 왜 automotive에서 중요한지 근거를 메타데이터로 포함
- S2/S1 보고서에서 rule lineage를 보여줄 수 있게 설계

### 4. 도구 의존성 재현성이 중요해질 것이다

S4의 성능은 내부 코드보다 외부 분석 도구 및 환경의 영향을 많이 받는다.  
따라서 장기적으로는 다음을 반드시 다뤄야 한다.

- 도구 버전 고정
- OS별 차이 관리
- SDK 환경 재현
- build toolchain containerization
- benchmark fixture의 재실행성

이 서비스는 코드가 좋아도 환경이 흔들리면 전체 평가가 떨어진다.

### 5. 저장소 위생 이슈는 빨리 치워야 한다

오브젝트 파일이 저장소에 남아 있는 건 단기 프로젝트에서 흔하지만, S4 같은 핵심 분석 서비스에는 특히 좋지 않다.  
신뢰와 재현성에 불필요한 의심을 만든다.

이건 기능 문제가 아니라 **프로젝트 인상 관리의 핵심**이다.

---

## 테스트 및 평가 관점 피드백

S4는 benchmark 감각이 있다는 점에서 강하다.  
다만 앞으로는 테스트를 세 층으로 나누는 것이 좋다.

### 1. parser / merger / selector 단위 테스트
- SARIF parser
- ruleset selector
- tool result merger
- include/library resolver

### 2. fixture 기반 통합 테스트
- 작은 C 프로젝트
- 작은 C++ 프로젝트
- 헤더 누락 케이스
- 외부 라이브러리 포함 케이스
- cross-compile or SDK 케이스

### 3. benchmark / regression pack
- Juliet
- 사내/연구용 작은 자동차 도메인 예제
- false positive regression set

이렇게 나누면 “코드가 맞다”와 “도구로서 믿을 수 있다”를 동시에 보여줄 수 있다.

---

## 우선순위 제안

### 바로 할 것

1. 저장소 위생 정리  
2. execution report / partial failure schema 명시  
3. fixture 기반 통합 테스트 확대  
4. toolchain 버전 고정 전략 정리

### 다음 단계

1. benchmark pack 고도화  
2. compile_commands / build metadata를 더 일관된 아티팩트로 승격  
3. automotive rules 메타데이터 강화  
4. S5로 넘기는 code graph 품질 평가 기준 수립

---

## 팀 내부에서 바로 토론할 질문

1. S4의 최종 산출물은 “finding list”인가, 아니면 “정적 분석 근거 패키지”인가?  
2. tool 간 충돌하거나 상반된 결과가 나올 때 우선순위 규칙은 어디까지 S4가 가져야 하는가?  
3. code graph 생성 책임은 S4에 계속 두는 것이 맞는가, 아니면 장기적으로 별도 계층으로 옮길 가치가 있는가?

---

## 최종 판단

S4는 현재 AEGIS에서 가장 강한 결정론적 자산 중 하나다.  
그리고 이 프로젝트가 LLM 중심이 아니라 **근거 중심**이라는 사실을 가장 잘 증명하는 서비스이기도 하다.

앞으로의 방향은 분명하다.

- 더 많은 기능보다
- 더 좋은 재현성
- 더 좋은 benchmark
- 더 좋은 아티팩트 규격

즉, S4는 “툴 묶음”이 아니라 **정적 분석 플랫폼 코어**로 발전할 자격이 있다.
