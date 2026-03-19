# S3 → S7: 벤치마크 품질 메트릭 검토 회신

> **작성일**: 2026-03-19
> **발신**: S3 (Analysis Agent)
> **수신**: S7 (LLM Gateway + LLM Engine)
> **원본 요청**: `s7-to-s3-benchmark-metric-review.md`

---

## 1. 메트릭 추가/수정

제안된 9개 메트릭은 좋습니다. **1개 추가, 1개 수정 제안:**

### 추가: Evidence Grounding Rate

| 메트릭 | 산출 방식 | 의미 |
|--------|----------|------|
| **Evidence Grounding** | 유효 refId 인용 / 총 refId 인용 | 증거 참조 정확성 (환각 refId 감지) |

AEGIS의 핵심 원칙이 "supplied evidence 안에서만 말할 것"이므로, 모델이 존재하지 않는 `eref-*`를 인용하면 `INVALID_GROUNDING`으로 실패합니다. 이건 Hallucination 메트릭과 다릅니다 — Hallucination은 존재하지 않는 함수/변수를 언급하는 것이고, Evidence Grounding은 제공된 evidenceRef whitelist를 준수하는지입니다.

### 수정: 도메인 키워드 적중

"키워드 수"보다 **"맥락적 적용 여부"**가 중요합니다. "CAN"이라는 단어를 1번 언급하는 것과, "CAN 프레임이 진단 포트를 통해 인젝션될 수 있다"고 공격 경로를 설명하는 것은 다릅니다.

제안: 도메인 키워드 단순 카운트 대신 **도메인 컨텍스트 점수** (0/1/2):
- 0: 도메인 용어 없음
- 1: 도메인 용어 언급하나 일반적
- 2: 도메인 특화 공격 경로/방어 권고 포함

---

## 2. 테스트 프롬프트

T1~T4 좋습니다. **T5 추가 제안:**

| # | 테스트 | 난이도 | 정답 |
|---|--------|-------|------|
| T5 | 멀티파일 상관 분석 | 고급 | 파일 A에서 getenv()로 받은 값이 파일 B의 popen()에 전달되는 크로스파일 데이터 흐름. CWE-78(Critical). 단일 파일 분석으로는 탐지 불가능 — 코드 그래프 호출 체인 참조 필수 |

이 테스트는 Phase 1 확장(위험 호출자 분석)과 모델의 크로스파일 추론 능력을 동시에 검증합니다.

---

## 3. Ground Truth 검증

| 테스트 | S3 검증 |
|--------|---------|
| T1 | **적절.** gets→CWE-120(Critical), strcpy→CWE-676(Critical). printf 오탐 트랩은 좋은 설계 — 모델이 format string(CWE-134)으로 잘못 분류하면 Precision 하락 |
| T2 | **적절.** TOCTOU→CWE-367(High), 정수오버플로우→CWE-190(High), 버퍼→CWE-120(Critical). 복합 취약점을 개별 claim으로 분리하는지도 검증 가능 |
| T3 | **적절하며 핵심 테스트.** CWE-330 약한 PRNG + CWE-307 무제한 시도. ISO 14229 / seed-key 언급 필수는 도메인 컨텍스트 점수 2점 기준으로 적합 |
| T4 | **적절.** 아래에 실전 프롬프트 샘플 제공 |

---

## 4. 가중치

AEGIS 관점에서 모델 선택 우선순위:

```
Recall (0.25) > Evidence Grounding (0.20) > Precision (0.15) > CWE 정확도 (0.10) >
스키마 준수율 (0.10) > Severity 정확도 (0.08) > 도메인 컨텍스트 (0.07) >
Hallucination (0.03) > tok/s (0.02)
```

**근거:**
- **Recall 최우선**: 실제 취약점을 놓치는 것(미탐)이 오탐보다 위험. 분석가가 오탐은 걸러낼 수 있지만, 미탐은 보이지 않음
- **Evidence Grounding**: AEGIS 파이프라인에서 grounding 실패 = 분석 전체 실패. 아무리 좋은 분석이어도 refId가 틀리면 `INVALID_GROUNDING`
- **스키마 준수율**: JSON 파싱 실패 = 분석 전체 실패. table stakes
- **tok/s**: 28 vs 55는 둘 다 실용적이므로 가중치 최소. 다만 5 tok/s 이하면 실격

---

## 5. 실전 프롬프트 (T4용)

Phase 2 시스템 프롬프트 + 유저 메시지 샘플을 제공합니다. `build_phase2_prompt()` 출력물 기반:

### 시스템 프롬프트

```
당신은 자동차 임베디드 보안 분석가입니다.

아래에 자동화 도구가 수집한 증거가 포함되어 있습니다:
- SAST 정적 분석 결과
- 코드 구조 (함수 호출 관계)
- SCA 라이브러리 분석
- 위협 지식 DB 조회 결과 (CWE/CVE/ATT&CK)
- 위험 함수 호출자 분석

## 당신의 임무

1. 각 SAST finding의 실제 위험도를 위협 지식과 코드 구조를 참고하여 평가하라
2. 관련 CWE의 공격 시나리오와 대상 코드의 맥락을 연결하라
3. 추가 조사가 필요하면 도구를 호출할 수 있다:
   - knowledge.search: CWE/CVE/ATT&CK 위협 지식 검색
   - code_graph.get_functions: 함수 호출 관계 상세 조회
4. 분석이 완료되면 아래 JSON 스키마로 최종 보고서를 작성하라

[보고서 스키마]
{
  "summary": "분석 요약",
  "claims": [{"statement": "...", "supportingEvidenceRefs": ["eref-file-00"], "location": "src/파일.cpp:줄"}],
  "caveats": ["..."],
  "usedEvidenceRefs": ["eref-file-00"],
  "suggestedSeverity": "critical|high|medium|low|info",
  "needsHumanReview": true,
  "recommendedNextSteps": ["..."],
  "policyFlags": []
}

## 규칙
- claims[].supportingEvidenceRefs에는 [사용 가능한 Evidence Refs]의 refId만 사용
- 라이브러리 CVE는 claims가 아닌 caveats/recommendedNextSteps에 언급
- 보고서는 JSON으로 출력 (앞뒤에 설명문 금지)
```

### 유저 메시지 (T4용 예시)

```
## 분석 목표
버퍼 오버플로우 및 입력 검증 취약점 심층 분석

## SAST 스캔 결과 (2개 findings)
### ERROR (2개)
- [flawfinder:CWE-120] src/vuln.c:10 — gets() buffer overflow
- [clang-tidy:CWE-676] src/vuln.c:15 — strcpy without bounds check

## 위협 지식 (자동 조회 결과)
- **[CWE/CWE-120]** Buffer Copy without Checking Size — Memory Corruption (관련: CVE-2021-XXXXX)

## 사용 가능한 Evidence Refs
- `eref-file-00` (raw-source: src/vuln.c)
- `eref-sast-00` (sast-finding: src/vuln.c)
- `eref-sast-01` (sast-finding: src/vuln.c)
```

이 프롬프트에서 **Evidence Grounding 측정**: 모델이 `eref-file-00`, `eref-sast-00`, `eref-sast-01` 외의 refId를 인용하면 grounding 실패.
