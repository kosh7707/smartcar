# [S1 → S2] 프론트엔드 고도화를 위한 API 요청 모음

**날짜**: 2026-03-26
**발신**: S1 (Frontend + QA)
**수신**: S2 (AEGIS Core)

---

## 1. Finding 벌크 상태 변경 API (P0)

여러 Finding의 상태를 한 번에 변경하는 API가 필요합니다. 현재 개별 `PATCH /api/findings/:id/status`만 존재하여 10건 변경 시 10회 호출해야 합니다.

**제안 엔드포인트:**

```
PATCH /api/findings/bulk-status
Body: {
  findingIds: string[],
  status: FindingStatus,
  reason: string,
  actor?: string
}
Response: { success: true, data: { updated: number, failed: number } }
```

**사용처**: Finding 목록에서 체크박스 선택 → 일괄 상태 변경 (accepted_risk, false_positive 등)

---

## 2. 대시보드 서브프로젝트 상태 요약 (P1)

OverviewPage에 서브프로젝트 상태 집계를 표시하고 싶습니다.

**제안**: 기존 `GET /api/projects/:pid/overview` 응답에 추가

```json
{
  "targetSummary": {
    "total": 5,
    "ready": 3,
    "failed": 1,
    "running": 1,
    "discovered": 0
  }
}
```

또는 별도 엔드포인트 `GET /api/projects/:pid/targets/summary`도 가능.

---

## 3. 최근 활동 타임라인 API (P1)

대시보드에 최근 활동(Run 완료, Finding 상태 변경, Approval 결정, 파이프라인 완료 등)을 타임라인으로 표시하고 싶습니다.

**제안 엔드포인트:**

```
GET /api/projects/:pid/activity?limit=10
Response: {
  success: true,
  data: Array<{
    type: "run_completed" | "finding_status_changed" | "approval_decided" | "pipeline_completed" | "source_uploaded",
    timestamp: string,
    summary: string,
    metadata: Record<string, unknown>
  }>
}
```

**사용처**: Overview 대시보드 "최근 활동" 카드

---

## 4. Finding 검색/정렬 파라미터 확장 (P1)

현재 `GET /api/projects/:pid/findings`에 `status`, `severity`, `module` 필터만 있습니다. 추가 필요:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `q` | string | title 또는 location 텍스트 검색 |
| `sort` | `"severity"` \| `"createdAt"` \| `"location"` | 정렬 기준 (기본: severity) |
| `order` | `"asc"` \| `"desc"` | 정렬 방향 |
| `sourceType` | string | sourceType 필터 (agent, sast-tool 등) |

**사용처**: Finding 목록 필터 바 + 정렬 드롭다운

---

## 5. Approval 대기 카운트 API (P2)

사이드바에 대기 중인 Approval 카운트 뱃지를 표시하고 싶습니다.

**제안**: 기존 `GET /api/projects/:pid/approvals` 응답 활용 가능하나, 가볍게 카운트만 받는 엔드포인트가 있으면 좋습니다.

```
GET /api/projects/:pid/approvals/count
Response: { success: true, data: { pending: 2, total: 8 } }
```

또는 기존 API에 `?status=pending&countOnly=true` 쿼리 파라미터도 가능.

---

## 6. Finding fingerprint 이력 조회 (P2)

같은 fingerprint를 가진 이전 Finding 목록을 조회하여 "이 취약점은 N회 연속 발견됨" 등을 표시하고 싶습니다.

```
GET /api/findings/:id/history
Response: {
  success: true,
  data: Array<{
    findingId: string,
    runId: string,
    status: FindingStatus,
    createdAt: string
  }>
}
```

**사용처**: FindingDetailView에서 fingerprint 이력 표시

---

## 7. 서비스 상세 헬스 정보 (P3)

현재 `GET /health`는 각 서비스의 `status`만 반환합니다. 클릭 시 팝오버로 상세 정보를 보여주고 싶습니다.

**제안**: 기존 `/health` 응답의 각 서비스 `detail` 필드에 다음 포함:

```json
{
  "sastRunner": {
    "status": "ok",
    "detail": {
      "version": "0.2.0",
      "uptime": 3600,
      "lastRequestAt": "2026-03-26T10:00:00Z"
    }
  }
}
```

이미 포함되어 있다면 무시해 주세요.

---

## 우선순위 요약

| P0 | Finding 벌크 상태 변경 |
| P1 | 서브프로젝트 상태 요약, 활동 타임라인, Finding 검색/정렬 |
| P2 | Approval 카운트, fingerprint 이력 |
| P3 | 서비스 상세 헬스 |

편한 순서대로 처리해 주시면 S1에서 바로 UI 붙이겠습니다!
