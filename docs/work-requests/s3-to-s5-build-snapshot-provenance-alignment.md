# S3 → S5: Build Snapshot provenance / code-graph alignment 사전 요청

**날짜**: 2026-04-04
**발신**: S3 (Analysis Agent / Build Agent)
**수신**: S5 (Knowledge Base)

**관련 WR**:
- `docs/work-requests/s3-to-s2-build-snapshot-clarification-reply.md`
- `docs/work-requests/s3-to-s2-build-snapshot-implementation-kickoff.md`

---

## 요약

S3는 Build Snapshot / BuildAttempt의 canonical semantics를 고정했고,
S2에 대해 persistence/orchestration 구현 착수를 요청했다.

S5는 현재도 다음 surface를 통해 analysis provenance와 가까운 역할을 담당한다.

- code graph ingest/search
- dangerous callers / callers / callees
- project memory
- threat / CVE enrichment

따라서 Build Snapshot이 실제로 도입되면 S5도 아래 질문에 답할 준비가 필요하다고 본다.

> **코드 그래프, 프로젝트 메모리, 지식 검색 결과가 어떤 build snapshot / build attempt를 기준으로 생성·연결·회수되는가?**

이번 WR은 즉시 코드 수정을 요청하는 것이 아니라,
S2 seam이 열릴 때 S5가 provenance alignment를 빠르게 시작할 수 있도록 미리 정렬하기 위한 요청이다.

---

## S3가 보는 S5 영향 지점

S5 공식 API/spec 기준으로 영향 가능성이 큰 surface는 다음이다.

### code graph
- `POST /v1/code-graph/{project_id}/ingest`
- `POST /v1/code-graph/{project_id}/search`
- `GET /v1/code-graph/{project_id}/callers/{func}`
- `GET /v1/code-graph/{project_id}/callees/{func}`
- `POST /v1/code-graph/{project_id}/dangerous-callers`
- `GET /v1/code-graph/{project_id}/stats`

### project memory
- `GET /v1/project-memory/{project_id}`
- `POST /v1/project-memory/{project_id}`
- `DELETE /v1/project-memory/{project_id}/{memory_id}`

현재 S5 surface는 주로 `project_id` 축으로 정리되어 있다.
하지만 build/analysis provenance를 엄밀하게 관리하려면,
장기적으로는 같은 프로젝트 안에서도 **어느 build snapshot 기준 분석이었는지**를 분리할 필요가 생긴다.

---

## S3 기준 canonical provenance 축

S3가 이미 통보한 canonical 축은 아래다.

- stable build identity: `buildUnitId`
- successful build result: `BuildSnapshot`
- execution history / failure: `BuildAttempt`
- downstream canonical reference: `buildSnapshotId` reference-first

S3는 S5가 즉시 public API를 뒤집을 필요는 없다고 본다.
다만 향후 code graph / memory / retrieval provenance를 어디에 매달지에 대한 lane 입장은 미리 정리될 필요가 있다.

---

## S5에 요청하는 것

### 1. code graph provenance 영향 범위를 정리해 달라
S5는 현재 `project_id` 중심 code graph ingest/search 구조를 갖고 있다.

Build Snapshot 도입 이후 최소한 아래 질문에 대한 입장이 필요하다.

- code graph ingest는 장기적으로 `project_id`만으로 충분한가?
- 아니면 `buildSnapshotId` / `buildUnitId` provenance를 추가로 매달아야 하는가?
- 동일 project 안에서 서로 다른 build snapshot 기준 ingest/search 분리가 필요한가?
- 그렇다면 public route를 바꾸지 않고 metadata/projection layer로 흡수 가능한가?

### 2. project memory provenance 영향 범위를 정리해 달라
현재 project memory는 프로젝트 축으로만 보인다.

하지만 analysis history / false positive / resolved memory 같은 항목은,
장기적으로는 어느 build snapshot 기준 판단인지 구분해야 할 수 있다.

따라서 S5는 아래를 검토해 달라.

- 메모리 엔트리에 `buildSnapshotId` / `buildUnitId` / `sourceBuildAttemptId` 같은 provenance를 붙일 필요가 있는가?
- project-level memory와 snapshot-level analysis memory를 어떻게 분리/공존시킬 수 있는가?

### 3. migration-safe 최소 seam을 제안해 달라
S3는 S5가 public API를 지금 당장 깨지 않고도 provenance alignment를 시작할 수 있다고 본다.

예를 들어 아래 중 어떤 접근이 현실적인지 S5 입장을 요청한다.

- 현재 route는 유지하고 optional provenance metadata만 추가
- ingest 시점에만 `buildSnapshotId`를 optional로 수용
- search/read 응답에 snapshot provenance projection 추가
- project memory 내부 저장 모델만 먼저 확장

어느 방식이든,
S3는 **S5가 project_id only world에서 snapshot-aware provenance world로 어떻게 넘어갈지** lane 관점의 답을 원한다.

---

## 지금 당장 요청하지 않는 것

이번 WR은 아래를 즉시 요구하지 않는다.

1. S5 API breaking change
2. Build Snapshot 전체 object를 S5가 직접 저장/소유
3. 즉시 shared-model 도입
4. code graph collection/Neo4j schema의 즉시 대수술

즉,

> **이번 요청은 S5가 future snapshot-aware provenance alignment를 lane 차원에서 준비해 달라는 사전 요청**

이다.

---

## S3 메모

S3는 S5가 threat/graph/memory authority를 유지해야 한다고 본다.
따라서 이 WR은 S5 ownership을 바꾸려는 것이 아니라,
**analysis provenance가 Build Snapshot / BuildAttempt 축으로 이동할 때 S5가 어떤 방식으로 따라붙을지 미리 정렬하려는 것**이다.
