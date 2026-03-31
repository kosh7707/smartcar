# S7. LLM Engine 기능 명세

> LLM Engine은 S7이 관리하는 LLM 추론 모델 서빙 계층이다.
> S7(LLM Gateway)이 유일한 호출자이며, OpenAI-compatible API(`/v1/chat/completions`)를 제공한다.

---

## 1. 역할

### 책임

- Qwen3.5-122B-A10B-GPTQ-Int4 모델 로딩 및 추론 수행
- OpenAI-compatible REST API 제공 (`/v1/chat/completions`)
- Thinking 모드 제어 (`enable_thinking` 파라미터)
- Tool calling 지원 (`qwen3_coder` 파서)
- GPU 메모리 관리 및 추론 최적화 (PagedAttention, FP8 KV cache, prefix caching)

### 비책임

- 프롬프트 구성 및 템플릿 관리 → S7 (Gateway)
- 출력 검증 및 파싱 → S7 (Gateway)
- 입력 신뢰도 관리 → S7 (Gateway)
- 비즈니스 로직 → S2
- 사용자 인터페이스 → S1

---

## 2. 하드웨어

### DGX Spark

| 항목 | 사양 |
|------|------|
| GPU | NVIDIA GB10 (Blackwell), Compute Capability 12.1 |
| 드라이버 | 580.126.09 |
| CUDA | 13.0 |
| 메모리 | 128GB LPDDR5x unified (GPU/CPU 공유, 가용 ~119.7GB) |
| 대역폭 | 273 GB/s |
| 디스크 | 3.7TB NVMe |
| 아키텍처 | aarch64 (ARM64) |
| OS | NVIDIA DGX Spark Version 7.4.0 |
| Docker | 29.1.3 + NVIDIA Container Runtime 1.18.2 |
| 연결 | ConnectX-7 (100GbE) |
| IP | 환경변수 `AEGIS_LLM_ENDPOINT`로 설정 (인수인계서 참조) |

### 모델 메모리 분석

| 항목 | 크기 |
|------|------|
| Qwen3.5-122B-A10B-GPTQ-Int4 모델 | ~67 GiB |
| vLLM 런타임 + KV cache + FlashInfer | ~24 GiB |
| 총 GPU 메모리 사용 | ~96 GiB (gpu_memory_utilization: 0.75) |
| 결론 | 128GB unified에 충분, 262K 컨텍스트 처리 가능 |

---

## 3. 모델: Qwen3.5-122B-A10B-GPTQ-Int4

### MoE (Mixture of Experts) 아키텍처

| 항목 | 값 |
|------|------|
| 총 파라미터 | 122B |
| 활성 파라미터 (토큰당) | **10B** |
| 전문가 수 | 256개 |
| 활성 전문가 (토큰당) | 8 라우팅 + 1 공유 = 9개 |
| 어텐션 | Gated Delta Networks + Sparse MoE 하이브리드 |
| 컨텍스트 | 262,144 토큰 (네이티브) |
| 양자화 | FP8 (네이티브, 정밀도 손실 최소) |
| 라이선스 | Apache 2.0 |

122B 파라미터 중 토큰당 10B만 활성화하여, dense 모델 대비 **훨씬 빠른 추론 속도**를 달성한다. GPTQ-Int4 양자화 적용(Expert=INT4, Attention=BF16).

### 지원 기능

- **Thinking 모드**: `<think>` 태그 기반 추론 체인, API로 on/off 제어 가능
- **Tool calling**: `qwen3_coder` 파서로 함수 호출 지원
- **멀티모달**: 텍스트 + 이미지 입력 지원 (현재 텍스트만 사용)

### 모델 전환 이력

| 항목 | Qwen3 32B | Qwen3.5-35B-A3B FP8 | Qwen3.5-122B-A10B-GPTQ-Int4 (현재) |
|------|:---:|:---:|:---:|
| 아키텍처 | Dense | MoE | **MoE** |
| 활성 파라미터 | 32B (전체) | 3B | **10B** |
| 추론 서버 | ollama | vLLM | **vLLM** |
| 처리량 | 10.2 tok/s | ~26 tok/s | **~14 tok/s** |
| GPU 메모리 | 30GB | 84GB | **~96 GiB** |
| 양자화 | — | FP8 (네이티브) | **GPTQ-Int4 (Expert=INT4, Attention=BF16)** |
| Thinking 제어 | `/api/chat`에서만 | OpenAI API | **OpenAI API** |

### 모델 행동 특성 (통합 테스트 관측, 2026-03-30)

**tool_calls 선호 경향**

- `tools`가 제공되고 `tool_choice="auto"`일 때, **73.9% 확률**로 `finish_reason=tool_calls` 반환 (46회 호출 중 34회)
- 자발적 content 전환(보고서 작성)은 비결정적이며 낮은 확률
- `tools`가 없는 요청은 100% `finish_reason=stop` (content) 반환
- **대응**: 호출자가 적절한 시점에 `tools` 제거 또는 `tool_choice="none"` 설정으로 content 전환을 강제해야 한다

**evidence ref 환각**

- 프롬프트에 제공된 예시 ref(`eref-sast-00` 등)를 실제 도구 반환 ref 대신 복사하는 경향
- 실제 도구 반환값의 ref를 무시하고 텍스트에서 임의 ref를 생성하는 경우 있음
- **대응**: 호출자 측 evidence ref 검증 필수 (soft/hard 모드)

---

## 4. 추론 서버: vLLM (spark-vllm-docker)

### 선정 근거

| 기준 | 근거 |
|------|------|
| GB10 GPU 지원 | `TORCH_CUDA_ARCH_LIST="12.1a"`로 사전 컴파일된 휠 제공 |
| 성능 | PagedAttention, FlashInfer, FP8 KV cache, prefix caching |
| Thinking 제어 | `--reasoning-parser qwen3`로 OpenAI API에서 thinking on/off 가능 |
| Tool calling | `--enable-auto-tool-choice --tool-call-parser qwen3_coder` 내장 |
| Qwen3.5 지원 | vLLM 0.17.0+ 공식 지원, 전용 레시피 제공 |

### ollama에서 전환한 이유

1. **성능**: MoE 모델(Qwen3.5-35B-A3B)의 이점을 최대한 활용 (ollama 10 tok/s → vLLM 26 tok/s)
2. **Thinking 제어**: ollama의 OpenAI 호환 레이어에서 thinking 비활성화 불가 → vLLM은 가능
3. **메모리 효율**: PagedAttention + FP8 KV cache로 262K 컨텍스트 처리 가능
4. **Prefix caching**: 동일 시스템 프롬프트 재활용 (보안 분석 태스크에 유리)

### 배포 구조

```
DGX Spark
  └── Docker (vllm-node 컨테이너)
        └── vLLM 0.17.1rc1 (CUDA 13.1, aarch64)
              └── Qwen3.5-122B-A10B-GPTQ-Int4
                    ├── FlashInfer attention (CC 12.1a)
                    ├── FP8 KV cache
                    ├── Prefix caching
                    └── Reasoning parser (qwen3)
```

### 서버 기동

```bash
# DGX Spark에서
cd ~/spark-vllm-docker
./run-recipe.sh qwen3.5-122b-gptq-int4 --solo --tensor-parallel 1 --port 8000
```

### 주요 vLLM 파라미터

| 파라미터 | 값 | 설명 |
|----------|------|------|
| `--port` | 8000 | API 포트 |
| `--host` | 0.0.0.0 | 외부 접근 허용 |
| `--gpu-memory-utilization` | 0.75 | GPU 메모리 75% 사용 (KV cache 확대) |
| `--max-model-len` | 262144 | 최대 컨텍스트 길이 |
| `--kv-cache-dtype` | fp8 | KV cache FP8 양자화 |
| `--attention-backend` | flashinfer | FlashInfer 어텐션 |
| `--enable-prefix-caching` | - | 프리픽스 캐싱 활성화 |
| `--enable-chunked-prefill` | - | 청크 프리필 활성화 (ITL 개선) |
| `--reasoning-parser` | qwen3 | Thinking 모드 분리 파서 |
| `--enable-auto-tool-choice` | - | Tool calling 자동 선택 |
| `--tool-call-parser` | qwen3_coder | Tool call 파서 |
| `--load-format` | fastsafetensors | 빠른 모델 로딩 |
| `--chat-template` | unsloth.jinja | 호환 챗 템플릿 |
| `-tp` | 1 | Tensor parallelism (GPU 1개) |

---

## 5. API 인터페이스

상세 스키마는 [API 명세서](../api/llm-engine-api.md)를 참조. 여기서는 설계 원칙만 기술한다.

### 엔드포인트

| 메서드 | 경로 | 포트 | 용도 |
|--------|------|------|------|
| POST | `/v1/chat/completions` | 8000 | 추론 요청 (OpenAI 호환) |
| GET | `/v1/models` | 8000 | 사용 가능한 모델 목록 |
| GET | `/health` | 8000 | 헬스체크 |

### 포트

vLLM 서빙 포트는 **8000**이다 (이전 ollama의 11434에서 변경). S7의 `AEGIS_LLM_ENDPOINT`에 이 포트를 지정해야 한다.

### Thinking 모드 제어

vLLM의 `--reasoning-parser qwen3` 옵션으로 OpenAI 호환 API에서 thinking 모드를 제어할 수 있다:

- **비활성화**: `"chat_template_kwargs": {"enable_thinking": false}` → `content`에 바로 응답
- **활성화**: 기본값 (또는 `"enable_thinking": true`) → `reasoning` 필드에 사고 과정, `content`에 최종 답변

### 응답 형식

OpenAI-compatible JSON. `choices[0].message.content`로 응답 추출.

---

## 6. S7 Gateway↔LLM Engine 연동

### 통신 구조

```
S7 Gateway (LLM Gateway, :8000)
  │
  │  POST /v1/chat/completions
  │  (httpx, connect 10s / read 600s)
  │
  ▼
LLM Engine (DGX Spark, :8000)
  │
  │  vLLM (Qwen3.5-122B-A10B-GPTQ-Int4) inference
  │  Docker container on DGX Spark
  │
  ▼
GPU (GB10, ~96GiB used, GPU-Util 96%)
```

### S7 연결 설정

S7 Gateway의 환경변수로 LLM Engine을 가리킨다:

```env
AEGIS_LLM_MODE=real
AEGIS_LLM_ENDPOINT=http://${LLM_ENGINE_HOST}:8000
AEGIS_LLM_MODEL=Qwen/Qwen3.5-122B-A10B-GPTQ-Int4
AEGIS_LLM_API_KEY=                              # vLLM: 불필요
```

**주의**: S7 Gateway(WSL2)에서 LLM Engine(DGX Spark)으로의 통신이므로 `localhost`가 아닌 LLM Engine 호스트의 IP를 사용한다. 실제 IP는 `.env` 파일에서 설정하며, 접속 정보는 인수인계서(`docs/s7-handoff/README.md`)를 참조한다.

### 모델명 규칙

vLLM의 모델명은 HuggingFace 형식 `Qwen/Qwen3.5-122B-A10B-GPTQ-Int4`이다 (ollama의 `qwen3:32b` 형식과 다름).

### 연동 확인 절차

1. DGX Spark에서 vLLM 컨테이너 기동
2. `curl http://${LLM_ENGINE_HOST}:8000/v1/models` → 모델 목록 확인
3. S7 환경변수 설정 (`AEGIS_LLM_MODE=real`, endpoint/model 변경)
4. S7 Gateway 기동
5. S7 `/v1/health` → `modelProfiles` 확인
6. S7 `/v1/tasks` 테스트 요청 → 실 LLM 응답 확인

---

## 7. 성능 가이드라인

### 실측 성능 (2026-03-24 갱신)

| 항목 | 실측값 | 비고 |
|------|--------|------|
| 처리량 (단일, 122B) | **~14 tok/s** (non-thinking) | gpu_mem 0.75 + chunked prefill, 워밍업 후 |
| 배치 prompt throughput | **1,500~3,000 tok/s** | 4 reqs 병렬 처리 시 |
| 배치 generation throughput | **60~113 tok/s** | 4 reqs 병렬 처리 시 |
| GPU-Util | 96% | 추론 중 |
| GPU 메모리 | 84,276MiB | 모델 + KV cache |
| GPU KV cache 사용률 | 2.1% (피크) | 배치 처리 시. 여유 충분 |
| Prefix cache hit rate | ~1.2% | 시스템 프롬프트 다양 시 낮음 |
| 최대 동시 처리 | **4 reqs** | 대기 없이 처리 |
| 모델 로딩 시간 | ~54초 | 컨테이너 기동 포함 ~4분 |

### 배치 처리 특성 (2026-03-17 측정)

7개 정적 분석 태스크 동시 실행 시 관측된 특성:

| 태스크별 지표 | 범위 | 비고 |
|-------------|------|------|
| latency | 18.7~47.3초 | 입력 크기에 비례 |
| promptTokens | 3,029~17,609 | 태스크별 편차 큼 |
| completionTokens | 559~1,055 | 상대적으로 균일 |

- vLLM이 최대 4개 요청을 병렬 처리, 대기(Waiting) 없음
- KV cache 2.1%만 사용 → 더 큰 배치도 가능
- 전 요청 200 OK, 에러 없음

### 성능 팁

- 모든 턴을 thinking 모드로 돌리면 느림 → **control turn은 non-thinking**
- 최종 synthesis만 더 큰 budget 부여
- Prefix caching이 활성화되어 있어, 동일 시스템 프롬프트 반복 시 prompt 처리 속도 향상
- 첫 요청은 torch.compile 때문에 느림 → 기동 후 워밍업 요청 권장

---

## 8. 향후 확장

### Tool Calling (즉시 사용 가능)

vLLM에 `--enable-auto-tool-choice --tool-call-parser qwen3_coder`가 이미 설정되어 있어, 호출자(S7 Gateway 경유)가 `tools` 파라미터를 포함하면 바로 사용 가능:

```json
{
  "model": "Qwen/Qwen3.5-122B-A10B-GPTQ-Int4",
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
  "tool_choice": "auto",
  "max_tokens": 2048,
  "chat_template_kwargs": {"enable_thinking": false}
}
```

### Structured Output (즉시 사용 가능)

`response_format` 파라미터로 JSON 출력 강제:

```json
{
  "response_format": {
    "type": "json_object"
  }
}
```

### 향후 계획

| 항목 | 시기 | 설명 |
|------|------|------|
| 모델 업그레이드 | 수시 | Qwen3.5 122B (멀티 GPU 시), 차기 모델 |
| Tensor Parallelism | GB10 2대 구성 시 | TP=2로 처리량 향상 |
| 다중 모델 | v3 | 용도별 분리 (경량: 분류, 중량: 심층 분석) |

---

## 9. 보안 고려사항

- LLM Engine은 **내부 네트워크에서만** 접근 가능 (외부 노출 금지)
- vLLM은 기본적으로 API key 없이 동작 — 내부망 전제
- LLM Engine에 도달하는 모든 입력은 S7 Gateway가 이미 검증한 상태
- LLM Engine은 파일시스템, 네트워크, ECU에 직접 접근하지 않음
- Docker 컨테이너 내부에서 실행되어 호스트 격리

---

## 10. 로깅 및 관측성

### 로그 파일

| 로그 | 위치 | 작성자 | 내용 |
|------|------|--------|------|
| vLLM 서버 로그 | DGX Spark: `/tmp/vllm-launch.log` | vLLM | HTTP 요청 상태, 엔진 통계 |
| LLM 교환 로그 | `logs/llm-exchange.jsonl` | S7 (RealLlmClient) | 요청/응답 전문, 레이턴시, 토큰 수 |
| S7 서비스 로그 | `logs/aegis-llm-gateway.jsonl` | S7 | 태스크 수명주기, confidence, rag_hits |

### vLLM 엔진 통계 (10초 주기 자동 출력)

vLLM은 `/tmp/vllm-launch.log`에 10초 간격으로 엔진 통계를 기록한다:

- **Avg prompt throughput**: 입력 처리 속도 (tokens/s)
- **Avg generation throughput**: 생성 속도 (tokens/s)
- **Running / Waiting reqs**: 동시 처리 / 대기 요청 수
- **GPU KV cache usage**: KV cache 메모리 사용률 (%)
- **Prefix cache hit rate**: 프리픽스 캐시 적중률 (%)

### 로그 관리

- 전체 로그 일괄 초기화: `./scripts/common/reset-logs.sh` (S2 관리)

### 관측 한계

vLLM은 HTTP 액세스 로그와 엔진 통계만 기록한다.
실제 프롬프트 내용이나 응답 본문은 vLLM 로그에 포함되지 않는다.
프롬프트/응답 디버깅이 필요하면 `logs/llm-exchange.jsonl`을 참조한다.

---

## 관련 문서

- [전체 개요](technical-overview.md)
- [S7. LLM Gateway](llm-gateway.md)
- [S7 Gateway↔LLM Engine API 계약서](../api/llm-engine-api.md)
- [S7 인수인계서](../s7-handoff/README.md)
