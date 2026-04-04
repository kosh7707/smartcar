# S5 → S3: threat search readiness hardening + provenance seam 반영 알림

**날짜**: 2026-04-04
**발신**: S5 (Knowledge Base)
**수신**: S3 (Analysis Agent / Build Agent)

**관련 WR**:
- `docs/work-requests/s3-to-s5-build-snapshot-provenance-alignment.md`

---

## 요약

S5가 아래 두 가지를 반영했다.

1. **threat search degraded fallback 제거**
2. **code graph / project memory provenance seam 추가**

즉,
- 이제 threat search는 **Neo4j 필수**다.
- 동시에 S3가 요청한 `buildSnapshotId` / `buildUnitId` / `sourceBuildAttemptId` metadata seam은 최소 범위로 수용했다.

---

## 1. threat search readiness 변경

이전:
- Neo4j down + Qdrant up 이면 `/v1/search`, `/v1/search/batch`가 `200` + degraded 의미로 동작 가능했음

현재:
- Neo4j가 없으면 `/v1/search`, `/v1/search/batch`도 **`503 KB_NOT_READY`**
- `/v1/ready`와 request-time semantics를 일치시킴
- success payload의 `degraded` 의미는 제거됨

### S3 영향

S3는 이제 threat search 호출 전에,
기존보다 더 강하게 **S5 ready / Neo4j availability 전제**를 가져야 한다.

즉,
> "그래프 없이도 일단 vector-only로 검색한다"는 가정을 두면 안 된다.

---

## 2. provenance seam 추가

S3 요청에 따라 아래 optional provenance 메타데이터를 S5 surface에 추가했다.

- `buildSnapshotId`
- `buildUnitId`
- `sourceBuildAttemptId`

### code graph

추가/수용 지점:
- `POST /v1/code-graph/{project_id}/ingest`
- `POST /v1/code-graph/{project_id}/search`
- `GET /v1/code-graph/{project_id}/stats`
- `GET /v1/code-graph/{project_id}/callers/{function_name}`
- `GET /v1/code-graph/{project_id}/callees/{function_name}`
- `POST /v1/code-graph/{project_id}/dangerous-callers`

반영 내용:
- ingest 시 optional provenance metadata 수용
- search/read 응답에 provenance projection 포함 가능
- search/read에 optional `buildSnapshotId` filter 지원

### project memory

추가/수용 지점:
- `GET /v1/project-memory/{project_id}`
- `POST /v1/project-memory/{project_id}`

반영 내용:
- create 시 optional provenance metadata 수용
- list 시 optional provenance filter 지원
- memory 응답에 provenance projection 포함 가능
- dedup hash에 provenance를 포함하므로, **같은 data라도 provenance가 다르면 별도 메모리로 취급**됨

---

## 3. 현재 seam의 범위

중요:

> 이번 반영은 **future snapshot-aware alignment를 위한 최소 seam**이지,
> S5가 이미 동일 project 안에 여러 build snapshot graph를 동시 보존/선택하는 완전한 모델로 바뀌었다는 뜻은 아니다.

현재 code graph는 여전히:
- **프로젝트당 활성 그래프 1개** 모델
- ingest 시 기존 project graph를 재생성

즉 provenance는 현재 단계에서:
- metadata 저장
- 응답 projection
- filter seam
을 제공하지만,
**multi-snapshot coexistence 자체를 완성한 것은 아님**.

---

## 4. S3에 권장하는 다음 액션

1. code graph ingest 호출 시 provenance metadata를 optional로 붙이기 시작
2. code graph search/read에서 가능하면 `buildSnapshotId`를 명시해 future migration path를 고정
3. project memory 기록 시 snapshot-scoped 판단이면 provenance를 같이 저장
4. threat search는 더 이상 degraded fallback을 기대하지 말고, `503 KB_NOT_READY`를 명시적 not-ready로 처리

---

## 5. 계약 문서

자세한 public contract는 아래 문서에 반영했다.

- `docs/api/knowledge-base-api.md`

필요하면 S3 관점에서 원하는 다음 단계(예: multi-snapshot coexistence, stricter snapshot filtering semantics)를 다시 WR로 보내 달라.
