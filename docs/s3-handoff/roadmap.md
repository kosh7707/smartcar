# S3 로드맵

> 다음 작업 + 장기 계획. README에서 분리.

---

## 세션 18 완료 (2026-04-04)

1. ~~**Residual alignment 1차 정리**~~ ✅ Analysis Agent legacy taskType router 차단, Build Agent `promptVersion` 정렬, `sdk-analyze` 문서 반영
2. ~~**공용 `.omx` 메모 규칙 반영**~~ ✅ `docs/AEGIS.md` / `s2-to-all` WR 확인 후 S3 handoff에 lane 전용 메모 분리 원칙 반영

## 다음 세션 목표 (세션 19)

### 즉시 처리

1. **`_pipeline` 잔재 제거 여부 결정** — `services/analysis-agent/app/routers/tasks.py`와 legacy plumbing 제거/축소
2. **RE100 재테스트** — 하트비트 고도화 + stall 감지 적용 후 4개 프로젝트 재실행
3. **공용 `.omx` S3 기록 점검** — 전역 가치가 낮은 S3 lane 기록은 handoff/session state로 추가 이동 검토

### 백로그

1. **Build Agent 프로세스 격리** — bash 실행 namespace 격리
2. **골든셋 확장** — Juliet Test Suite 기반 고난도 케이스 추가
3. **세션 영속화** — agent session 저장/복원

---

## 세션 16 완료 (2026-04-02)

1. ~~**인수인계서(`README.md`) 갱신**~~ ✅ Phase 2 도구 6종, NDJSON 스트리밍, Evidence Sanitizer 반영
2. ~~**API 계약서 갱신**~~ ✅ `agentAudit.model_name`/`prompt_version`/`total_*_tokens` 필드 추가, health 예시 예산값 수정
3. ~~**기능 명세 갱신**~~ ✅ 도구 6종, 구현체 테이블, NDJSON, Sanitizer 섹션 추가
4. ~~**S4 하트비트 WR 처리**~~ ✅ S4 v0.9.0 구현 완료 → S3 stall 감지 + queued 처리 + failed 도구 caveats 구현
5. ~~**테스트 추가**~~ ✅ sast_tool 4개 신규 (queued, stall, progress, failed). 총 198 passed

## 다음 세션 목표 (세션 17)

### 즉시 처리

1. **RE100 재테스트** — 하트비트 고도화 + stall 감지 적용 후 4개 프로젝트 재실행. SAST 실패 3개(gateway, gateway-webserver, gateway-test) 성공 확인
2. **커밋 요청** — 세션 15 + 세션 16 전체 변경사항 (S2에 요청)

### 백로그

1. **S4 부분 빌드 활용 고도화**: `userEntries > 0`일 때 부분 compile_commands로 SAST 스캔 연계
2. **대규모 프로젝트 분석 최적화**: 463 소스급 프로젝트에서 Phase 1 데이터 크기 제어 (현재 100K+ 토큰 → MAX_STEPS 초과)
3. ~~**API 계약서 agentAudit 갱신**~~ ✅ **완료 (2026-04-02)**
4. ~~**evidence ref 환각 추가 개선**~~ ✅ **완료 (2026-03-31)**

### E2E 테스트 도구

- `scripts/e2e.sh` — 6개 모드 (build, analyze, poc, build-analyze, analyze-poc, all)
- 대상: S2가 `uploads/{projectId}/{subprojectId}/`에 격리한 서브프로젝트 경로
- 서브프로젝트는 **독립 빌드 가능**해야 함 (의존 헤더/라이브러리 포함 필수)

---

## 구현 로드맵

### 1단계: Task API 뼈대 — 완료

- task type enum + allowlist
- `POST /v1/tasks` 엔드포인트
- prompt registry + model profile registry
- schema/evidence validation + confidence calculator

### 2단계: 핵심 Task 구현 — 미착수

- static-explain, dynamic-annotate, report-draft (레거시 → S7 담당으로 이관됨)

### 3단계: Provenance / Audit / Trust — 완료

- provenance metadata (model_name, prompt_version)
- budget / timeout / cache
- input trust labeling, confidence 산출
- Phase 1 evidence refs 프롬프트 주입 + allowed_refs 연동
- evidence 검증 soft mode

### 4단계: Planner + Safety — 미착수

- test-plan-propose, static-cluster, safety/policy integration

### 5단계: Evaluation — 미착수

- evaluation harness, golden set 관리, regression 검증

---

## v2 추후 구현 사항

### 동적 분석: QEMU + GDB MCP (Phase 3)

정적 분석(Phase 1/2)이 발견한 취약점을 **동적으로 확인**하는 단계.

```
Phase 1 (결정론적)  →  "여기가 의심됨" (SAST finding)
Phase 2 (LLM 해석)  →  "이런 이유로 위험함" (상세 claim)
Phase 3 (GDB 확인)  →  "실제로 이 값이 들어옴. 확정." (동적 검증)
```

- QEMU user-mode: ARM 크로스컴파일 바이너리를 x86에서 실행
- GDB MCP 서버: debug.launch, breakpoint, continue, inspect, backtrace, terminate
- S6(Dynamic Analysis) 영역. S3는 Phase 3 오케스트레이션 담당.

### 동적 분석: 트래픽 주입 템플릿

PoC를 구조화된 실행 가능 템플릿으로 생성 (HTTP, gRPC, CAN, UDS, MQTT).

### 에이전트 메모리 고도화

- revision-aware 메모리 (commit/branch별 분리)
- diff 기반 변경 보고서 자동 생성
- 사용자 피드백(claim 승인/기각) → false positive 학습

### DPO 파인튜닝

AEGIS 분석 로그 축적 → DPO로 Qwen 122B 도메인 특화. S7 영역, S3는 학습 데이터 제공.

### AEGIS 분석 범위 (확정)

| IN-SCOPE | OUT-OF-SCOPE |
|----------|-------------|
| 바이너리 (소스→빌드→실행→내부 로직 검증) | 부채널 공격 (전력, 타이밍, EM) |
| 네트워크 (서비스 간 통신, 트래픽 주입, 프로토콜 퍼징) | 하드웨어 결함 주입 (voltage glitching) |
| | GPIO/SPI/I2C 런타임 분석 |
