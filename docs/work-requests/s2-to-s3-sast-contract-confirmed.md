# S2 → S3: SAST 통합 API 계약 확정

> 작성: S2 (2026-03-17)
> 대상: S3 (LLM Gateway)
> 원본 요청: `s3-to-s2-sast-integration.md`

---

## S2 설계 결정

S3의 SAST 도구 통합 요청을 검토했습니다. 아래 사항을 확정하여 `shared-models.md`와 코드에 반영했습니다.

### 1. SastFinding 타입 확정

`models.ts`에 `SastFinding`, `SastFindingLocation`, `SastDataFlowStep` 타입을 추가했습니다.

```typescript
interface SastFinding {
  toolId: string;           // "semgrep" | "codeql" | ...
  ruleId: string;           // e.g. "semgrep:c.lang.security.insecure-use-gets-fn"
  severity: string;         // 도구의 심각도
  message: string;
  location: {
    file: string;
    line: number;
    column?: number;
    endLine?: number;
    endColumn?: number;
  };
  dataFlow?: Array<{        // taint tracking (선택)
    file: string;
    line: number;
    content?: string;
  }>;
  metadata?: Record<string, unknown>;
}
```

### 2. API 계약 확장

S2는 SAST findings를 `context.trusted.sastFindings`에 배열로 전달합니다:

```jsonc
{
  "taskType": "static-explain",
  "context": {
    "trusted": {
      "finding": { ... },         // 기존 ruleResult (유지)
      "sastFindings": [           // 신규
        {
          "toolId": "semgrep",
          "ruleId": "semgrep:c.lang.security.insecure-use-gets-fn",
          "severity": "error",
          "message": "Use of gets() is insecure...",
          "location": { "file": "main.c", "line": 42 }
        }
      ]
    },
    "untrusted": {
      "sourceSnippet": "..."      // 기존 (유지)
    }
  },
  "evidenceRefs": [
    // 기존 refs + 신규 SAST refs:
    {
      "refId": "...",
      "artifactType": "sast-finding",
      "locatorType": "lineRange",
      "locator": { "toolId": "semgrep", "ruleId": "...", "file": "main.c", "line": 42 }
    }
  ]
}
```

### 3. Evidence 결정

- SAST findings는 **`trusted` 컨텍스트 + `evidenceRefs` 모두**에 포함합니다
- `evidenceRefs`에 `artifactType: "sast-finding"`, `locatorType: "lineRange"`로 등록
- S3 Evidence Validator가 refId를 검증할 수 있음
- `ArtifactType`에 `"sast-finding"` 추가 완료 (`shared-models.md`, `models.ts`)

### 4. 도구 선정 방향

S2는 **Semgrep**을 1차 도구로 선정할 예정입니다:
- OSS, 컴파일 불필요, C/C++ 지원
- SARIF 출력 → 구조화된 파싱 용이
- 자동차 보안 관련 커뮤니티 룰 활용 가능

구현은 후속 마일스톤에서 진행합니다 (인프라 구축 필요).

---

## S3 후속 작업

1. **`llm-gateway-api.md` 계약서에 `context.trusted.sastFindings` 필드 추가** — S3 소유 문서이므로 S3가 직접 반영
2. **프롬프트 재설계**: "취약점을 찾아라" → "이 SAST finding이 실제 위협인지 검증하라"
3. **Confidence 조정**: SAST finding과 LLM 판단 일치 시 `deterministicSupport` 반영
4. **Evidence Validator**: `artifactType: "sast-finding"` 허용 추가

---

## 변경 파일

| 파일 | 변경 |
|------|------|
| `services/shared/src/models.ts` | `SastFinding`, `SastFindingLocation`, `SastDataFlowStep` 추가, `ArtifactType`에 `"sast-finding"` 추가 |
| `docs/api/shared-models.md` | SastFinding 타입 + ArtifactType 확장 문서화 |
| `services/backend/src/services/llm-v1-adapter.ts` | `LlmAnalyzeRequest.sastFindings` 필드 추가, `buildContext`에서 `trusted.sastFindings` 전달, `buildEvidenceRefs`에서 SAST refs 생성 |
