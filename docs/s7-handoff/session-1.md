# Session 1 — S7 신설 (2026-03-19)

S3(Analysis Agent + LLM Gateway)에서 LLM Gateway + LLM Engine 관리를 S7으로 분리.

## 변경 사항

- **배경**: S3의 관심사가 "보안 분석 에이전트"와 "LLM 서빙 인프라"로 이질적 -> 단일 책임 원칙에 따라 분리
- **S7 소유**: `services/llm-gateway/` 코드, LLM Engine(DGX Spark) 운영, 관련 문서 5건
- **`/v1/chat` 프록시 구현 완료**: S3 Agent가 Gateway 경유 LLM 호출. 세마포어 동시성 제어, 교환 로그, ConnectError->503, Timeout->504 매핑. 테스트 4건 추가 (154 passed)
- **S2 승인**: `docs/AEGIS.md` 7인 체제 반영 완료

## 이전 이력 (S3 시절, Gateway 관련)

### 코드 리팩토링: v0 제거 + 구조 플래트닝 (2026-03-13)
- `app/v1/` -> `app/` 플래트닝, 모든 import 변경

### 위협 지식 DB(RAG) 통합 (2026-03-14)
- ETL 파이프라인 이식 (CWE 944건 + CVE 702건 + ATT&CK ICS 83건)
- `app/rag/` 패키지, `AuditInfo.ragHits`

### vLLM + Qwen3.5 전환 (2026-03-14)
- ollama -> vLLM 전환, LLM 모드 2종 체계 (mock/real)
- 처리량 +155% (10.2->26 tok/s)

### LLM 출력 재시도 + Confidence RAG 분화 + RAG min_score 필터 (2026-03-16)
- 재시도 로직 (INVALID_SCHEMA, INVALID_GROUNDING, EMPTY_RESPONSE)
- `consistency` -> `ragCoverage` 교체
- `AEGIS_RAG_MIN_SCORE=0.35`

### vLLM 동시성 전환 + RAG 쿼리 보강 (2026-03-16)
- `Semaphore(1)` -> `Semaphore(N)`, httpx connection pooling
- Backpressure 처리 (429/503 -> `LLM_OVERLOADED`)

### 프롬프트 품질 점검 (2026-03-16)

### Claim location 필드 + S4 교환 로그 (2026-03-17)
- `claims[].location` 필드 추가
- `logs/llm-exchange.jsonl` 전문 로그

### 문서-코드 정합 (2026-03-17)
- `LLM_OVERLOADED` failureCode 승격
- `Semaphore(N)` 명세 반영

### API 계약-테스트 매핑 체계 구축 (2026-03-17)
- HTTP 레벨 계약 테스트 55개 신규 추가 (총 147개)

### static-explain BuildProfile 컨텍스트 추가 (2026-03-17)
- `V1PromptBuilder`에 `_format_build_profile()` 추가

### AEGIS 리네이밍 + RAG->S5 API 전환 (2026-03-18)
- 환경변수 prefix: `SMARTCAR_` -> `AEGIS_`
- RAG Qdrant 직접 접근 -> S5 REST API(`POST /v1/search`) 전환
- Gateway 150 tests 통과
