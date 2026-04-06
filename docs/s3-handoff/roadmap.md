# S3 로드맵

> 다음 작업 + 장기 계획. README에서 분리.

---

## 세션 18 완료 (2026-04-04)

1. ~~**Residual alignment 1차 정리**~~ ✅ Analysis Agent legacy taskType router 차단, Build Agent `promptVersion` 정렬, `sdk-analyze` 문서 반영
2. ~~**공용 `.omx` 메모 규칙 반영**~~ ✅ `docs/AEGIS.md` / `s2-to-all` WR 확인 후 S3 handoff에 lane 전용 메모 분리 원칙 반영



## 세션 25 완료 (2026-04-04)

1. ~~**S4 v0.11 build-path 대응**~~ ✅ explicit `buildCommand` / `buildEnvironment` / `provenance` 기반으로 S3 build path 적응
2. ~~**S5 readiness/provenance 대응**~~ ✅ `KB_NOT_READY` 명시 처리 + provenance seam pass-through 준비
3. ~~**RE100 4/4 build-resolve 검증**~~ ✅ `certificate-maker`, `gateway`, `gateway-webserver`, `gateway-test` direct endpoint-driven 검증 완료
4. ~~**build-script hint field 도입**~~ ✅ optional / text-only / reference-only / direct execution 금지 semantics 반영

## 다음 세션 목표 (세션 26)

### 즉시 처리

1. **S2 gate reopen 여부 결정** — Build Snapshot / BuildAttempt implementation-open signal 발행 여부 판단
2. **RE100 analysis 확장 여부 결정** — `deep-analyze`/PoC까지 같은 기준으로 확대 검증할지 판단
3. **gateway-test hint guidance 정리** — 최소 caller hint 기준과 문서화 여부 결정

### 백로그

1. **Build Agent 프로세스 격리** — bash 실행 namespace 격리
2. **Build Snapshot public surface / shared model 승격 시점 결정**
3. **analysis boundary 문서화 추가 정리** — snapshot/reference-first 관점 후속 반영 여부 판단

## 세션 24 완료 (2026-04-04)

1. ~~**S2/S4/S5 회신 처리**~~ ✅ Build Snapshot 후속 WR 회신 읽고 핵심 결론을 handoff로 흡수
2. ~~**WR cleanup 반영**~~ ✅ 처리 완료된 Build Snapshot / contract WR 묶음을 삭제 대상으로 정리
3. ~~**새 blocker 식별**~~ ✅ S4 `/v1` build path inversion(v0.11.0)과 S5 Neo4j-required readiness를 차기 핵심 작업으로 승격

## 세션 23 완료 (2026-04-04)

1. ~~**downstream WR completion**~~ ✅ S2 구현 착수 요청, S4 consumer alignment 요청, S5 provenance alignment 요청 발행
2. ~~**S3-first coordination backlog 정리**~~ ✅ Build Snapshot / BuildAttempt 후속 액션을 recipient별 ownership으로 분리
3. ~~**handoff 업데이트**~~ ✅ 세션 23 로그 + 로드맵에 outbound WR 상태 반영

## 세션 22 완료 (2026-04-04)

1. ~~**strict compile-first canonical surface 정리**~~ ✅ `subprojectPath/subprojectName`, `build-resolve-v1`, nested `build.mode`/`build.sdkId` 기준으로 docs/runtime/tests를 재정렬
2. ~~**result semantics 노출 보강**~~ ✅ `contractVersion`, `strictMode`, `declaredMode`, `sdkId`가 response/result에서 일관되게 드러나도록 보강
3. ~~**S3-owned harness/docs drift 제거**~~ ✅ build/analyze harness 예시와 API/spec failure terminology를 현재 런타임 기준으로 정렬

## 세션 21 완료 (2026-04-04)

1. ~~**S2 재질의 검토**~~ ✅ stable identity / reference-first / schema+lineage / failure semantics 기준으로 쟁점 재구성
2. ~~**S3 authoritative reply 작성**~~ ✅ `s3-to-s2-build-snapshot-clarification-reply.md` 작성
3. ~~**BuildSnapshot semantics 고정**~~ ✅ `buildUnitId`, `buildSnapshotId`, BuildAttempt/BuildSnapshot 분리, reference-first 방향 명시

## 세션 20 완료 (2026-04-04)

1. ~~**strict compile-first team execution**~~ ✅ build contract/request/result/tests lanes 병렬 정리 후 종료
2. ~~**S2 handoff planning**~~ ✅ build user flow + persistent Build Snapshot 방향으로 consensus planning 완료
3. ~~**S2용 WR 초안 작성**~~ ✅ `s3-to-s2-build-snapshot-contract-handoff.md` 작성

## 다음 세션 목표 (세션 21)

### 즉시 처리

1. **S2 회신 대기/반영** — Build Snapshot을 coordination artifact로 둘지, 즉시 persistence object로 둘지 확인
2. **S3 docs 2차 정리** — analysis-agent 쪽에도 Build Snapshot boundary를 반영할지 결정
3. **Ralph 통합 검증** — strict compile-first 변경분 전체 회귀 검증 + architect sign-off

### 백로그

1. **Build Agent 프로세스 격리** — bash 실행 namespace 격리
2. **gateway / gateway-webserver 재검증** — 새 계약 기준 live build stress test
3. **Build Snapshot public surface화 여부 결정**

## 세션 19 완료 (2026-04-04)

1. ~~**S3 agent integration live 검증**~~ ✅ `build-resolve`, `deep-analyze`, `generate-poc`, `sdk-analyze` 실제 기동 상태 점검
2. ~~**sdk-analyze live 안정화**~~ ✅ deterministic shortcut + prompt/tool 개선으로 `sdk-live-20260404-7` completed
3. ~~**S4 경고 분리**~~ ✅ `exitCode=127` / 대형 스캔 stall 이슈를 WR로 분리

## 다음 세션 목표 (세션 20)

### 즉시 처리

1. **S4 WR 응답 추적** — SDK build `exitCode=127`, large scan stall 대응 여부 확인
2. **certificate-maker 기준 재스모크** — S4 회신 전후로 build/analyze/poc 최소 경로 재검증
3. **sdk-analyze 품질 보강 여부 판단** — `gccVersion`/`sysroot` 정확도 추가 개선이 필요한지 결정

### 백로그

1. **`_pipeline` 잔재 제거 여부 결정** — `services/analysis-agent/app/routers/tasks.py` legacy plumbing 축소
2. **Build Agent 프로세스 격리** — bash 실행 namespace 격리
3. **골든셋 확장** — Juliet Test Suite 기반 고난도 케이스 추가
4. **세션 영속화** — agent session 저장/복원

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
