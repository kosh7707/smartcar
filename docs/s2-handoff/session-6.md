# 세션 6 — BuildTarget + PoC + 코드 점검

**날짜**: 2026-03-21

---

- v1.0.0 방향 확정: "프로젝트를 올리면 빌드하고 정적 분석한다"
- **BuildTarget 엔티티 도입**: 프로젝트 내 다중 빌드 단위 (DB + DAO + Service + Controller)
  - 5개 API: `/api/projects/:pid/targets` (CRUD + discover)
  - Orchestrator 타겟별 순차 Quick→Deep 루프
  - WsAnalysisProgress에 targetName/targetProgress 추가
  - shared 타입: `BuildTarget` 인터페이스
- **claim.detail 관통**: Agent claim 상세 분석 필드 → Finding.detail → S1
  - DB 마이그레이션: `findings.detail TEXT`
  - AgentClaim.detail, ResultNormalizer, Orchestrator 관통
- **PoC 생성 API**: `POST /api/analysis/poc { projectId, findingId }`
  - AgentClient에 `generate-poc` taskType 추가
  - Finding → claim 추출 → 소스코드 첨부 → S3 호출 → PoC 반환
- **코드 점검 수정 3건**:
  1. PoC 엔드포인트 claims[0] 바운드 체크 추가
  2. location split 형식 검증 (lastIndexOf 사용)
  3. BuildTarget relativePath `..` 트래버설 방지
- **계약서 갱신**: shared-models.md — AnalysisModule(+deep_analysis), FindingSourceType(+agent, sast-tool), ArtifactType(+agent-assessment), Finding.detail, Vulnerability.detail, BuildTarget
- **technical-overview.md 전면 개편**: 4-서비스→7인 체제, 분석 범위 정의(IN/OUT-OF-SCOPE, QEMU), Quick→Deep 플로우
- S1 WR: claim.detail 렌더링 + PoC 버튼 UI
- **상태: TypeScript 0에러, 테스트 133개 통과, E2E 통합 테스트 대기 (S3 고도화 중)**
