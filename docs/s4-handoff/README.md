# S4. LLM Engine 개발자 인수인계서

> 이 문서는 S4(LLM Engine) 셋업 및 운영을 이어받는 다음 세션을 위한 인수인계서다.
> DGX Spark에 Qwen 32B를 서빙하여 S3(LLM Gateway)에 추론 API를 제공하는 것이 목표다.

---

## 1. 프로젝트 전체 그림

### 과제

"가상환경 기반 자동차 전장부품 사이버보안 수준 검증 기술 및 플랫폼 개발" — 생성형 AI 기반 지능형 사이버보안 공격/검증 프레임워크.

### 4-서비스 MSA 구조

```
[Electron + React + TS]  <-->  [Express.js + TS]  <-->  [Python FastAPI]  <-->  [vLLM + Qwen 32B]
     Frontend (S1)              Backend (S2)             LLM Gateway (S3)        LLM Engine (S4)
     :5173 (dev)                :3000                    :8000                    :8080
```

통신 방향: `S1 → S2 → S3 → S4` (단방향 의존)

### S4의 정체성

> S4는 모델을 로드하고 추론을 수행하는 서빙 계층이다.
> 프롬프트 구성, 출력 검증, 비즈니스 로직은 S3/S2의 영역이다.
> S4는 **빠르고 안정적인 추론을 제공하는 데 집중**한다.

---

## 2. 너의 역할과 경계

### 너는

- S4 LLM Engine 운영자/개발자
- DGX Spark 하드웨어 + vLLM 서빙을 관리
- 모델 선정/교체/최적화 담당

### 너는 하지 않는다

- 프롬프트 작성 → S3 담당 (`services/llm-gateway/app/v1/registry/prompt_registry.py`)
- LLM 응답 파싱/검증 → S3 담당 (`services/llm-gateway/app/v1/pipeline/`)
- 분석 결과 최종 판정 → S2 담당
- UI → S1 담당

### 작업 요청 주고받기

- **경로**: `docs/work-requests/`
- **파일명**: `{보내는쪽}-to-{받는쪽}-{주제}.md`
- S3에게 요청할 일이 있으면 이 폴더에 문서를 작성한다
- **작업 완료 후 해당 요청 문서를 반드시 삭제한다**

---

## 3. 해야 할 일 (Setup Checklist)

### Phase 1: 기본 서빙

- [ ] DGX Spark 물리 연결 (전원, 네트워크)
- [ ] OS/드라이버 확인 (NVIDIA 드라이버, CUDA)
- [ ] Python 환경 구성 (Python 3.10+)
- [ ] vLLM 설치 (`pip install vllm`)
- [ ] Qwen 모델 다운로드 (`Qwen/Qwen2.5-32B-Instruct`)
- [ ] vLLM 서빙 기동 및 동작 확인
- [ ] S3 연동 테스트 (`SMARTCAR_LLM_MODE=real`)

### Phase 2: 안정화

- [ ] 서비스 자동 시작 설정 (systemd 등)
- [ ] 모니터링 (GPU 사용률, 메모리, 요청 처리량)
- [ ] 로그 관리
- [ ] 모델 가중치 무결성 검증 (SHA256)

### Phase 3: 최적화 (향후)

- [ ] Prefix caching 활성화 (반복 시스템 프롬프트)
- [ ] INT8/AWQ 양자화 검토 (속도 vs 품질 트레이드오프)
- [ ] Tool calling 테스트 (Agentic SAST 대비)
- [ ] Structured output (`response_format: json_object`) 테스트

---

## 4. 기동 방법

### vLLM 서빙

```bash
python -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen2.5-32B-Instruct \
    --host 0.0.0.0 \
    --port 8080 \
    --max-model-len 8192 \
    --dtype float16 \
    --gpu-memory-utilization 0.85
```

### 동작 확인

```bash
# 1. 헬스체크
curl http://localhost:8080/health
# 기대: {"status": "ok"}

# 2. 모델 목록
curl http://localhost:8080/v1/models
# 기대: data 배열에 모델 ID 포함

# 3. 추론 테스트
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen2.5-32B-Instruct",
    "messages": [
      {"role": "system", "content": "당신은 보안 전문가입니다."},
      {"role": "user", "content": "gets() 함수의 위험성을 한 문장으로 설명하세요."}
    ],
    "max_tokens": 128,
    "temperature": 0.3
  }'
# 기대: choices[0].message.content에 응답 텍스트
```

---

## 5. S3와의 연동

### S3가 S4를 호출하는 방식

S3의 `RealLlmClient`(`services/llm-gateway/app/services/clients/real.py`)가 httpx로 호출:

```
POST {endpoint}/v1/chat/completions
Headers: Content-Type: application/json, Authorization: Bearer {api_key} (선택)
Body: { model, messages, max_tokens, temperature }
```

S3는 응답에서 `choices[0].message.content`만 추출한다.

### S3 환경변수 변경

S4가 준비되면 S3 측에서 아래 환경변수를 변경한다:

```env
SMARTCAR_LLM_MODE=real                           # mock → real
SMARTCAR_LLM_ENDPOINT=http://<DGX_SPARK_IP>:8080  # S4 주소
SMARTCAR_LLM_MODEL=Qwen/Qwen2.5-32B-Instruct     # 모델 식별자
SMARTCAR_LLM_API_KEY=                             # vLLM 기본: 불필요
```

### 연동 확인 절차

1. S4(vLLM) 기동 확인 (`/health`, `/v1/models`)
2. S3 환경변수 설정 후 S3 기동
3. v0 테스트: `POST /api/llm/analyze` (기존 v0 엔드포인트)
4. v1 테스트: `POST /v1/tasks` (taskType: static-explain)
5. 로그 확인: `logs/s3-llm-gateway.jsonl`에 latency, tokenUsage 기록 확인

---

## 6. S3가 기대하는 출력 형식

S3는 S4의 응답(`choices[0].message.content`)이 **JSON 문자열**이기를 기대한다.

### v1 Assessment 형식 (S3가 프롬프트로 지시)

```json
{
  "summary": "분석 요약",
  "claims": [
    {
      "statement": "증거 기반 주장",
      "supportingEvidenceRefs": ["eref-001"]
    }
  ],
  "caveats": ["한계, 불확실성"],
  "usedEvidenceRefs": ["eref-001"],
  "suggestedSeverity": "critical",
  "needsHumanReview": true,
  "recommendedNextSteps": ["후속 조치"]
}
```

**중요**: S4는 이 형식을 **강제하지 않는다**. S3가 프롬프트로 지시하고, 응답을 파싱/검증한다. S4는 그냥 모델 출력을 있는 그대로 반환하면 된다.

파싱 실패 시 S3가 자체적으로 `validation_failed` 응답을 생성한다.

---

## 7. 하드웨어 사양 (DGX Spark)

| 항목 | 사양 |
|------|------|
| GPU | NVIDIA Blackwell |
| 메모리 | 128GB LPDDR5x unified |
| 대역폭 | 273 GB/s |
| 네트워크 | ConnectX-7 (100GbE) |
| PCIe | Gen5 |

### 모델 메모리 분석

| 항목 | 크기 |
|------|------|
| Qwen 32B FP16 가중치 | ~64GB |
| KV cache 여유 | ~60GB+ |
| 결론 | 128GB unified에 충분, 양자화 불필요 |

---

## 8. 성능 목표

| 항목 | 목표값 | 참고 |
|------|--------|------|
| 처리량 | 8~15 tok/s | 외부 피드백 기반 |
| 첫 토큰 지연 | < 3초 | UX 허용 범위 |
| S3 타임아웃 | 60초 | S3 httpx 설정 |
| 최대 컨텍스트 | 8,192 토큰 | vLLM `--max-model-len` |

### 성능 측정 방법

```bash
# 토큰 처리량 확인 (usage 필드)
curl -s -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen2.5-32B-Instruct",
    "messages": [{"role":"user","content":"Hello"}],
    "max_tokens": 100
  }' | python3 -c "
import sys, json, time
start = time.time()
data = json.load(sys.stdin)
elapsed = time.time() - start
usage = data.get('usage', {})
comp = usage.get('completion_tokens', 0)
print(f'Completion tokens: {comp}')
print(f'Elapsed: {elapsed:.2f}s')
print(f'Throughput: {comp/elapsed:.1f} tok/s' if elapsed > 0 else '')
"
```

---

## 9. 트러블슈팅

### S3에서 `LLM_UNAVAILABLE` 오류

- S4가 기동되지 않았거나 포트가 다름
- `curl http://localhost:8080/health`로 확인
- 방화벽/네트워크 확인 (WSL2↔DGX Spark)

### S3에서 `LLM_TIMEOUT` 오류

- 모델 로딩 중 (첫 요청 시 느릴 수 있음)
- `max_tokens`가 너무 크거나 입력이 너무 긴 경우
- `--gpu-memory-utilization` 조정 검토

### S3에서 `LLM_PARSE_ERROR`

- 모델이 JSON이 아닌 자연어를 반환한 경우
- S3의 프롬프트 문제일 가능성 높음 → S3 담당자에게 전달
- temperature를 낮추면 (0.1~0.3) JSON 준수율 향상

### vLLM OOM (Out of Memory)

- `--gpu-memory-utilization` 값 낮추기 (0.85 → 0.80)
- `--max-model-len` 줄이기 (8192 → 4096)
- INT8 양자화 적용 검토

---

## 10. 향후 로드맵

### 당장 (Phase 1)

기본 서빙만 하면 된다. 모델 로드 → 추론 API → S3 연동. 그 이상은 불필요.

### 다음 (Phase 2~3)

| 항목 | 시기 | 설명 |
|------|------|------|
| Tool calling | v1.5 | Agentic SAST 지원 (S3가 tool 정의 조립, S4가 tool_call 생성) |
| Structured output | v2 | `response_format: json_object`로 JSON 출력 강제 |
| 모델 교체 | 수시 | Qwen 72B, 다른 모델 평가 시 S3의 model profile만 변경 |
| 다중 모델 | v3 | 용도별 모델 분리 (경량: 분류, 중량: 심층 분석) |

---

## 11. 관리하는 문서

| 문서 | 경로 | 용도 |
|------|------|------|
| 기능 명세서 | `docs/specs/llm-engine.md` | S4 아키텍처, 하드웨어, 서빙 설정 |
| API 계약서 | `docs/api/llm-engine-api.md` | S3↔S4 인터페이스 명세 |
| 이 인수인계서 | `docs/s4-handoff/README.md` | 다음 세션용 |

---

## 12. 참고할 문서들

| 문서 | 경로 | 왜 봐야 하는지 |
|------|------|--------------|
| 전체 기술 개요 | `docs/specs/technical-overview.md` | 프로젝트 전체 구조 이해 |
| S3 기능 명세 | `docs/specs/llm-gateway.md` | S3가 S4를 어떻게 쓰는지 이해 (필독) |
| S3 API 명세 | `docs/api/llm-gateway-api.md` | S3가 S4 응답을 어떻게 가공하는지 |
| S3 인수인계서 | `docs/s3-handoff/README.md` | S3 현재 상태 및 v1 파이프라인 |
| 외부 피드백 (Agentic) | `docs/외부피드백/S3_agentic_sast_design_feedback.md` | vLLM 선정 근거, 성능 가이드 |
| vLLM 공식 문서 | https://docs.vllm.ai/ | 서빙 옵션, tool calling |
| Qwen vLLM 배포 가이드 | https://qwen.readthedocs.io/en/latest/deployment/vllm.html | 모델별 배포 설정 |
