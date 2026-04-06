# S3 세션 24 — 2026-04-04

## 세션 요약

S2, S4, S5로부터 Build Snapshot 후속 WR 회신을 읽고 처리한 뒤,
`docs/work-requests/` 정리 규칙에 따라 **처리 완료된 WR들을 삭제**했다.

이번 세션의 핵심은 아래 3가지다.

1. **S2 게이트 확정**
   - S2는 Build Snapshot / BuildAttempt semantics를 수용했다.
   - 다만 실제 persistence/orchestration 구현은
     - S3 agent integration 종료
     - RE100 gateway / gateway-webserver 재검증 종료
     이후 시작하겠다고 회신했다.

2. **S4 breaking change 수신**
   - SAST Runner `/v1` contract v0.11.0 기준,
   - build path는 이제 execution-only다.
   - 즉:
     - `sdkId` 제거
     - `buildCommand` 자동 감지 제거
     - `buildCommand` 필수
     - `buildEnvironment` explicit input 도입
     - `/v1/sdk-registry` public API 제거
   - 이 변화는 현재 S3 build-resolve / try_build integration 가정에 직접 영향을 준다.

3. **S5 readiness / provenance seam 수신**
   - threat search는 이제 Neo4j 필수이며 degraded fallback이 제거되었다.
   - 동시에 S5는 아래 provenance seam을 optional metadata로 수용했다.
     - `buildSnapshotId`
     - `buildUnitId`
     - `sourceBuildAttemptId`
   - code-graph / project-memory surface에 future snapshot-aware alignment seam이 열렸다.

---

## 수신 WR 핵심 결론

### S2
- semantics/readiness는 수용
- implementation start는 **게이트 후**
- 즉, S3가 먼저 integration / RE100 live loop를 닫아야 함

### S4
- build path contract가 바뀜
- 앞으로 S3는 S4 build path 호출 시:
  - `buildCommand`를 명시
  - 필요한 env/toolchain/path material을 caller 쪽에서 완전히 결정
  - SDK metadata를 S4가 아니라 upstream(S2)에서 받는 구조로 가야 함
- build failure는 이제 caller-material fault를 포함한 explicit failure로 읽어야 함

### S5
- search는 Neo4j 없으면 `503 KB_NOT_READY`
- vector-only degraded fallback 가정 금지
- provenance seam은 열렸지만 multi-snapshot coexistence가 완성된 건 아님

---

## WR 정리 규칙 반영

규칙:
- **WR은 받은 쪽이 읽고 처리하면 삭제**

이번 세션에서 S3는 아래 WR들을 읽고/처리했고,
핵심 내용은 이 세션 로그와 로드맵에 흡수했다.
따라서 관련 WR 파일은 삭제했다.

### 처리 완료된 Build Snapshot / contract WR 묶음
- S2 ↔ S3 build snapshot clarification / variant / kickoff chain
- S4 ↔ S3 consumer alignment / degraded behavior / boundary inversion chain
- S5 ↔ S3 provenance alignment / readiness update chain
- S3 → S4 과거 build-path 관련 이슈 WR 묶음 (현 contract inversion 공지로 superseded)

---

## 남은 후속 과제

1. **S4 v0.11 build contract 대응**
   - S3 build-resolve / try_build / SDK materialization 설계 수정 필요

2. **S5 readiness 처리 강화**
   - threat search 호출 전 Neo4j-ready 전제 강화
   - provenance seam 사용 시점 결정

3. **S2 게이트 해소**
   - agent integration 종료
   - RE100 live 재검증 종료
   - 그 뒤 implementation-open signal 재통보
