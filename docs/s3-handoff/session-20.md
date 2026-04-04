# S3 세션 20 — 2026-04-04

## 세션 요약

strict compile-first 구현/검증 이후, S2와의 다음 계약을 "단순 build-resolve payload 수정"이 아니라 **전체 build user flow + persistent Build Snapshot handoff** 문제로 재정의했다.

이번 세션에서는 deep-interview와 ralplan을 통해 S2-facing 범위를 명확히 한 뒤, 실제 전달용 WR 초안을 작성했다.

---

## 핵심 합의

### 1. S2에 넘길 범위는 request payload 한 조각이 아니다

다음 전체 유즈케이스를 계약 대상으로 본다.

1. SDK / project asset 등록
2. 서브프로젝트 선택
3. explicit build mode 선언 (`native` / `sdk`)
4. strict compile-first build 실행
5. Build Snapshot 영속 저장
6. 이후 S4 / Analysis Agent가 Build Snapshot 기준으로 분석 시작

### 2. Build와 Analysis는 분리된 lifecycle stage다

- UX 상 이어질 수는 있음
- 그러나 계약/증적 관점에서는:
  - **Build stage 완료 → Build Snapshot persisted**
  - **Analysis stage 시작 → Build Snapshot ID/object 소비**

### 3. Build Snapshot은 persistent first-class object여야 한다

ephemeral build response를 다음 단계가 그대로 이어받는 방식은 지양한다.

Build Snapshot 최소 필드 합의:
- declared subproject
- declared build mode
- declared sdkId / native mode
- actual build command/path
- produced artifacts
- included third-party inventory/version metadata
- compile_commands handoff location 또는 동등한 build evidence 위치
- build success/failure metadata

---

## 이번 세션 산출물

### 1. context / spec / plan
- `.omx/context/s2-build-contract-handoff-20260404T060110Z.md`
- `.omx/interviews/s2-build-contract-handoff-20260404T060110Z.md`
- `.omx/specs/deep-interview-s2-build-contract-handoff.md`
- `.omx/plans/prd-s2-build-contract-handoff.md`
- `.omx/plans/test-spec-s2-build-contract-handoff.md`
- `.omx/plans/s2-build-contract-handoff.md`

### 2. S2용 WR 초안
- `docs/work-requests/s3-to-s2-build-snapshot-contract-handoff.md`

이 WR은 다음을 제안한다.
- S2는 전체 build user flow를 오케스트레이션한다.
- Build Snapshot을 persistent first-class object로 둔다.
- 이후 분석은 Build Snapshot 기준으로 시작한다.
- phased adoption:
  1. coordination artifact 정의
  2. S2 persistence/reference semantics 도입
  3. Analysis/S4가 canonical handoff object로 소비

### 3. handoff roadmap 반영
- `docs/s3-handoff/roadmap.md`
  - 세션 20 완료 항목 추가
  - 다음 세션 목표를 S2 회신/Build Snapshot 반영 중심으로 업데이트

---

## 검증 / 리뷰 상태

### deep-interview
- ambiguity: `0.11`
- threshold: `0.20`
- gate 충족:
  - non-goals explicit
  - decision boundaries explicit
  - pressure pass complete

### ralplan consensus
- Architect: **APPROVE**
- Critic: **APPROVE**
- Consensus: **APPROVED**

architect/critic에서 확정된 추가 watchpoint:
1. Build Snapshot을 coordination artifact로 먼저 둘지, public API object로 바로 승격할지 초기에 명시
2. minimum required vs optional enrichment 필드 분리
3. analysis가 transient build response가 아니라 Build Snapshot ID/object를 소비한다는 점을 이후 docs/API에 일관되게 반영

---

## 남은 후속 과제

1. **S2 회신 대기/반영**
   - coordination artifact 우선인지
   - 즉시 persistence object화인지
   - migration path를 어떻게 둘지

2. **S3 docs 2차 정리**
   - analysis-agent 쪽 API/spec에도 Build Snapshot boundary를 반영할지 결정

3. **strict compile-first 전체 Ralph 검증**
   - 팀 머지 결과 + docs/WR까지 포함한 최종 회귀 검증

4. **RE100 gateway / gateway-webserver 재검증**
   - 새 strict contract 기준으로 live stress path 재도전
