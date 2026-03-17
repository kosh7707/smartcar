# S4. LLM Engine 개발자 인수인계서

> 이 문서는 S4(LLM Engine) 셋업 및 운영을 이어받는 다음 세션을 위한 인수인계서다.
> DGX Spark에 Qwen3.5-35B-A3B FP8을 vLLM으로 서빙하여 S3(LLM Gateway)에 추론 API를 제공하는 것이 목표다.

---

## 1. 프로젝트 전체 그림

### 4-서비스 MSA 구조

```
[Electron + React + TS]  <-->  [Express.js + TS]  <-->  [Python FastAPI]  <-->  [vLLM + Qwen3.5 35B-A3B]
     Frontend (S1)              Backend (S2)             LLM Gateway (S3)        LLM Engine (S4)
     :5173 (dev)                :3000                    :8000                    :8000 (DGX Spark)
```

통신 방향: `S1 → S2 → S3 → S4` (단방향 의존)

### S4의 정체성

> S4는 모델을 로드하고 추론을 수행하는 서빙 계층이다.
> 프롬프트 구성, 출력 검증, 비즈니스 로직은 S3/S2의 영역이다.
> S4는 **빠르고 안정적인 추론을 제공하는 데 집중**한다.

---

## 2. DGX Spark 접속

### 접속 정보

| 항목 | 값 |
|------|------|
| IP | `10.126.37.19` |
| 사용자 | `accslab` |
| 호스트명 | `spark-be83` |
| 아키텍처 | aarch64 (ARM64) |
| OS | NVIDIA DGX Spark Version 7.4.0 (GNU/Linux 6.14.0-1015-nvidia) |

### SSH 접속 방법

SSH 키 인증이 설정되어 있다. 비밀번호 인증(`sshpass`)은 Claude Code 실행 환경에서 pty 제한으로 동작하지 않으므로 **키 인증만 사용**한다.

```bash
# 단발 명령 실행
ssh -i ~/.ssh/dgx_spark accslab@10.126.37.19 "명령어"

# 인터랙티브 셸 (사용자 직접 실행 시)
ssh -i ~/.ssh/dgx_spark accslab@10.126.37.19
```

### SSH 키 재설정 (키가 없을 때)

```bash
# 1. 키 생성
ssh-keygen -t ed25519 -f ~/.ssh/dgx_spark -N ""

# 2. DGX Spark에 공개키 등록 (비밀번호 입력 필요 — 사용자가 직접 실행)
ssh-copy-id -i ~/.ssh/dgx_spark.pub accslab@10.126.37.19
```

### 작업 흐름

S4의 작업은 두 환경에 걸쳐 이루어진다:

| 환경 | 하는 일 |
|------|--------|
| **DGX Spark** (원격) | vLLM 컨테이너 기동, 모델 관리, GPU 모니터링 |
| **WSL2** (로컬) | 문서 업데이트 (`docs/` 하위 S4 담당 문서만), S3 연동 테스트 |

원격 명령은 `ssh -i ~/.ssh/dgx_spark accslab@10.126.37.19 "..."` 형태로 실행한다.

---

## 3. 너의 역할과 경계

### 너는

- S4 LLM Engine 운영자/개발자
- DGX Spark 하드웨어 + vLLM 서빙을 관리
- 모델 선정/교체/최적화 담당
- `docs/api/llm-engine-api.md` API 계약서를 소유/관리 (S3↔S4 인터페이스)

### 너는 하지 않는다

- 프롬프트 작성 → S3 담당
- LLM 응답 파싱/검증 → S3 담당
- 분석 결과 최종 판정 → S2 담당
- UI → S1 담당

### API 계약 소통 원칙 (필수)

- **다른 서비스의 동작은 반드시 API 계약서(`docs/api/`)로만 파악한다**
- **다른 서비스의 코드를 절대 읽지 않는다** — 코드를 보고 동작을 파악하거나 거기에 맞춰 구현하는 것은 금지
- 계약서에 없는 필드/엔드포인트는 "존재하지 않는다"고 간주한다
- 계약서와 실제 코드가 다르면, 해당 서비스 소유자에게 계약서 갱신을 work-request로 요청한다
- **공유 모델(`shared-models.md`) 또는 API 계약서가 변경되면, 영향받는 상대 서비스에게 반드시 work-request로 고지한다**

### 작업 요청 주고받기

- **경로**: `docs/work-requests/`
- **파일명**: `{보내는쪽}-to-{받는쪽}-{주제}.md`
- S3에게 요청할 일이 있으면 이 폴더에 문서를 작성한다
- **작업 완료 후 해당 요청 문서를 반드시 삭제한다**

---

## 4. 현재 상태 (Setup Checklist)

### Phase 1: 기본 서빙 ✅ 완료

- [x] DGX Spark 물리 연결 — IP: 10.126.37.19, 호스트명: spark-be83
- [x] OS/드라이버 확인 — NVIDIA 드라이버 580.126.09, CUDA 13.0
- [x] SSH 키 인증 설정 — `~/.ssh/dgx_spark` (ed25519)
- [x] Docker + NVIDIA Container Runtime 확인 — Docker 29.1.3, NCR 1.18.2
- [x] spark-vllm-docker 설치 — `~/spark-vllm-docker/`
- [x] vLLM 컨테이너 빌드 완료 — `vllm-node` 이미지 (7분)
- [x] Qwen3.5-35B-A3B-FP8 모델 다운로드 — `~/.cache/huggingface/hub/` (5분)
- [x] vLLM 서빙 기동 + GPU 사용 확인 (GPU-Util 96%, 84GB)
- [x] WSL2 → DGX Spark 원격 추론 테스트 성공 (~26 tok/s)
- [x] Thinking 모드 제어 확인 (`enable_thinking: false` 동작)
- [x] S3 연동 검증 완료 — S3 vLLM 전환 완료, 통합 테스트 통과 (2026-03-14)

### Phase 2: 안정화 (진행 필요)

- [x] ollama systemd 서비스 설정 (이전 — 현재 비활성화됨)
- [ ] vLLM 컨테이너 자동 시작 설정 (systemd 또는 Docker restart policy)
- [ ] vLLM 헬스체크 + 자동 재시작
- [ ] 이전 ollama 리소스 정리 (`~/.ollama/models/`, ollama systemd 제거)
- [x] 성능 벤치마크 완료 — ~26 tok/s

### Phase 3: 최적화 (향후)

- [ ] Tool calling 실 연동 테스트 (S3와 함께)
- [x] Structured output (`response_format: json_object`) 테스트 — 2026-03-16 실 검증 완료
- [ ] 모델 업그레이드 평가 (Qwen3.5 122B 등)
- [ ] Tensor Parallelism (GB10 2대 구성 시)

### 기술 전환 이력

| 시기 | 변경 | 이유 |
|------|------|------|
| Phase 1 초기 | vLLM 시도 → 실패 | PyTorch cu130이 CC 12.1 미지원 |
| Phase 1 | ollama + Qwen3 32B | llama.cpp 기반, CC 12.1 네이티브 지원 |
| Phase 2 | ollama `/api/chat` 전환 | OpenAI 호환 레이어에서 thinking 제어 불가 |
| **현재** | **vLLM (spark-vllm-docker) + Qwen3.5-35B-A3B FP8** | CC 12.1 사전 컴파일 휠로 해결, MoE 모델로 2.5배 성능 향상 |

### 최근 활동 (2026-03-17)

- S4 로그 삭제 스크립트 작성: `scripts/common/clear-s4-logs.sh`
  - DGX Spark의 `/tmp/vllm-launch.log`를 SSH로 truncate
- 정적 분석 배치 테스트 (requestId: `4aef1f36`) — **7개 태스크 전부 200 OK**, INVALID_GROUNDING 없음
  - 병렬 처리: 최대 **4 reqs** 동시 처리
  - Avg prompt throughput: 1,500~3,000 tokens/s
  - Avg generation throughput: 60~113 tokens/s
  - GPU KV cache 사용률: 최대 2.1% (여유 충분)
  - Prefix cache hit rate: ~1.2%
- 문서 갭 3건 수정 완료:
  - 인수인계서 Section 5 로그 확인: `s4-exchange.jsonl`, `reset-logs-all.sh` 추가
  - 인수인계서 Section 11 로드맵: Structured output 완료 표시로 변경
  - 기능 명세(`llm-engine.md`) Section 10 "로깅 및 관측성" 신규 추가
- SAST 도구 통합 + GraphRAG 로드맵 논의 → S3에 work-request 발송
  - `docs/work-requests/s4-to-s3-sast-graphrag-roadmap.md`
  - 결론: SAST 도구 통합 우선, GraphRAG는 현 단계에서 불필요
  - S4 영향 없음 (프롬프트 길어질 뿐, 컨텍스트/KV cache 여유 충분)

### 이전 활동 (2026-03-16)

- 정적분석 통합테스트 완료 — S1→S2→S3→S4 전 구간 연동 확인
- vLLM 로그 리뷰: 400 Bad Request 2건 발견 (S3가 프롬프트 길이 제한 없이 전송)
  - 43MB 프롬프트 (43,026,069자) → 400 거절
  - 260,097 토큰 프롬프트 (max_model_len 초과) → 400 거절
- API 계약서(`llm-engine-api.md`)에 컨텍스트 한도(262,144 토큰) 섹션 추가
- S3에 work-request 발송: 프롬프트 길이 사전 검증 요청 + S2와 입력 크기 책임 분담 협의 요청
- Structured output (`response_format: json_object`) 실 검증 완료

---

## 5. 기동 방법

### vLLM 서빙 기동

```bash
# DGX Spark에 SSH 접속 후
cd ~/spark-vllm-docker

# 서빙 시작 (포그라운드)
./run-recipe.sh qwen3.5-35b-a3b-fp8 --solo --tensor-parallel 1 --port 8000

# 백그라운드 기동
nohup ./run-recipe.sh qwen3.5-35b-a3b-fp8 --solo --tensor-parallel 1 --port 8000 > /tmp/vllm-launch.log 2>&1 &
```

**주의**: `source $HOME/.local/bin/env`가 필요할 수 있음 (uvx 경로 설정).

### 원격 기동 (WSL2에서)

```bash
ssh -i ~/.ssh/dgx_spark accslab@10.126.37.19 \
  "source \$HOME/.local/bin/env && cd ~/spark-vllm-docker && nohup ./run-recipe.sh qwen3.5-35b-a3b-fp8 --solo --tensor-parallel 1 --port 8000 > /tmp/vllm-launch.log 2>&1 &"
```

### 서빙 중지

```bash
ssh -i ~/.ssh/dgx_spark accslab@10.126.37.19 'docker stop vllm_node && docker rm vllm_node'
```

### 기동 시간

| 단계 | 소요 시간 |
|------|-----------|
| 컨테이너 시작 | ~10초 |
| 모델 로딩 | ~54초 |
| torch.compile (캐시 있을 때) | ~30초 |
| torch.compile (첫 실행) | ~3분 |
| **총 (캐시 있을 때)** | **~2분** |
| 첫 요청 워밍업 | ~19초 (이후 ~5초) |

### 동작 확인

```bash
# 헬스체크
curl http://10.126.37.19:8000/health

# 모델 목록
curl http://10.126.37.19:8000/v1/models

# 추론 테스트 (non-thinking)
curl -X POST http://10.126.37.19:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen3.5-35B-A3B-FP8",
    "messages": [
      {"role": "user", "content": "gets() 함수의 위험성을 한 문장으로 설명하세요."}
    ],
    "max_tokens": 128,
    "temperature": 0.3,
    "chat_template_kwargs": {"enable_thinking": false}
  }'
# 기대: choices[0].message.content에 응답 텍스트, reasoning: null

# GPU 확인
ssh -i ~/.ssh/dgx_spark accslab@10.126.37.19 'nvidia-smi'
# 기대: GPU-Util ~96%, Memory ~84GB, VLLM::EngineCore 프로세스
```

### 로그 확인

```bash
# vLLM 서버 로그 (DGX Spark 원격)
ssh -i ~/.ssh/dgx_spark accslab@10.126.37.19 'tail -20 /tmp/vllm-launch.log'

# Docker 컨테이너 로그
ssh -i ~/.ssh/dgx_spark accslab@10.126.37.19 'docker logs vllm_node --tail 20'

# S4 교환 로그 (S3가 기록, 로컬) — 요청/응답 전문 + 레이턴시 + 토큰 수
tail -20 logs/s4-exchange.jsonl

# vLLM 로그 삭제 (DGX Spark 원격)
./scripts/common/clear-s4-logs.sh

# 전체 로그 일괄 초기화 (S2+S3+S4)
./scripts/common/reset-logs-all.sh
```

---

## 6. S3와의 연동

### S3가 S4를 호출하는 방식

API 계약(`docs/api/llm-engine-api.md`)에 따라 S3는 다음 형식으로 호출한다:

```
POST {endpoint}/v1/chat/completions
Headers: Content-Type: application/json
Body: { model, messages, max_tokens, temperature, chat_template_kwargs }
```

S3는 응답에서 `choices[0].message.content`를 추출한다. Thinking 활성화 시 `choices[0].message.reasoning`으로 사고 과정에 접근 가능. 상세 스키마는 API 계약서 참조.

### S3 환경변수 변경

```env
SMARTCAR_LLM_MODE=real
SMARTCAR_LLM_ENDPOINT=http://10.126.37.19:8000        # vLLM 포트 8000
SMARTCAR_LLM_MODEL=Qwen/Qwen3.5-35B-A3B-FP8          # HuggingFace 모델명
SMARTCAR_LLM_API_KEY=                                    # vLLM: 불필요
```

**변경사항 (이전 ollama 대비)**:
- 포트: `11434` → `8000`
- 모델명: `qwen3:32b` → `Qwen/Qwen3.5-35B-A3B-FP8`
- API: `/api/chat` (ollama 네이티브) → `/v1/chat/completions` (OpenAI 호환)
- Thinking 제어: `"think": false` → `"chat_template_kwargs": {"enable_thinking": false}`
- 응답: `message.content` → `choices[0].message.content`

### 연동 확인 절차

1. DGX Spark에서 vLLM 컨테이너 기동
2. WSL2에서 `curl http://10.126.37.19:8000/v1/models` → 모델 목록 확인
3. S3 환경변수 설정 후 S3 기동
4. v1 테스트: `POST /v1/tasks` (taskType: static-explain)
5. 로그 확인: `logs/s3-llm-gateway.jsonl`에 latency, tokenUsage 기록 확인

---

## 7. S3가 기대하는 출력 형식

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

## 8. 하드웨어 사양 (DGX Spark)

| 항목 | 사양 |
|------|------|
| GPU | NVIDIA GB10 (Blackwell), Compute Capability 12.1 |
| 드라이버 | 580.126.09, CUDA 13.0 |
| 메모리 | 128GB LPDDR5x unified (가용 ~119.7GB) |
| 대역폭 | 273 GB/s |
| 디스크 | 3.7TB NVMe |
| 아키텍처 | aarch64 (ARM64) |
| Python | 3.12.3 |
| Docker | 29.1.3 + NVIDIA Container Runtime 1.18.2 |
| 네트워크 | ConnectX-7 (100GbE) |

### 모델 메모리 분석

| 항목 | 크기 |
|------|------|
| Qwen3.5-35B-A3B FP8 모델 | ~34.2GB |
| vLLM 총 GPU 사용 (모델 + KV cache + 런타임) | ~84GB |
| 여유 | ~36GB |
| 결론 | 128GB unified에 충분 |

---

## 9. 성능 실측

| 항목 | 실측값 | 비고 |
|------|--------|------|
| 처리량 (non-thinking) | **~26 tok/s** | 단일 요청, 워밍업 후 |
| 처리량 (첫 요청) | ~13 tok/s | torch.compile 포함 |
| 보안분석 응답 시간 | **19초** | 짧은 입력, 509토큰 생성 |
| 배치 prompt throughput | **1,500~3,000 tok/s** | 4 reqs 병렬 처리 시 |
| 배치 generation throughput | **60~113 tok/s** | 4 reqs 병렬 처리 시 |
| JSON 유효율 | 100% (테스트 기준) | `enable_thinking: false` |
| GPU-Util | 96% | 추론 중 |
| GPU 메모리 | 84,276MiB | 모델 + KV cache |
| GPU KV cache 사용률 | 2.1% (피크) | 배치 처리 시 |

### 이전 대비 개선

| 항목 | ollama + Qwen3 32B | vLLM + Qwen3.5 35B-A3B |
|------|:---:|:---:|
| 처리량 | 10.2 tok/s | **26 tok/s (+155%)** |
| 보안분석 응답 | 48초 | **19초 (-60%)** |
| GPU 메모리 활용 | 30GB | **84GB** |

---

## 10. 트러블슈팅

### S3에서 `LLM_UNAVAILABLE` 오류

- vLLM 컨테이너가 기동되지 않았거나 포트가 다름
- `curl http://10.126.37.19:8000/health`로 확인
- `docker ps | grep vllm_node`으로 컨테이너 상태 확인
- 방화벽/네트워크 확인 (WSL2↔DGX Spark)

### S3에서 `LLM_TIMEOUT` 오류

- 첫 요청 시 torch.compile 워밍업으로 ~19초 소요 (이후 ~5초)
- `max_tokens`가 너무 크거나 입력이 너무 긴 경우
- S3 타임아웃을 120초로 상향 권장

### S3에서 `LLM_PARSE_ERROR`

- 모델이 JSON이 아닌 자연어를 반환한 경우
- `enable_thinking: false`가 제대로 전달되었는지 확인 (thinking 켜져 있으면 reasoning에 토큰 소비)
- temperature를 낮추면 (0.1~0.3) JSON 준수율 향상

### vLLM 관련

- **첫 실행 OOM**: torch.compile이 메모리를 많이 사용. 재실행하면 캐시 사용으로 해결
- **컨테이너 재시작**: `docker stop vllm_node && docker rm vllm_node` 후 다시 `run-recipe.sh`
- **모델 재다운로드**: `./run-recipe.sh qwen3.5-35b-a3b-fp8 --solo --download-only`

### ollama 잔존 (이전 설정)

- ollama systemd 서비스가 아직 설정되어 있음 (비활성화 상태)
- vLLM과 동시 실행 시 GPU 메모리 충돌 → ollama 서비스를 disable 처리할 것
- `systemctl --user disable ollama.service`로 영구 비활성화

---

## 11. 향후 로드맵

| 항목 | 시기 | 설명 |
|------|------|------|
| SAST 도구 통합 대응 | 다음 마일스톤 | S2 주도, S3 프롬프트 재설계. S4는 변경 없음 (배치 테스트 지원만) |
| vLLM 자동 기동 | Phase 2 | Docker restart policy 또는 systemd |
| Tool calling 연동 | v1.5 | S3와 함께 실 테스트 (vLLM에 이미 설정됨) |
| ~~Structured output~~ | ~~v1.5~~ | ✅ 완료 (2026-03-16 실 검증) |
| ollama 정리 | Phase 2 | 잔존 모델/서비스 제거 |
| 모델 업그레이드 | 수시 | 새 모델 → 레시피 추가/변경 |

---

## 12. 관리하는 문서

| 문서 | 경로 | 용도 |
|------|------|------|
| 기능 명세서 | `docs/specs/llm-engine.md` | S4 아키텍처, 모델, 서빙 설정 |
| API 계약서 | `docs/api/llm-engine-api.md` | S3↔S4 인터페이스 명세 |
| 이 인수인계서 | `docs/s4-handoff/README.md` | 다음 세션용 |

---

## 13. 참고할 문서들

| 문서 | 경로 | 왜 봐야 하는지 |
|------|------|--------------|
| 전체 기술 개요 | `docs/specs/technical-overview.md` | 프로젝트 전체 구조 이해 |
| S3 API 명세 | `docs/api/llm-gateway-api.md` | S3↔S4 계약의 S3 측 관점 (필독) |
| 외부 피드백 (Agentic) | `docs/외부피드백/S3_agentic_sast_design_feedback.md` | 성능 가이드 |
| spark-vllm-docker | `~/spark-vllm-docker/README.md` (DGX Spark) | vLLM 빌드/배포 가이드 |
