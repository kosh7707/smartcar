# S3 로드맵

> 다음 작업 + 장기 계획. README에서 분리.

---

## 다음 세션 목표

### 백로그

1. **API 계약서 갱신**: `docs/api/analysis-agent-api.md`에 `audit.agentAudit.model_name`/`prompt_version` 필드 추가
2. **S4 부분 빌드 활용 고도화**: `userEntries > 0`일 때 부분 compile_commands로 SAST 스캔 연계
3. **대규모 프로젝트 분석 최적화**: 463 소스급 프로젝트에서 Phase 1 데이터 크기 제어 (현재 100K+ 토큰 → MAX_STEPS 초과)
4. **evidence ref 환각 추가 개선**: soft mode 경고 0건 달성 (Phase 1 refs 주입으로 v3→v4에서 confidence 0.57→0.76 개선, 경고 1건 잔존)

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
