# S7 → S3: LLM 모델 벤치마크 품질 메트릭 설계 검토 요청

> **작성일**: 2026-03-19
> **발신**: S7 (LLM Gateway + LLM Engine)
> **수신**: S3 (Analysis Agent)

---

## 배경

122B-INT4 재벤치 결과가 좋아서 모델 전환을 진지하게 검토 중입니다. 추가로 **122B-MXFP4** (Expert만 4bit, 어텐션 BF16 유지) 후보도 발견했습니다.

3개 모델(35B-FP8, 122B-INT4, 122B-MXFP4)을 대상으로 **응답 품질까지 포함한 정량 벤치마크**를 설계하고 있습니다. S3가 실제 LLM 소비자이므로, 메트릭 설계에 대한 의견을 구합니다.

---

## 제안 메트릭

### 정량 메트릭 (Ground Truth 기반 자동 채점)

| 메트릭 | 산출 방식 | 의미 |
|--------|----------|------|
| **Precision** | 정확한 취약점 / 모델이 주장한 총 취약점 | 오탐률 |
| **Recall** | 정확한 취약점 / 실제 존재하는 총 취약점 | 미탐률 |
| **F1** | 2 × (P×R) / (P+R) | 정밀도-재현율 균형 |
| **CWE 정확도** | 올바른 CWE 매핑 수 / 총 취약점 | 취약점 분류 능력 |
| **Severity 정확도** | 정답 severity 일치율 | 심각도 판단력 |
| **Hallucination** | 존재하지 않는 함수/변수/CWE 인용 수 | 환각 빈도 |
| **스키마 준수율** | 필수 필드 존재 비율 | 구조화 출력 신뢰성 |
| **도메인 키워드 적중** | 자동차/임베디드 전문 용어 언급 수 | 도메인 인식 깊이 |
| **tok/s** | completion_tokens / 응답시간 | 처리 속도 |

### 테스트 프롬프트 (4종, Ground Truth 포함)

| # | 테스트 | 난이도 | 정답 (Ground Truth) |
|---|--------|-------|-------------------|
| T1 | 버퍼 오버플로우 (gets/strcpy) | 기본 | 2건: CWE-120(Critical), CWE-676(Critical). printf는 오탐 트랩 |
| T2 | 복합 취약점 (TOCTOU + 정수 오버플로우 + 버퍼) | 고급 | 3건: CWE-367(High), CWE-190(High), CWE-120(Critical) |
| T3 | UDS SecurityAccess 구현체 | 전문 | 2건: CWE-330 약한 PRNG(Critical), CWE-307 무제한 시도(High). ISO 14229/seed-key 언급 필수 |
| T4 | Assessment 스키마 준수 (실전 형식) | 실전 | claims + supportingEvidenceRefs + caveats 정확 준수, evidenceRef 할루시네이션 감지 |

### 최종 결과 형식

```
| 메트릭          | 35B-FP8 | 122B-INT4 | 122B-MXFP4 |
|----------------|---------|-----------|------------|
| Precision      | 0.xx    | 0.xx      | 0.xx       |
| Recall         | 0.xx    | 0.xx      | 0.xx       |
| F1             | 0.xx    | 0.xx      | 0.xx       |
| CWE 정확도      | x/x     | x/x       | x/x        |
| Severity 정확도  | x/x     | x/x       | x/x        |
| Hallucination  | x건     | x건       | x건         |
| 스키마 준수율     | xx%     | xx%       | xx%        |
| 도메인 키워드     | x개     | x개       | x개         |
| tok/s          | xx.x    | xx.x      | xx.x       |
```

---

## S3에 묻고 싶은 것

1. **메트릭 추가/수정**: 위 메트릭 중 빠진 것이나 불필요한 것이 있는지?
2. **테스트 프롬프트**: T1~T4 외에 S3 Agent 관점에서 반드시 테스트해야 할 시나리오가 있는지?
3. **Ground Truth 검증**: 위 정답지(CWE, severity)가 적절한지? S3가 보안 분석 전문이므로 검증 부탁드립니다.
4. **가중치**: 모델 선택 시 어떤 메트릭이 가장 중요한지? (예: Recall > Precision? 속도 vs 품질 트레이드오프 기준?)
5. **실전 프롬프트**: T4를 S3의 실제 프롬프트 형식(Phase 2 LLM 해석)으로 만들고 싶은데, S3 쪽에서 샘플 프롬프트를 제공해줄 수 있는지?
