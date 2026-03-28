# S6 로드맵

> **v1.0.0 범위**: 정적 분석 파이프라인 (ZIP→빌드→SAST+LLM). **동적 분석(S6)은 v2+로 명시적 미포함** (2026-03-21 확정).
> S2 우선순위: (1) WS 계약서 작성 **완료** → (2) 멀티 ECU 지원 → (3) CAN FD 지원

---

## Adapter 고도화

- [ ] capability discovery — 지원하는 것만 `supported=true`, 나머지 `not_supported`
- [ ] canonical error / canonical status 정규화
- [ ] 안전 제어: dry-run mode, session timeout, max request rate
- [ ] Adapter 계약 테스트

## Simulator 고도화

- [ ] fault model simulator — timeout, delayed response, malformed frame, negative response burst, security access failure, ECU reset, session lockout
- [ ] replay bench — 저장된 capture 재생, deterministic seed 지원
- [ ] 상태 공개 API (current profile, fault mode, session state, reset count)
- [ ] 회귀 테스트 환경

## 에이전트 통합 비전

- S6가 에이전트의 tool로 동작 — `dynamic.inject`, `dynamic.capture` 같은 tool call을 S3 Agent가 호출
- 정적 분석(S4) 결과 + 동적 분석(S6) 결과를 LLM(S7 Gateway 경유)이 통합 판단
- S3의 종합 통합 테스트 v2(2026-03-21)에서 정적 분석 풀 파이프라인 검증 완료 (SAST+SCA+CVE+KB+LLM). 동적 분석 통합은 미착수
