# 세션 11 — S1 요청 API 10건 + 테스트 + MCP + S4 동기화

**날짜**: 2026-03-26

---

- **S1 요청 API 7건 구현**:
  1. `PATCH /api/findings/bulk-status` — 벌크 상태 변경 (최대 100건, 트랜잭션)
  2. `GET /api/findings/:id/history` — Finding fingerprint 이력
  3. `GET /api/projects/:pid/activity` — 프로젝트 활동 타임라인 (4소스 병합)
  4. `GET /api/projects/:pid/approvals/count` — Approval 카운트 (pending/total)
  5. Finding 목록 확장 쿼리: `q`(검색), `sourceType`, `sort`, `order`
  6. Overview에 `targetSummary` 추가 (서브프로젝트 상태 집계)
  7. Health에 `detail` 필드 추가
- **QA 피드백 3건 처리**: SDK ID `"none"` 지원, 분석 모드 분리(`full`/`subproject`), runId 쿼리
- **신규 서비스**: `ActivityService`, `FindingService.bulkUpdateStatus/getHistory`
- **DAO 확장**: `IFindingDAO`(+findByIds, findAllByFingerprint, withTransaction), `IAuditLogDAO`(+findFindingStatusChanges, findApprovalDecisions)
- **테스트 65개 추가** (202→267): ActivityService, Finding bulk/history, Approval count, 쿼리 확장
- **MCP log-analyzer 고도화 6건**: trace 워터폴, full-text 검색, LLM 전용 통계, 턴별 토큰 추적
- **shared-models.md 대규모 갱신**: FindingBulkStatusRequest, FindingHistoryEntry, ActivityEntry, ApprovalCountResponse, AnalysisRunRequest.mode 등
- **S4 v0.7.0 동기화**: build-agent-api.md 반영 (resolve confidence/buildCommand)
- **S1 WR 발송**: 세션 11 변경 사항 통보 (`s2-to-s1-session11-changes.md`)
- **상태: TypeScript 9에러 (stale dist + mock 누락), 테스트 267개 통과**
