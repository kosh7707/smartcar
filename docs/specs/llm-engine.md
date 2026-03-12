# S4. LLM Engine 기능 명세

> S4는 LLM 추론을 수행하는 모델 서빙 계층이다.
> S3(LLM Gateway)가 유일한 호출자이며, OpenAI-compatible API를 제공한다.

---

## 1. 역할

### 책임

- Qwen 32B 모델 로딩 및 추론 수행
- OpenAI-compatible REST API 제공 (`/v1/chat/completions`)
- 모델 목록 및 헬스체크 엔드포인트 제공
- GPU 메모리 관리 및 추론 최적화
- (향후) Tool calling / Structured output 지원

### 비책임

- 프롬프트 구성 및 템플릿 관리 → S3
- 출력 검증 및 파싱 → S3
- 입력 신뢰도 관리 → S3
- 비즈니스 로직 → S2
- 사용자 인터페이스 → S1

---

## 2. 하드웨어

### DGX Spark

| 항목 | 사양 |
|------|------|
| GPU | NVIDIA Blackwell (GR00T-ready) |
| 메모리 | 128GB LPDDR5x (unified, GPU/CPU 공유) |
| 대역폭 | 273 GB/s |
| 연결 | ConnectX-7 (100GbE), PCIe Gen5 |
| 폼팩터 | 데스크탑 사이즈 |

### 모델 적합성

- Qwen 32B FP16: ~64GB VRAM → 128GB unified 메모리에 충분
- KV cache 여유: ~60GB+ → 긴 컨텍스트 처리 가능
- INT8 양자화 시 ~32GB → 여유 더 확보

---

## 3. 추론 서버: vLLM (권장)

### 선정 근거

| 기준 | 근거 |
|------|------|
| Qwen 공식 호환 | Qwen 문서가 vLLM 기반 배포 예시를 직접 제공 |
| Tool calling | `tool_choice='required'`, structured outputs 지원 |
| OpenAI 호환 | `/v1/chat/completions` 네이티브 제공 |
| 성능 | PagedAttention, Continuous Batching, KV cache 효율 |

### 기본 기동 명령

```bash
python -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen2.5-32B-Instruct \
    --host 0.0.0.0 \
    --port 8080 \
    --max-model-len 8192 \
    --dtype float16 \
    --gpu-memory-utilization 0.85
```

### 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `VLLM_MODEL` | `Qwen/Qwen2.5-32B-Instruct` | HuggingFace 모델 경로 또는 로컬 경로 |
| `VLLM_PORT` | `8080` | 서빙 포트 |
| `VLLM_MAX_MODEL_LEN` | `8192` | 최대 컨텍스트 길이 |
| `VLLM_GPU_MEM_UTIL` | `0.85` | GPU 메모리 사용률 |
| `VLLM_DTYPE` | `float16` | 모델 정밀도 (`float16`, `bfloat16`, `auto`) |

### 대안 (참고)

- **TGI** (Text Generation Inference): HuggingFace 공식, Qwen 지원하나 tool calling 문서가 적음
- **NIM** (NVIDIA Inference Microservice): NVIDIA 공식이나 Qwen 생태계 연동 마찰 있음

---

## 4. API 인터페이스

상세 스키마는 [API 명세서](../api/llm-engine-api.md)를 참조. 여기서는 설계 원칙만 기술한다.

### 엔드포인트

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | `/v1/chat/completions` | 추론 요청 |
| GET | `/v1/models` | 사용 가능한 모델 목록 |
| GET | `/health` | 헬스체크 |

### 응답 형식

OpenAI-compatible JSON. vLLM이 기본 제공하므로 별도 구현 불필요.

---

## 5. S3↔S4 연동

### 통신 구조

```
S3 (LLM Gateway, :8000)
  │
  │  POST /v1/chat/completions
  │  (httpx, timeout 60s)
  │
  ▼
S4 (LLM Engine, :8080)
  │
  │  vLLM inference
  │
  ▼
GPU (Qwen 32B)
```

### S3 연결 설정

S3의 환경변수로 S4를 가리킨다:

```env
SMARTCAR_LLM_MODE=real
SMARTCAR_LLM_ENDPOINT=http://localhost:8080
SMARTCAR_LLM_MODEL=Qwen/Qwen2.5-32B-Instruct
SMARTCAR_LLM_API_KEY=        # vLLM 기본: 불필요
```

### 연동 확인 절차

1. S4(vLLM) 기동
2. `curl http://localhost:8080/v1/models` → 모델 목록 확인
3. S3 환경변수 설정 (`SMARTCAR_LLM_MODE=real`)
4. S3 기동
5. S3 `/v1/health` → `modelProfiles` 확인
6. S3 `/v1/tasks` 테스트 요청 → 실 LLM 응답 확인

---

## 6. 성능 가이드라인

### 목표

| 항목 | 목표값 | 근거 |
|------|--------|------|
| 처리량 | 8~15 tok/s 이상 | 5턴 루프 × 250토큰 = 80~156초 (생성만) |
| 첫 토큰 지연 | < 3초 | UX 허용 범위 |
| 요청 타임아웃 | 60초 | S3 httpx timeout |
| 최대 컨텍스트 | 8,192 토큰 | v1 기본 설정 |

### 최적화 포인트

- `--gpu-memory-utilization 0.85`: VRAM 최대 활용
- `--max-model-len 8192`: 과도한 KV cache 예약 방지
- `--dtype float16`: Blackwell에서 FP16 성능 우수
- Continuous Batching: vLLM 기본 활성화
- 향후 `--enable-prefix-caching`: 반복 시스템 프롬프트 캐시

### 성능 팁 (외부 피드백 기반)

- 모든 턴을 thinking 모드로 돌리면 느림 → **control turn은 non-thinking**
- 최종 synthesis만 더 큰 budget 부여
- 도구 실행 시간 + 컨텍스트 재주입 비용도 합산됨

---

## 7. 향후 확장

### Tool Calling (v1.5~)

vLLM의 tool calling 기능을 활용하여 Agentic SAST를 지원:

```json
{
  "model": "Qwen/Qwen2.5-32B-Instruct",
  "messages": [...],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "source.get_span",
        "description": "소스 코드 구간 조회",
        "parameters": { ... }
      }
    }
  ],
  "tool_choice": "auto"
}
```

- S3가 tool 정의를 조립하여 S4에 전달
- S4는 tool 정의를 이해하고 tool_call 응답을 생성
- 실제 tool 실행은 S3 또는 외부 MCP Server가 수행 (S4는 실행하지 않음)

### Structured Output (v2~)

`response_format` 파라미터로 JSON 출력 강제:

```json
{
  "response_format": {
    "type": "json_object"
  }
}
```

---

## 8. 보안 고려사항

- S4는 **내부 네트워크에서만** 접근 가능 (외부 노출 금지)
- API key 설정은 선택사항이지만, 운영 환경에서는 권장
- S4에 도달하는 모든 입력은 S3가 이미 검증한 상태
- S4는 파일시스템, 네트워크, ECU에 직접 접근하지 않음
- 모델 가중치 파일의 무결성 검증 (SHA256)

---

## 관련 문서

- [전체 개요](technical-overview.md)
- [S3. LLM Gateway](llm-gateway.md)
- [S3↔S4 API 계약서](../api/llm-engine-api.md)
- [S4 인수인계서](../s4-handoff/README.md)
- [외부 피드백: vLLM 권고](../외부피드백/S3_agentic_sast_design_feedback.md)
