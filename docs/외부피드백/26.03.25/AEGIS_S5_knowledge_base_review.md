# S5 리뷰: Knowledge Base / GraphRAG

## 검토 범위

- `docs/specs/knowledge-base.md`
- `docs/api/knowledge-base-api.md`
- `docs/s5-handoff.md`
- `services/knowledge-base/app/*`
- `services/knowledge-base/app/graphrag/*`
- `services/knowledge-base/app/routers/*`
- `services/knowledge-base/tests/*`

---

## 한 줄 판단

S5는 AEGIS를 단순 분석 파이프라인이 아니라 **기억을 가진 분석 시스템**으로 바꾸는 서비스다.  
공개 저장소 기준으로도 설계 밀도와 문서 성숙도가 높고, 레버리지가 매우 크다.  
다만 운영 복잡도와 ontology/memory 정책은 다음 단계에서 반드시 정리해야 한다.

---

## 지금 이미 잘 된 점

### 1. 역할이 분명하다

S5는 세 가지를 한 서비스 안에서 다루지만, 적어도 개념적으로는 구분이 되어 있다.

- 위협 지식(Threat Knowledge)
- 코드 그래프(Code Graph)
- 프로젝트 메모리(Project Memory)

이 분리는 매우 중요하다.  
GraphRAG 시스템이 실패하는 흔한 이유는 서로 다른 지식 층위를 한데 뭉개기 때문이다.  
S5는 적어도 그 위험을 의식하고 있다.

### 2. Neo4j + Qdrant 조합이 목적에 맞다

이 프로젝트는 단순 벡터 검색만으로는 충분하지 않다.  
왜냐하면 AEGIS는 다음을 모두 다루기 때문이다.

- 명시적 취약점/공격 기법 관계
- 함수 간 호출 관계
- 프로젝트별 기억과 과거 판단
- ID 기반 탐색(CWE/CVE/CAPEC/ATT&CK)
- 의미 기반 검색

따라서 그래프와 벡터를 같이 두는 판단은 맞다.

### 3. `knowledge_assembler` 계층이 좋다

많은 KB 서비스가 “DB를 조회해 그대로 내보내는 API”에서 멈춘다.  
반면 S5는 vector와 graph를 조합하는 assembling 계층을 둔다.

이건 중요하다.  
검색 인프라와 **질의 의미를 조합하는 애플리케이션 계층**은 분리되는 편이 좋다.

### 4. project memory가 별도로 존재하는 것이 아주 좋다

보안 분석에서는 “과거에 false positive였는가”, “이미 accepted risk인가”, “이 프로젝트에서 어떤 규칙을 선호하는가” 같은 정보가 반복적으로 필요하다.

project memory를 별도 서비스 책임으로 둔 것은 매우 좋은 선택이다.  
특히 analysis-agent와 연결될 때 큰 힘을 발휘한다.

### 5. 테스트 의식이 높다

문서에 테스트 수와 주요 테스트 범주까지 적어 둔 점은 좋다.  
이는 단순 구현이 아니라 **지속 가능한 서비스**를 지향한다는 신호다.

---

## 서비스 경계 / 계약 관점 피드백

### 강한 점

S5는 “상위 서비스가 질의할 수 있는 지식 서비스”라는 역할이 선명하다.  
직접 결론을 내리지 않고,
- search
- graph lookup
- code graph ingestion
- project memory
같은 재사용 가능한 기능을 제공한다.

이 구조는 S2/S3/S7과 매우 잘 맞는다.

### 더 좋아질 점

지금은 S5가 꽤 많은 개념을 품고 있으므로, 장기적으로는 내부 경계를 더 명시할 가치가 있다.

예를 들면 다음 세 하위 도메인을 문서 수준에서 더 강하게 구분하면 좋다.

- Threat KB
- Project Code Graph
- Project Memory

이렇게 되면 어느 API가 어떤 데이터 생애주기를 가지는지 더 명확해진다.

---

## 코드 레벨 상세 피드백

### 1. lifespan 초기화 전략은 현실적이지만, 운영 정책이 더 필요하다

Qdrant와 Neo4j를 앱 시작 시 묶고, 그래프가 unavailable이면 대체 객체로 처리하는 전략은 실용적이다.  
초기 단계에서는 좋은 선택이다.

다만 이후에는 다음이 필요하다.

- startup readiness 기준
- 어떤 의존성이 없을 때 degraded mode로 갈지
- degraded mode에서 어떤 API를 막을지
- health와 readiness를 구분할지

지금은 “돌아가게 하는” 수준에서 한 단계 더 가야 한다.

### 2. 200 응답 안에 에러를 담는 패턴은 조심해야 한다

일부 초기 서비스에서 흔히 쓰는 방식이지만, 호출자 입장에서 오류 처리 일관성을 해칠 수 있다.  
특히 S2나 S3가 자동화된 워크플로를 돌릴 때는 HTTP 의미론이 더 분명한 편이 좋다.

권장:
- transport error와 semantic no-result를 구분
- partial unavailable과 total unavailable을 분리
- error envelope를 통일하되 status code 의미는 살릴 것

### 3. ontology와 ID 추출 규칙은 앞으로 더 중요한 자산이 된다

정규표현식 기반 ID 추출은 현재 목적에 잘 맞는다.  
다만 시간이 지나면 ontology versioning이 필요해진다.

예:
- CWE와 CAPEC 관계 버전
- ATT&CK / automotive taxonomy 업데이트
- internal knowledge source provenance
- 어떤 relation이 curated인지 imported인지 구분

이건 단순 “지식이 많다”보다 훨씬 중요하다.  
지식 그래프의 힘은 **정합성과 출처**에서 온다.

### 4. project memory는 강력한 만큼 위험하다

메모리가 쌓이기 시작하면 큰 힘이 생긴다.  
반대로 오래된 기억, 잘못된 판단, 팀 취향이 누적되어 분석을 왜곡할 위험도 있다.

따라서 다음 질문을 빨리 정해야 한다.

- 메모리는 누가 생성할 수 있는가?
- 어떤 타입은 자동 저장해도 되는가?
- false positive memory는 언제 만료되는가?
- resolved memory는 코드 변경 이후에도 유지되는가?
- memory deduplication 기준은 무엇인가?

이건 S5의 핵심 정책 문제다.

### 5. 저장소 위생과 운영 복잡도를 같이 관리해야 한다

루트에 남아 있는 stray file은 작지만 좋지 않은 신호다.  
S5는 외부 저장소를 다루는 서비스이기 때문에, 이런 사소한 위생 문제도 운영 성숙도 인상에 영향을 준다.

---

## 아키텍처 방향 제안

S5는 앞으로 내부적으로 다음 세 레이어를 더 분명히 하면 좋다.

### 1. Storage Layer
- Neo4j
- Qdrant
- NVD client
- import / ETL

### 2. Knowledge Layer
- node / edge ontology
- ID normalization
- project memory policy
- code graph schema

### 3. Retrieval / Assembly Layer
- vector search
- graph neighborhood
- hybrid merge
- ranking / fusion
- output shaping

이 분리가 선명해질수록, S5는 단순 “DB 많이 붙인 서비스”가 아니라  
**지식 기반 애플리케이션 계층**으로 설명된다.

---

## 우선순위 제안

### 바로 할 것

1. stray file 정리  
2. error/status semantics 정리  
3. ontology/versioning 메모 초안 작성  
4. project memory lifecycle 정책 정의

### 다음 단계

1. backup/export/import 전략  
2. code graph schema migration 전략  
3. knowledge provenance 표시 강화  
4. degraded mode / readiness 정책 정교화

---

## 팀 내부에서 바로 토론할 질문

1. Threat KB, Code Graph, Project Memory는 한 서비스 안의 세 모듈인가, 아니면 사실상 세 개의 하위 제품인가?  
2. “project memory”를 지식으로 볼 것인가, 운영 캐시로 볼 것인가?  
3. S5가 반환하는 것은 검색 결과인가, 분석 보조 맥락인가, 아니면 둘 다인가?

---

## 최종 판단

S5는 AEGIS 전체에서 가장 **레버리지 높은 서비스** 중 하나다.  
이 서비스가 좋아질수록 S3와 S7은 더 안정적인 맥락 위에서 동작할 수 있고, S2는 더 설명 가능한 결과를 만들 수 있다.

따라서 앞으로의 방향은:
- 더 많은 데이터 적재보다
- 더 명확한 ontology
- 더 엄격한 memory 정책
- 더 안정적인 retrieval semantics

즉, S5는 단순한 RAG 서비스가 아니라  
**AEGIS의 기억과 설명력을 담당하는 핵심 기반**으로 키울 가치가 있다.
