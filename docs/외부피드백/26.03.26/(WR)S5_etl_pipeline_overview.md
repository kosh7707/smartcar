# S5 Knowledge Base — 위협 지식 ETL 파이프라인

> **작성일**: 2026-03-26 (피드백 반영 개정: 2026-03-26)
> **작성자**: S5 (Knowledge Base)
> **대상 독자**: 외부 리뷰어, 프로젝트 평가자

---

## 1. Executive Summary

AEGIS Knowledge Base(S5)는 자동차 임베디드 소프트웨어의 보안 취약점 분석을 위해, 벡터 검색(Qdrant)과 관계 탐색(Neo4j)을 결합한 **하이브리드 위협 지식 기반**을 운영한다. 본 문서가 설명하는 ETL 파이프라인은 CWE, ATT&CK, CAPEC **세 계열**의 공개 위협 지식을 수집·정규화·교차참조·적재하는 오프라인 빌드 과정이다. CVE/NVD는 현재 정적 적재 범위에서 제외하고, 프로젝트별 실제 의존성 기반의 런타임 조회 계층에서 다룬다.

```
본 문서의 범위
  포함: CWE XML, ATT&CK ICS/Enterprise STIX, CAPEC XML의 정적 ETL
  제외: CVE/NVD 런타임 조회, KB 서비스 API 상세, SAST Runner 연동 상세
```

```
[외부 데이터 소스]           [ETL Pipeline]                    [AEGIS KB]

 CWE (MITRE)  ──┐                                        ┌─ Qdrant 벡터 DB
 ATT&CK (MITRE) ┼──→  수집 → 정규화 → 교차참조 → 적재 ──┤   (시맨틱 검색)
 CAPEC (MITRE)  ──┘                                        └─ Neo4j 그래프 DB
                                                              (관계 탐색)
```

---

## 2. AEGIS 분석 흐름에서의 위치

AEGIS는 소스 코드를 정적 분석(SAST)한 뒤, 발견된 취약점을 **위협 지식과 대조**하여 심각도와 공격 경로를 판단한다. ETL 파이프라인은 이 지식 대조의 선행 단계이다.

```
소스 코드 → S4(Static Analysis Runner) → 취약점 후보 발견
                                               │
                                               ▼
                                        S5(Knowledge Base)
                                         "이 CWE-787(Out-of-bounds Write)은
                                          어떤 ATT&CK 기법과 연관되는가?
                                          자동차 도메인에서 어떤 공격 표면이 위험한가?"
                                               │
                                               ▼
                                        S3(Analysis Agent) → 종합 판단 → Finding 생성
```

ETL 파이프라인이 없으면 Knowledge Base에 지식이 없고, 분석 에이전트는 취약점의 맥락을 파악할 수 없다.

---

## 3. 범위 정의

### 3.1 정적 ETL 범위

ETL이 적재하는 데이터는 **세 계열의 지식 원천**으로 분류되며, 물리적으로는 **네 개의 입력 데이터셋**으로 구성된다.

| 구분 | 지식 계열 | 입력 데이터셋 | 포맷 |
|------|----------|-------------|------|
| 취약점 분류 | CWE | CWE XML (mitre.org) | XML (ZIP) |
| 공격 기법 | ATT&CK | ATT&CK ICS STIX (GitHub) | STIX 2.1 JSON |
| | | ATT&CK Enterprise STIX (GitHub) | STIX 2.1 JSON |
| 공격 패턴 | CAPEC | CAPEC XML (mitre.org) | XML |

"세 계열"은 지식의 성격을 말하고, "네 개 데이터셋"은 물리적 입력 파일을 말한다.

### 3.2 CVE는 왜 ETL에서 제외되었는가

| 항목 | ETL 사전 적재 (이전) | 런타임 조회 (현재) |
|------|--------------------|--------------------|
| **데이터 선도** | 빌드 시점에 고정 | 항상 최신 NVD 데이터 |
| **정밀도** | 키워드 기반 수집 → 노이즈 多 | 프로젝트의 실제 라이브러리+버전으로 정밀 매칭 |
| **적재량** | 수만 건 (대부분 무관) | 프로젝트당 수십 건 (전부 관련) |
| **소요 시간** | ETL에 수십 분 추가 | 배치 20개 기준 4~7초 |

**결론**: CVE는 프로젝트의 실제 의존성에 따라 동적으로 조회하는 것이 더 정확하고 효율적이다. 현재 CVE 정보는 별도 런타임 조회 계층에서 제공되며, 프로젝트의 실제 라이브러리 및 버전 기준으로 동적으로 결합된다.

> 코드와 자료구조에는 CVE 처리를 위한 필드(`related_cve`, `source: "CVE"` 등)가 존재하나, 이는 런타임 enrichment 계층 및 레거시 호환용이며 기본 ETL 빌드에서는 비활성화(`--include-nvd` 미사용)된다.

### 3.3 Neo4j 축소 운영 모드

Neo4j 시드(`--seed`)는 ETL의 후속 선택 단계이다. 미수행 시 KB 서비스는 벡터 검색 중심의 **축소 운영 모드(degraded mode)**로 동작한다. `_NullGraph` 폴백이 투입되어 그래프 관련 호출은 빈 결과를 반환하며, 일부 기능은 사용 불가(503)하다.

| 기능 | Neo4j 가용 | Neo4j 미가용 |
|------|-----------|------------|
| 벡터 시맨틱 검색 | 정상 | 정상 |
| ID 직접 조회 (CWE-787 등) | 정상 | 비활성화 (`_NullGraph` → `None`) |
| 그래프 이웃 확장 | 정상 | 비활성화 (빈 리스트) |
| 그래프 관계 보강 | 정상 | 비활성화 (빈 딕셔너리) |
| 프로젝트 메모리 API | 정상 | 503 Service Unavailable |
| 코드 그래프 API | 정상 | 503 Service Unavailable |
| `/v1/ready` probe | `ready: true` | `ready: false` (503) |

> 이 축소 모드는 명시적으로 이름이 붙은 설계 모드가 아니라, Neo4j 미연결 시의 사실상(de facto) 폴백 동작이다.

---

## 4. 데이터 소스와 선택 근거

### 4.1 세 계열의 역할

단일 소스만으로는 보안 위협의 전체 그림을 볼 수 없다.

| 지식 원천 | 제공하는 정보 | 단독으로는 부족한 점 |
|----------|-------------|-------------------|
| **CWE** | 취약점 유형 분류 체계 (944건) | "이 취약점이 실제로 어떻게 악용되는지" 모름 |
| **ATT&CK** | 실제 공격 기법·전술 (509건) | "어떤 코드 결함에서 비롯되는지" 모름 |
| **CAPEC** | 공격 패턴 (558건) | CWE↔ATT&CK 연결 브릿지 역할 |

CWE와 ATT&CK 사이에는 직접 매핑이 존재하지 않는다. CAPEC이 양쪽을 모두 참조하므로, CAPEC을 경유해야만 연결이 성립된다.

```
CWE-787 (Out-of-bounds Write)
  ├─ CAPEC-100 (Overflow Buffers) ← CAPEC 브릿지
  │     └─ T0831 (Manipulation of Control) ← ATT&CK 기법
  └─ CAPEC-123 (Buffer Manipulation)
        └─ T1203 (Exploitation for Client Execution)
```

하나의 코드 결함(CWE)에서 출발하여 실제 공격 기법(ATT&CK)까지의 경로를 자동으로 추적할 수 있게 된다.

### 4.2 ATT&CK ICS + Enterprise 병합 정책

ATT&CK은 ICS(산업제어)와 Enterprise(일반 IT) 두 매트릭스를 통합한다.

| 항목 | 정책 |
|------|------|
| **우선순위** | ICS를 먼저 파싱하고, Enterprise를 후순위로 병합 |
| **Enterprise 필터링** | 관련 전술만 유지: initial-access, execution, persistence, privilege-escalation, defense-evasion, credential-access, lateral-movement |
| **플랫폼 제외** | SaaS, Office 365, Google Workspace, Azure AD 전용 기법 제거 |
| **중복 처리** | 동일 ATT&CK ID는 ICS 레코드를 우선하고 Enterprise 중복분을 제거 |
| **Sub-technique** | 포함 (T1234.001 형태) |

차량 보안 맥락에서 순수 OT 공격뿐 아니라 일반 소프트웨어 공격 기법도 유의미하므로 Enterprise 기법을 함께 유지한다.

---

## 5. 파이프라인 아키텍처

### 5.1 전체 흐름

```
Phase 1: 수집 (Download)
   │  입력: MITRE/GitHub URL
   │  출력: Raw XML/JSON → data/threat-db-raw/
   ▼
Phase 2: 정규화 + 분류 보강 (Parse + Enrich)
   │  입력: Raw XML/JSON
   │  출력: list[UnifiedThreatRecord] + CapecBridge
   ▼
Phase 3: 교차 참조 해소 (Crossref)
   │  입력: 정규화된 레코드 + CapecBridge
   │  출력: related_cwe/attack/capec 상호 보완된 레코드
   ▼
Phase 4: 벡터 DB 적재 (Load Qdrant)
   │  입력: 교차 참조 완료된 레코드
   │  출력: Qdrant 파일 컬렉션 threat_knowledge
   ▼
Phase 5: 통계 + 메타데이터 (Stats)
   │  출력: 콘솔 통계 + kb-meta.json
   └─ [선택] Neo4j 시드 (--seed 옵션 시)
```

### 5.2 Phase별 상세

#### Phase 1: 수집

| 소스 | URL | 캐시 위치 |
|------|-----|----------|
| CWE | `cwe.mitre.org/data/xml/cwec_latest.xml.zip` | `data/threat-db-raw/cwe/` |
| ATT&CK ICS | GitHub `mitre-attack/attack-stix-data` | `data/threat-db-raw/attack/` |
| ATT&CK Enterprise | GitHub `mitre-attack/attack-stix-data` | `data/threat-db-raw/attack/` |
| CAPEC | `capec.mitre.org/data/xml/capec_latest.xml` | `data/threat-db-raw/capec/` |

- 캐시가 존재하면 다운로드를 건너뛴다. `--fresh` 옵션으로 캐시를 삭제하고 재다운로드할 수 있다.
- 다운로드 실패 시 파이프라인이 중단된다 (부분 빌드는 지원하지 않음).
- 외부 소스는 공식 MITRE 배포 및 공식 GitHub repository에 한정한다.

#### Phase 2: 정규화 + 분류 보강

Phase 2는 두 단계로 구성된다.

**2a. 정규화 (Parse)**: 원천 데이터를 공통 스키마 `UnifiedThreatRecord`로 변환한다.

```python
class UnifiedThreatRecord:  # 요약 스키마 (전체 구현은 부록 C 참조)
    id: str                    # "CWE-787", "T0831", "CAPEC-100"
    source: str                # "CWE" | "ATT&CK" | "CAPEC"
    title: str
    description: str           # 임베딩 대상 텍스트
    threat_category: str       # "Memory Corruption", "Injection", ...
    severity: float | None     # 선택적 심각도 점수 (소스에 따라 상이, 아래 참고)
    attack_surfaces: list[str] # 해당 공격 표면 태그 (11종)
    mitigations: list[str]     # 완화 방안
    related_cwe: list[str]     # 교차 참조 필드 (Phase 3에서 채워짐)
    related_attack: list[str]
    related_capec: list[str]
    automotive_relevance: float # 도메인 관련성 점수 (0.0~1.0)
```

> `severity`: CWE/ATT&CK/CAPEC은 CVSS 점수를 본원적으로 제공하지 않는 지식 원천이다. 이 필드는 주로 CVE 런타임 enrichment 시 활용되며, MITRE 원천 레코드에서는 대부분 `None`이다.

**2b. 분류 보강 (Enrich)**: 정규화된 레코드에 도메인 관련성, 위협 카테고리, 공격 표면 태그를 부여한다.

**도메인 관련성 점수 (하이브리드)**:
- 키워드 매칭 (60%): 자동차·임베디드·시스템 키워드 63개 사전
- 임베딩 유사도 (40%): 도메인 참조 텍스트와의 코사인 유사도
- 두 점수를 가중 합산하여 키워드 누락 보완 + 시맨틱 커버리지 확보
- ATT&CK ICS 레코드에는 산업/자동차 관련성이 높으므로 `max(relevance, 0.3)` floor boost 적용

> `automotive_relevance`는 순수한 자동차 전용성만이 아니라 차량·임베디드·인접 제어 도메인에서의 분석 유용성을 함께 반영한 운영 지표이다. 현재 가중치(키워드 60% / 임베딩 40%)와 threshold(0.2)는 소규모 수동 검토를 통해 정한 **경험적 휴리스틱**이며, 향후 labeled validation set을 구축하여 precision/recall 관점에서 재조정할 예정이다.

**위협 카테고리 분류 (CWE 계층 탐색)**:
- CWE ID를 8개 카테고리로 분류: Memory Corruption, Injection, Authentication/Authorization, Cryptography, Input Validation, Resource Management, Concurrency, Configuration/Deployment
- 직접 매칭 실패 시 CWE의 `ChildOf` 부모를 5단계까지 따라 올라감
- 이 탐색 도입으로 "Other" 비율을 89%→52%로 개선

> 부모 체인 탐색으로 대분류 분해 성능은 유의미하게 개선되었으나, Other 비율이 여전히 52%이다. 현재 카테고리는 정밀 분류기라기보다 **검색 보조용 coarse tag**로 사용하는 것이 적절하다.

**실용적 공격 표면 태그 세트 (11종)**:

본 11개 분류는 학술적 직교 분류체계가 아니라, 차량 보안 분석에서 검색·필터링 효율을 높이기 위한 **실용적 태그 세트**이다. 일부는 네트워크 인터페이스, 일부는 차량 서브시스템, 일부는 소프트웨어 계층이다.

| 분류 축 | 태그 |
|--------|------|
| 네트워크/인터페이스 | CAN Bus/차량 내부 네트워크, V2X/텔레매틱스, 충전 인프라 |
| 차량 서브시스템 | IVI/헤드유닛, ECU/게이트웨이, ADAS/자율주행, 키/인증 시스템 |
| 소프트웨어/플랫폼 | OTA/펌웨어 업데이트, 임베디드/RTOS, 시스템 라이브러리 |
| 인접 도메인 | 산업제어/ICS |

분류 기준은 키워드 매칭을 사용한다. 임베딩 유사도는 일반 보안 설명과 자동차 특화 참조 간 의미 격차가 커서(유사도 0.1~0.25) 현재 실험 범위에서는 적합성이 낮았다.

#### Phase 3: 교차 참조 해소

CAPEC을 브릿지로 활용하여 세 계열 간 양방향 관계를 해소한다.

```
         ┌──── CAPEC 브릿지 ────┐
         │                      │
    CWE ←┼─ capec_to_cwe       │
         │  cwe_to_capec ──────→├─ CAPEC
         │                      │
 ATT&CK ←┼─ capec_to_attack    │
         │  attack_to_capec ───→│
         └──────────────────────┘
```

결과: 모든 레코드에 `related_cwe`, `related_attack`, `related_capec` 필드가 상호 보완된다.

> crossref 엔진은 범용 구조로 설계되어 CVE 레코드도 처리 가능하나, 현재 기본 빌드에서는 빈 리스트(`[]`)가 전달된다. 따라서 CVE 관련 교차 참조 경로는 실행되지만 처리 대상이 없어 no-op이다.

#### Phase 4: 벡터 DB 적재 (Qdrant)

| 항목 | 값 |
|------|-----|
| 임베딩 모델 | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (384차원) |
| 컬렉션 | `threat_knowledge` |
| 스토리지 | 파일 기반 (서버 프로세스 불필요) |
| 배치 크기 | 100건씩 |
| 임베딩 대상 | `{title}\n{description}\nMitigation: {mitigations}` |

메타데이터(id, source, severity, related_*, automotive_relevance 등)가 벡터와 함께 저장되어 필터링 검색을 지원한다.

#### Phase 5: 통계 + Neo4j 시드

- **통계**: 소스별 레코드 수, 도메인 관련 비율, 공격 표면 분포, 위협 카테고리 Top 10
- **kb-meta.json**: 빌드 타임스탬프, 각 소스 버전 기록 (재현성 추적)
- **Neo4j 시드** (`--seed`): Qdrant 메타데이터를 Neo4j 그래프로 이전 (미수행 시 3.3절 축소 운영 모드)

---

## 6. 저장소 모델

### 6.1 Qdrant 벡터 DB

| 항목 | 값 |
|------|-----|
| 타입 | 파일 기반 (서버 프로세스 없음) |
| 경로 | `services/knowledge-base/data/qdrant/` |
| 컬렉션 | `threat_knowledge` |
| 임베딩 모델 | paraphrase-multilingual-MiniLM-L12-v2 (384차원, 12-layer multilingual BERT) |
| 용도 | 자연어 쿼리의 시맨틱 유사도 검색 |

### 6.2 Neo4j 그래프 DB

| 항목 | 값 |
|------|-----|
| 버전 | Neo4j Community 5.26.3 |
| 접속 | bolt://localhost:7687 |
| 용도 | 위협 지식 간 관계 탐색, 이웃 확장 |

**노드 레이블**: `CWE`, `Attack`, `CAPEC`, `KBMeta`

**관계 타입**:
- `(:CWE)-[:RELATED_CAPEC]->(:CAPEC)`
- `(:CWE)-[:RELATED_ATTACK]->(:Attack)`
- `(:CAPEC)-[:RELATED_CWE]->(:CWE)`
- `(:CAPEC)-[:RELATED_ATTACK]->(:Attack)`

### 6.3 kb-meta.json

빌드 메타데이터로, 각 소스의 버전과 빌드 타임스탬프를 기록한다. Neo4j 시드 시 `:KBMeta` 노드로도 저장된다.

---

## 7. 빌드 스냅샷 (2026-03-26 기준)

| 지표 | 값 | 해석 |
|------|-----|------|
| **CWE 노드** | 944건 (v4.19.1, 2026-01-21) | |
| **ATT&CK 노드** | 509건 (v18.1, ICS 83 + Enterprise 426) | |
| **CAPEC 노드** | 558건 (v3.9, 2023-01-24) | 빌드 시점 기준 MITRE 최신 공개 버전 |
| **전체 레코드** | 2,011건 | |
| **Neo4j 관계** | 3,542건 | |

**도메인 관련 레코드 (relevance >= 0.2)**:

| 소스 | 관련 비율 | 해석 |
|------|----------|------|
| CWE | ~48% | CWE는 범용 소프트웨어 취약점 분류이므로, 자동차/임베디드와 직접 관련 없는 항목이 다수 포함된다. |
| ATT&CK | 100% | ATT&CK ICS 레코드는 floor boost(`max(relevance, 0.3)`)가 적용되고, Enterprise 레코드는 관련 전술/플랫폼으로 사전 필터링된 subset만 적재한다. threshold 0.2를 두 조건 모두 통과하므로 전량 관련으로 분류된다. |
| CAPEC | ~35% | CAPEC은 범용 공격 패턴이므로 일부만 자동차/임베디드 맥락에서 직접 관련된다. |

---

## 8. 설계 판단과 트레이드오프

| 판단 | 근거 | 한계 및 향후 |
|------|------|-------------|
| CVE를 ETL에서 제외하고 런타임 조회로 전환 | 프로젝트별 실제 의존성 기반 정밀 매칭이 사전 적재보다 정확하고 효율적 | 런타임 조회 계층의 가용성에 의존 |
| 공격 표면 분류를 키워드 매칭으로 유지 | 임베딩 유사도는 일반 보안 설명↔자동차 도메인 간 의미 격차가 커서 현재 실험 범위에서는 적합성이 낮았다 (유사도 0.1~0.25) | 도메인 특화 임베딩 모델 도입 시 재평가 가능 |
| 도메인 관련성: 키워드(60%)+임베딩(40%) 하이브리드 | 키워드는 정확하지만 유의어 누락, 임베딩은 넓지만 도메인 추론 약함 | 경험적 휴리스틱. labeled validation set 구축 후 재조정 예정 |
| CWE 카테고리 분류에 부모 체인 5단계 탐색 | 직접 매칭만으로는 Other 89%. 부모 탐색으로 52%까지 개선 | Other 52%는 여전히 높음. 현 수준은 coarse tag 용도 |
| Qdrant 파일 기반 스토리지 | 2,000건 규모에서 별도 서버 불필요. 관리 단순화 | 동시 접근 제약(빌드 시 KB 서비스 중지 필요). 향후 병렬 빌드·온라인 재색인 필요 시 서버 모드 전환 검토 |
| CAPEC을 브릿지 겸 풀 노드로 승격 | CWE↔ATT&CK 직접 매핑 부재 → CAPEC 경유 간접 연결이 현재 채택한 공식 연결 경로 | MITRE가 향후 직접 매핑 제공 시 구조 변경 가능 |

---

## 9. Known Limitations and Future Work

| # | 한계 | 현재 상태 | 향후 방향 |
|---|------|---------|---------|
| 1 | Other 카테고리 비율 52% | 8개 상위 카테고리 + 5단계 부모 탐색 | 수작업 큐레이션 또는 다중 레이블 분류 검토 |
| 2 | relevance 가중치/threshold가 경험적 휴리스틱 | 소규모 수동 검토 기반 | labeled validation set 구축 후 precision/recall 재조정 |
| 3 | Qdrant 파일 락으로 빌드 시 서비스 중지 필요 | `--fresh` 시 서비스 중지 확인 | 서버 모드 또는 외부 Qdrant 전환 검토 |
| 4 | 다운로드 실패 시 전체 파이프라인 중단 | all-or-nothing (부분 빌드 미지원) | 소스별 독립 빌드 또는 이전 캐시 fallback 도입 |
| 5 | CAPEC 데이터 선도 (v3.9, 2023-01-24) | 빌드 시점 기준 MITRE 최신 공개 버전 | MITRE 릴리스 주기에 의존 |
| 6 | 소스 무결성 검증 없음 | 버전 및 메타데이터만 기록 | checksum 또는 schema validation 도입 검토 |
| 7 | `_NullGraph` 폴백이 명시적 모드가 아님 | 로그 경고만 출력, 클라이언트 알림 없음 | 명시적 degraded mode 시그널링 도입 |

---

## 부록 A. 실행 가이드

```bash
# 기본 실행 (Qdrant 적재만)
./scripts/knowledge-base/etl-build.sh

# Qdrant + Neo4j 시드
./scripts/knowledge-base/etl-build.sh --seed

# 캐시 삭제 후 전체 재빌드
./scripts/knowledge-base/etl-build.sh --fresh --seed
```

**운영 제약**:
1. KB 서비스(:8002)가 중지된 상태여야 한다 (Qdrant 파일 락 충돌 방지)
2. Python venv 설치 완료 (`services/knowledge-base/.venv/`)
3. `--seed` 사용 시 Neo4j 설치 필요 (`$NEO4J_HOME` 환경변수 또는 기본 `~/neo4j-community-5.26.3/`)

**소요 시간**: 약 2~5분 (다운로드 캐시 여부에 따라 차이)

---

## 부록 B. 파일 구조

```
services/knowledge-base/
├── scripts/
│   ├── neo4j-seed.py              # Qdrant → Neo4j 마이그레이션
│   └── threat-db/                 # ETL 파이프라인 모듈
│       ├── build.py               # 오케스트레이터 (Phase 1~5)
│       ├── schema.py              # UnifiedThreatRecord 스키마
│       ├── taxonomy.py            # 11개 공격 표면 태그 + 도메인 관련성
│       ├── download.py            # Phase 1: 데이터 수집
│       ├── parse_cwe.py           # Phase 2: CWE 파서
│       ├── parse_attack.py        # Phase 2: ATT&CK 파서 (ICS+Enterprise)
│       ├── parse_capec.py         # Phase 2: CAPEC 파서 + 브릿지
│       ├── crossref.py            # Phase 3: 교차 참조 엔진
│       ├── load_qdrant.py         # Phase 4: Qdrant 벡터 적재
│       ├── stats.py               # Phase 5: 통계
│       └── fmt.py                 # 터미널 출력 포매팅
├── data/
│   ├── qdrant/                    # Qdrant 파일 DB (ETL 결과물)
│   ├── kb-meta.json               # 빌드 메타데이터 (버전 추적)
│   └── threat-db-raw/             # 다운로드 캐시 (CWE XML, ATT&CK JSON, CAPEC XML)
└── scripts/knowledge-base/
    └── etl-build.sh               # ETL 실행 스크립트
```

---

## 부록 C. 핵심 알고리즘 코드

> 아래 코드는 설명 목적의 발췌본이며, 실행 가능한 완전한 코드가 아니다. 일부 자료구조는 런타임 enrichment 또는 레거시 호환 경로를 포함하는 **일반화된 구조**를 보여 주며, 현재 기본 ETL 빌드에서는 해당 경로가 비활성화 상태이다. 각 코드 블록에서 `[현재 비활성화]` 또는 `[런타임 enrichment]` 주석이 붙은 부분이 이에 해당한다.

### C.1 교차 참조 엔진 — `crossref.py`

세 계열 간 양방향 관계를 해소하는 핵심 엔진이다. ETL Phase 3에서 호출된다.

```python
"""교차 참조 엔진 -- CWE<->ATT&CK<->CAPEC (+ CVE 런타임 확장 시)"""

from collections import defaultdict
from schema import UnifiedThreatRecord, CapecBridge


def crossref(
    cwe_records: list[UnifiedThreatRecord],
    nvd_records: list[UnifiedThreatRecord],  # [현재 비활성화] 기본 빌드에서 빈 리스트 전달
    attack_records: list[UnifiedThreatRecord],
    capec_records: list[UnifiedThreatRecord],
    bridge: CapecBridge,
) -> list[UnifiedThreatRecord]:
    """소스 간 교차 참조 해소 후 통합 리스트 반환"""

    # [런타임 enrichment 경로] 기본 빌드에서는 nvd_records=[] → 빈 인덱스
    cwe_to_cves: dict[str, list[str]] = defaultdict(list)
    for cve in nvd_records:
        for cwe_id in cve.related_cwe:
            cwe_to_cves[cwe_id].append(cve.id)

    # 1. CVE -> ATT&CK (CWE 경유 간접) [현재 비활성화: nvd_records 비어있음]
    for cve in nvd_records:
        for cwe_id in cve.related_cwe:
            capec_ids = bridge.cwe_to_capec.get(cwe_id, [])
            for capec_id in capec_ids:
                attack_ids = bridge.capec_to_attack.get(capec_id, [])
                for aid in attack_ids:
                    if aid not in cve.related_attack:
                        cve.related_attack.append(aid)
                    if capec_id not in cve.related_capec:
                        cve.related_capec.append(capec_id)

    # 2. ATT&CK -> CWE (CAPEC 경유) — 현재 ETL의 핵심 경로
    for tech in attack_records:
        for capec_id in tech.related_capec:
            cwe_ids = bridge.capec_to_cwe.get(capec_id, [])
            for cwe_id in cwe_ids:
                if cwe_id not in tech.related_cwe:
                    tech.related_cwe.append(cwe_id)

        if not tech.related_cwe:
            capec_ids = bridge.attack_to_capec.get(tech.id, [])
            for capec_id in capec_ids:
                if capec_id not in tech.related_capec:
                    tech.related_capec.append(capec_id)
                cwe_ids = bridge.capec_to_cwe.get(capec_id, [])
                for cwe_id in cwe_ids:
                    if cwe_id not in tech.related_cwe:
                        tech.related_cwe.append(cwe_id)

        # [런타임 enrichment 경로] CWE 경유 CVE 역연결
        for cwe_id in tech.related_cwe:
            cve_ids = cwe_to_cves.get(cwe_id, [])
            for cve_id in cve_ids:
                if cve_id not in tech.related_cve:
                    tech.related_cve.append(cve_id)

    # 3. CWE -> ATT&CK (CAPEC 경유) — 현재 ETL의 핵심 경로
    for cwe in cwe_records:
        # [런타임 enrichment 경로] CWE -> CVE 역연결
        cve_ids = cwe_to_cves.get(cwe.id, [])
        for cve_id in cve_ids:
            if cve_id not in cwe.related_cve:
                cwe.related_cve.append(cve_id)

        capec_ids = bridge.cwe_to_capec.get(cwe.id, [])
        for capec_id in capec_ids:
            if capec_id not in cwe.related_capec:
                cwe.related_capec.append(capec_id)
            attack_ids = bridge.capec_to_attack.get(capec_id, [])
            for aid in attack_ids:
                if aid not in cwe.related_attack:
                    cwe.related_attack.append(aid)

    # 4. CAPEC -> CVE (CWE 경유 간접) [런타임 enrichment 경로]
    for capec in capec_records:
        for cwe_id in capec.related_cwe:
            cve_ids = cwe_to_cves.get(cwe_id, [])
            for cve_id in cve_ids:
                if cve_id not in capec.related_cve:
                    capec.related_cve.append(cve_id)

    return cwe_records + nvd_records + attack_records + capec_records
```

> **현재 ETL 기본 빌드와의 관계**: `build.py`에서 `crossref(cwe_records, [], attack_records, capec_records, capec_bridge)` 형태로 호출되며, `nvd_records`는 빈 리스트이다. 따라서 위 코드의 CVE 관련 경로(1번, 3번의 CWE→CVE, 4번의 CAPEC→CVE)는 실행되지만 처리 대상이 없어 no-op이다. 현재 ETL의 핵심 동작은 **2번(ATT&CK→CWE)**과 **3번(CWE→ATT&CK)**이다.

---

### C.2 도메인 관련성 하이브리드 점수 — `taxonomy.py`

```python
"""도메인 관련성 점수 — 키워드 + 임베딩 하이브리드"""

import numpy as np
from fastembed import TextEmbedding

# 자동차 + C/C++ 임베디드 + 시스템 프로그래밍 키워드 (63개)
AUTOMOTIVE_KEYWORDS: list[str] = [
    # 자동차
    "automotive", "vehicle", "car", "ecu", "can bus", "obd", "adas",
    "autosar", "iso 26262", "iso 21434", "telematics", "infotainment",
    "v2x", "ota", "firmware", "key fob", "immobilizer",
    # C/C++ 메모리 안전
    "buffer overflow", "use-after-free", "double free", "null pointer",
    "integer overflow", "format string", "memory corruption",
    # 임베디드/시스템
    "embedded", "microcontroller", "freertos", "zephyr", "rtos",
    "openssl", "mbedtls", "libcurl", "linux kernel", "busybox",
    # 산업제어
    "scada", "plc", "iec 62443", "modbus",
    # ... (총 63개)
]

_RELEVANCE_REF = (
    "automotive vehicle embedded firmware ECU microcontroller RTOS "
    "security vulnerability C/C++ memory safety buffer overflow "
    "CAN bus OBD AUTOSAR ISO 26262 ISO 21434"
)

_model: TextEmbedding | None = None
_relevance_vec: np.ndarray | None = None


def _ensure_model() -> None:
    global _model, _relevance_vec
    if _model is not None:
        return
    _model = TextEmbedding("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    _relevance_vec = np.array(list(_model.embed([_RELEVANCE_REF]))[0])


def _cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))


def compute_automotive_relevance(title: str, description: str) -> float:
    """하이브리드 도메인 관련성: 키워드(60%) + 임베딩 유사도(40%)."""
    kw_score = compute_automotive_relevance_keyword(title, description)

    _ensure_model()
    text_vec = np.array(list(_model.embed([f"{title} {description}"]))[0])
    emb_score = max(0.0, _cosine_sim(text_vec, _relevance_vec))

    combined = 0.6 * kw_score + 0.4 * emb_score
    return round(min(1.0, combined), 2)
```

---

### C.3 CWE 계층 기반 위협 카테고리 분류 — `taxonomy.py`

```python
CWE_THREAT_CATEGORIES: dict[str, list[str]] = {
    "Memory Corruption":            ["CWE-119", "CWE-120", "CWE-121", "CWE-122", "CWE-125",
                                     "CWE-787", "CWE-416", "CWE-415", "CWE-476", "CWE-190", ...],
    "Injection":                    ["CWE-74", "CWE-77", "CWE-78", "CWE-79", "CWE-89", ...],
    "Authentication/Authorization": ["CWE-287", "CWE-306", "CWE-798", "CWE-862", ...],
    "Cryptography":                 ["CWE-310", "CWE-326", "CWE-327", "CWE-330", ...],
    "Input Validation":             ["CWE-20", "CWE-22", "CWE-134", "CWE-352", ...],
    "Resource Management":          ["CWE-400", "CWE-401", "CWE-770", ...],
    "Concurrency":                  ["CWE-362", "CWE-366", "CWE-367", ...],
    "Configuration/Deployment":     ["CWE-250", "CWE-269", "CWE-276", ...],
}


def classify_threat_category(
    cwe_id: str,
    parent_map: dict[str, str] | None = None,
) -> str:
    """CWE ID → 위협 카테고리. 직접 매칭 실패 시 ChildOf 부모를 따라 올라감.

    parent_map은 CWE XML의 ChildOf 관계에서 구축된다.
    예: {"CWE-121": "CWE-119", "CWE-119": "CWE-118", ...}
    """
    # 1차: 직접 매칭
    for category, cwe_ids in CWE_THREAT_CATEGORIES.items():
        if cwe_id in cwe_ids:
            return category

    # 2차: 부모 체인 탐색 (최대 5단계)
    if parent_map:
        current = cwe_id
        for _ in range(5):
            parent = parent_map.get(current)
            if not parent:
                break
            for category, cwe_ids in CWE_THREAT_CATEGORIES.items():
                if parent in cwe_ids:
                    return category
            current = parent

    return "Other"
```

---

### C.4 Reciprocal Rank Fusion (RRF) — `knowledge_assembler.py`

3개 검색 경로(ID exact, graph neighbor, vector semantic)의 결과를 단일 순위로 융합하는 알고리즘이다. 런타임 하이브리드 검색에서 사용된다.

```python
@staticmethod
def _apply_rrf(result_lists: list[list[dict]], k: int = 60) -> list[dict]:
    """Reciprocal Rank Fusion — 여러 검색 결과 리스트를 융합한다.

    공식: score(d) = Σ 1/(k + rank + 1)  (각 리스트에서의 순위)
    k=60은 원논문(Cormack et al., 2009) 기본값.
    """
    rrf_scores: dict[str, float] = {}
    hit_map: dict[str, dict] = {}

    for result_list in result_lists:
        for rank, hit in enumerate(result_list):
            doc_id = hit["id"]
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + 1.0 / (k + rank + 1)
            if doc_id not in hit_map:
                hit_map[doc_id] = hit

    merged = []
    for doc_id, rrf_score in rrf_scores.items():
        hit = hit_map[doc_id].copy()
        hit["score"] = round(rrf_score, 6)
        merged.append(hit)

    merged.sort(key=lambda h: h["score"], reverse=True)
    return merged
```

**동작 예시** (k=60):

```
리스트 A (id_exact):      [CWE-787 (rank 0), CWE-119 (rank 1)]
리스트 B (graph_neighbor): [CWE-120 (rank 0), CWE-787 (rank 1)]
리스트 C (vector_semantic):[CWE-787 (rank 0), CWE-416 (rank 1)]

CWE-787: 1/(60+0+1) + 1/(60+1+1) + 1/(60+0+1) = 0.04891  ← 3개 리스트 모두 등장 → 최상위
CWE-119: 1/(60+1+1) = 0.01613
CWE-120: 1/(60+0+1) = 0.01639
CWE-416: 1/(60+1+1) = 0.01613
```

---

### C.5 하이브리드 검색 오케스트레이터 — `knowledge_assembler.py`

```python
class KnowledgeAssembler:
    """하이브리드 검색: ID 직접조회 + 벡터 유사도 + 그래프 보강 + RRF."""

    def assemble(
        self,
        query: str,
        *,
        top_k: int = 5,
        min_score: float = 0.35,
        graph_depth: int = 2,
        exclude_ids: list[str] | None = None,
        source_filter: list[str] | None = None,
    ) -> dict:
        """3경로 하이브리드 검색 → RRF 병합 → 그래프 보강."""
        seen_ids: set[str] = set(exclude_ids) if exclude_ids else set()
        extracted_ids = _extract_ids(query)  # 쿼리에서 CWE-*, CVE-*, T* 등 추출

        # 경로 1: ID 직접 조회 + 그래프 이웃 확장
        exact_hits, cwe1, cve1, att1 = self._path_id_exact(
            extracted_ids, seen_ids, graph_depth, top_k,
            source_filter=source_filter,
        )

        # 경로 2: 벡터 시맨틱 검색 + 그래프 관계 보강
        vector_hits, cwe2, cve2, att2 = self._path_vector_semantic(
            query, seen_ids, top_k, min_score,
            source_filter=source_filter,
        )

        # RRF로 3개 리스트 융합 (id_exact, graph_neighbor, vector_semantic)
        id_exact_list = [h for h in exact_hits if h["match_type"] == "id_exact"]
        neighbor_list = [h for h in exact_hits if h["match_type"] == "graph_neighbor"]
        all_hits = self._apply_rrf(
            [id_exact_list, neighbor_list, vector_hits], k=self._rrf_k,
        )

        return {
            "query": query,
            "hits": all_hits,
            "total": len(all_hits),
            "extracted_ids": extracted_ids,
            "related_cwe": sorted(cwe1 | cwe2),
            "related_cve": sorted(cve1 | cve2),
            "related_attack": sorted(att1 | att2),
            "match_type_counts": {
                "id_exact": sum(1 for h in all_hits if h["match_type"] == "id_exact"),
                "graph_neighbor": sum(1 for h in all_hits if h["match_type"] == "graph_neighbor"),
                "vector_semantic": sum(1 for h in all_hits if h["match_type"] == "vector_semantic"),
            },
        }
```

---

### C.6 CAPEC 브릿지 + 통합 스키마 — `schema.py`

```python
class CapecBridge(BaseModel):
    """CAPEC -> CWE / ATT&CK 양방향 룩업 테이블.

    CWE와 ATT&CK 사이 직접 매핑이 없으므로 이 브릿지가
    현재 채택한 공식 연결 경로이다.
    """
    capec_to_cwe:    dict[str, list[str]]  # CAPEC-100 → [CWE-119, CWE-120]
    capec_to_attack: dict[str, list[str]]  # CAPEC-100 → [T0831]
    attack_to_capec: dict[str, list[str]]  # T0831 → [CAPEC-100, CAPEC-123]
    cwe_to_capec:    dict[str, list[str]]  # CWE-119 → [CAPEC-100]


class UnifiedThreatRecord(BaseModel):
    """전체 구현 스키마 (본문 5.2절의 요약 스키마와 대조 참고)

    본문에서는 단순화를 위해 4-Layer 구조를 평면 필드로 설명한다.
    Layer 1: AttackSurface — 공격 표면 (키워드 매칭)
    Layer 2: ThreatVector  — 위협 벡터 (카테고리, 공격 벡터, kill chain)
    Layer 3: Vulnerability — 취약점 (제목, 설명, 심각도)
    Layer 4: Mitigation    — 완화 방안
    """
    id: str                          # "CWE-787", "T0831", "CAPEC-100"
    source: str                      # "CWE" | "ATT&CK" | "CAPEC" (기본 ETL)
                                     # | "CVE" (런타임 enrichment)
    attack_surfaces: list[str]       # 해당 공격 표면 태그
    threat_category: str = ""        # "Memory Corruption", "Injection", ...
    attack_vector: str | None = None # ATT&CK tactic 또는 CVSS attackVector (소스에 따라 상이)
    kill_chain_phase: str | None     # ATT&CK 전용

    title: str = ""
    description: str = ""            # 임베딩 대상
    severity: float | None = None    # 선택적 심각도. CWE/ATT&CK/CAPEC에서는 대부분 None
    mitigations: list[str]           # 완화 방안

    related_cwe: list[str]           # 교차 참조 (crossref 엔진이 채움)
    related_cve: list[str]           # [런타임 enrichment] 기본 ETL에서는 비어 있음
    related_attack: list[str]
    related_capec: list[str]

    automotive_relevance: float = 0.0  # 도메인 관련성 (0.0~1.0, 5.2절 참조)
```
