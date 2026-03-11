# S4. LLM Engine 기능 명세

> 2차년도에는 실 구현하지 않음. S3(LLM Gateway)가 내부 Mock으로 대체.
> 이 문서는 3차년도 이후 실 연동 시 참고할 인터페이스 명세.

---

## 역할

- LLM 추론 수행 (코드 분석, 취약점 탐지, 수정 가이드 생성)
- OpenAI-compatible API 형식으로 요청 수신

---

## API 인터페이스

### 추론 요청

```
POST /v1/chat/completions
```

요청:
```json
{
  "model": "모델명",
  "messages": [
    { "role": "system", "content": "시스템 프롬프트" },
    { "role": "user", "content": "분석 요청 프롬프트" }
  ],
  "max_tokens": 2048,
  "temperature": 0.7
}
```

응답:
```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "LLM 생성 텍스트 (JSON 형식)"
      }
    }
  ]
}
```

### 모델 목록

```
GET /v1/models
```

### 헬스체크

```
GET /health
```

---

## 2차년도 운영 방식

```
S2 → S3 → [S3 내부 MockLLM] → S3 → S2
           S4는 호출하지 않음
```

S3의 MockLLM이 S4의 응답 형식을 그대로 모사한다.
실 연동 시 S3의 LlmClient만 Mock → Real로 전환하면 된다.

---

## 3차년도 이후 연동 계획

- 하드웨어: DGX Spark (온프레미스 GPU 서버)
- 모델: 미정 (Qwen 14B 등 검토 중)
- 서빙: vLLM 또는 동급 추론 서버
- S3 설정 파일에서 엔드포인트/모델명만 변경하면 연동 완료

---

## 관련 문서

- [전체 개요](technical-overview.md)
- [S3. LLM Gateway](llm-gateway.md)
