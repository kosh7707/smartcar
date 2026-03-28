# S7 LLM Engine — 운영 정보

> DGX Spark에서 구동되는 LLM Engine(vLLM)의 접속, 기동, 성능, 트러블슈팅 정보.

---

## DGX Spark 접속

| 항목 | 값 |
|------|------|
| IP | `10.126.37.19` |
| 사용자 | `accslab` |
| 호스트명 | `spark-be83` |
| 아키텍처 | aarch64 (ARM64) |
| OS | NVIDIA DGX Spark Version 7.4.0 (GNU/Linux 6.14.0) |

```bash
# 단발 명령
ssh -i ~/.ssh/dgx_spark accslab@10.126.37.19 "명령어"

# SSH 키 재설정 (키가 없을 때 — 사용자가 직접 실행)
ssh-keygen -t ed25519 -f ~/.ssh/dgx_spark -N ""
ssh-copy-id -i ~/.ssh/dgx_spark.pub accslab@10.126.37.19
```

---

## 하드웨어 사양

| 항목 | 사양 |
|------|------|
| GPU | NVIDIA GB10 (Blackwell), CC 12.1 |
| 드라이버 | 580.126.09, CUDA 13.0 |
| 메모리 | 128GB LPDDR5x unified (가용 ~119.7GB) |
| 대역폭 | 273 GB/s |
| 디스크 | 3.7TB NVMe |
| Docker | 29.1.3 + NVIDIA Container Runtime 1.18.2 |

모델 메모리: Qwen3.5-122B-A10B-GPTQ-Int4 ~67GiB, vLLM 총 GPU 사용 ~96GiB (gpu_mem 0.75), 여유 ~23GiB

---

## vLLM 기동/중지

```bash
# 원격 기동 (WSL2에서)
ssh -i ~/.ssh/dgx_spark accslab@10.126.37.19 \
  "source \$HOME/.local/bin/env && cd ~/spark-vllm-docker && \
   nohup ./run-recipe.sh qwen3.5-122b-gptq-int4 --solo --tensor-parallel 1 --port 8000 \
   > /tmp/vllm-launch.log 2>&1 &"

# 중지
ssh -i ~/.ssh/dgx_spark accslab@10.126.37.19 'docker stop vllm_node && docker rm vllm_node'

# 동작 확인
curl http://10.126.37.19:8000/health
curl http://10.126.37.19:8000/v1/models
ssh -i ~/.ssh/dgx_spark accslab@10.126.37.19 'nvidia-smi'
```

**주의**: `source $HOME/.local/bin/env`가 필요 (uvx 경로 설정).

---

## 기동 시간

| 단계 | 소요 시간 |
|------|-----------|
| 컨테이너 시작 | ~10초 |
| 모델 로딩 | ~95초 (67GiB) |
| torch.compile (캐시 있을 때) | ~2분 |
| torch.compile (첫 실행) | ~5분 |
| **총 (캐시 있을 때)** | **~4분** |
| 첫 요청 워밍업 | ~0.6초 (torch.compile 캐시 히트), 캐시 없으면 ~48초 |

---

## 성능 실측 (122B-GPTQ-Int4, 2026-03-24 갱신)

| 항목 | 실측값 | 비고 |
|------|--------|------|
| 처리량 (non-thinking) | **~14 tok/s** | 단일 요청, gpu_mem 0.75 + chunked prefill |
| 워밍업 (torch.compile 캐시 히트) | **~0.6초** | Gateway lifespan 자동 워밍업 |
| 통합 테스트 Turn 1 (tool_calls) | **12초** | 5.3K prompt -> 153 completion, 도구 3건 |
| 통합 테스트 Turn 2 (분석 보고서) | **157초** | 7.7K prompt -> 2190 completion |
| PoC 생성 (4건 평균) | **109초** | ~1500 completion tokens/건 |
| 풀 파이프라인 총 소요 | **10분** | Deep Analysis 2턴 + PoC 4건, 30K 토큰 |
| JSON 유효율 | 100% | `enable_thinking: false` |
| vLLM 컨텍스트 한도 | 262,144 토큰 | 초과 시 400 에러 |

---

## 트러블슈팅

| 증상 | 원인 | 조치 |
|------|------|------|
| `LLM_UNAVAILABLE` | 컨테이너 미기동 / 포트 불일치 | `curl health` + `docker ps \| grep vllm_node`. connect 타임아웃 10초에 감지 |
| `LLM_TIMEOUT` | 첫 요청 torch.compile 워밍업 ~19초 | connect 10초 / read 600초 분리 |
| `LLM_PARSE_ERROR` | JSON 대신 자연어 반환 | `enable_thinking: false` 확인, temperature 0.1~0.3 |
| 첫 실행 OOM | torch.compile 메모리 과다 | 재실행 시 캐시로 해결 |
| 컨테이너 재시작 필요 | 상태 이상 | `docker stop && rm` 후 재기동 |

---

## 로그 확인

```bash
# vLLM 서버 로그
ssh -i ~/.ssh/dgx_spark accslab@10.126.37.19 'tail -20 /tmp/vllm-launch.log'

# Docker 컨테이너 로그
ssh -i ~/.ssh/dgx_spark accslab@10.126.37.19 'docker logs vllm_node --tail 20'
```

---

## 기술 전환 이력

| 시기 | 변경 | 이유 |
|------|------|------|
| Phase 1 초기 | vLLM 시도 -> 실패 | PyTorch cu130이 CC 12.1 미지원 |
| Phase 1 | ollama + Qwen3 32B | llama.cpp 기반, CC 12.1 네이티브 지원 |
| Phase 2 | ollama `/api/chat` 전환 | OpenAI 호환 레이어에서 thinking 제어 불가 |
| Phase 3 | vLLM + Qwen3.5-35B-A3B FP8 | CC 12.1 사전 컴파일 휠로 해결, MoE +155% |
| **현재** | **vLLM + Qwen3.5-122B-A10B-GPTQ-Int4** | Qwen 공식 GPTQ, 122B MoE, Expert=INT4/Attention=BF16 |
