# [S2 → S1] 세션 11 변경사항 통보

**날짜**: 2026-03-27
**발신**: S2 (AEGIS Core)
**수신**: S1 (Frontend + QA)

---

## 1. S1 요청 API 7건 — 전부 구현 완료 + 테스트 48개

### 신규 엔드포인트

| 엔드포인트 | 설명 | DTO |
|-----------|------|-----|
| `PATCH /api/findings/bulk-status` | Finding 벌크 상태 변경 (최대 100건) | `FindingBulkStatusRequest` → `{ updated, failed }` |
| `GET /api/findings/:id/history` | fingerprint 기반 이력 | `FindingHistoryEntry[]` |
| `GET /api/projects/:pid/activity?limit=10` | 최근 활동 타임라인 (4개 소스 병합) | `ActivityEntry[]` |
| `GET /api/projects/:pid/approvals/count` | Approval 카운트 (사이드바 뱃지용) | `ApprovalCountResponse` |

### 기존 엔드포인트 확장

| 엔드포인트 | 변경 |
|-----------|------|
| `GET /api/projects/:pid/findings` | 쿼리 파라미터 추가: `q`(텍스트 검색), `sort`(severity/createdAt/location), `order`(asc/desc), `sourceType` |
| `GET /api/projects/:pid/overview` | `targetSummary` 필드 추가: `{ total, ready, failed, running, discovered }` |
| `GET /health` | `detail: { version, uptime }` 추가. `status`는 기존 `"ok" \| "degraded" \| "unhealthy"` 유지 |

---

## 2. QA 피드백 3건 — 전부 구현 완료

### SDK ID "none" + 등록 SDK 수용

`buildProfile.sdkId`에 다음 값을 전달할 수 있습니다:
- `"none"` — SDK 미사용 (최소 프로파일, includePaths/defines/flags 없음)
- `"sdk-*"` — 등록 SDK ID (sdk_registry에서 조회, status=ready이면 프로파일 자동 적용)
- 기존 하드코딩 ID (`"ti-am335x"` 등) — 기존 동작 유지
- `"custom"` — 기본값

### 분석 모드 분리

`POST /api/analysis/run` body에 `mode` 파라미터 추가:

```json
{
  "projectId": "...",
  "mode": "full" | "subproject",
  "targetIds": ["target-1"]
}
```

- `"full"`: 전체 소스 분석. `targetIds` 있으면 400
- `"subproject"`: 선택 타겟만. `targetIds` 필수
- 생략 시 기존 동작 유지 (하위 호환)

DTO: `AnalysisRunRequest` (`@aegis/shared`)

### 헬스체크

변경 없음. S1이 `status` 필드만 읽는 현재 방식이 정확합니다.

---

## 3. shared DTO 변경 (`@aegis/shared`)

신규/수정된 타입:

| 타입 | 위치 |
|------|------|
| `FindingBulkStatusRequest` | `dto.ts` |
| `FindingHistoryEntry` | `dto.ts` |
| `ActivityEntry`, `ActivityType` | `dto.ts` |
| `AnalysisRunRequest` | `dto.ts` |
| `ApprovalCountResponse` | `dto.ts` |
| `ServiceHealth`, `HealthResponse` (확장) | `dto.ts` |
| `ProjectOverviewResponse.targetSummary` | `dto.ts` |

---

## 4. shared-models.md 갱신 완료

위 모든 변경이 `docs/api/shared-models.md`에 반영되어 있습니다.

처리 완료 후 이 문서를 삭제해주세요.
