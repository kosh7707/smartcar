# S2 개발 로드맵

> 즉시 다음 작업 + 후순위 + 인프라 계획
> 진입점: `README.md` → 필요 시 이 문서 참조

---

## 10. 알려진 이슈 / 로드맵 / 세션 로그

### 대기 중인 작업 요청 (2026-04-04 종료 시점 기준)

- 현재 WR 폴더에는 **Build Snapshot / BuildAttempt 계약 협의 묶음**이 S2의 다음 판단 재료로 남아 있다.
  - inbound:
    - `s3-to-s2-build-snapshot-contract-handoff.md`
    - `s3-to-s2-build-snapshot-implementation-kickoff.md`
    - `s3-to-s2-build-snapshot-clarification-reply.md`
    - `s3-to-s2-build-snapshot-usecase-variants.md`
  - outbound:
    - `s2-to-s3-build-snapshot-contract-clarification.md`
    - `s2-to-s3-build-snapshot-variant-feedback.md`
    - `s2-to-s3-build-snapshot-implementation-gating-response.md`
- S1 관련 계약 WR:
  - `s2-to-s1-backend-contract-alignment.md`
  - `s2-to-s1-contract-lockdown-fyi.md`
- 전역 운영 WR:
  - `s2-to-all-omx-memory-discipline.md`
- `s3-to-s3-prompt-enhancement-backlog.md` 는 여전히 **S3 내부 백로그**이며 S2 직접 액션 대상은 아니다.

### 세션 13 완료 사항 (2026-03-28)

- DB `rules` 테이블 + 마이그레이션 + 인덱스 완전 제거 (19→18 테이블)
- CREATE TABLE에 최종 컬럼 통합 (가독성 향상, ALTER TABLE은 레거시 호환용 유지)
- 공유 패키지: `Rule`, `RuleCreateRequest/UpdateRequest/Response/ListResponse` 타입 제거
- `LlmV1Adapter` 제거 → `LlmTaskClient`에 concurrency queue 통합, Dynamic 서비스 직접 사용
- `MockEcu` 제거 → 인터페이스를 `adapter-client.ts`로 인라인
- `IRuleDAO`, `makeRule()`, 빈 `rules/` 디렉토리, stale dist 산출물 제거
- `db-stats.sh` 전면 갱신 (9→18 테이블 조회) — 현재는 세션 14 이후 21테이블 체계로 다시 동기화 완료
- S3 통합 테스트 완료 대응: 파이프라인 격리 경로(`target.sourcePath`) 사용, Build Agent 경로 수정, 부분 빌드 처리, PoC에 `projectPath` 추가
- log-analyzer 토큰 절감 (메시지 축약, 중복 그룹핑, max_lines)

### 세션 14 완료 사항 (2026-04-01)

S1-QA 보안 분석가 UX 리뷰 WR 전면 처리 (11 Phase):
- Finding CWE/CVE 매핑 + confidenceScore 수치 추가
- 빌드 로그 조회 API (GET /targets/:id/build-log)
- 프로젝트 목록 보안 요약 (ProjectListItem + severity/gate/delta)
- Overview 트렌드/델타 (newFindings, resolvedFindings, unresolvedTotal)
- Gate 프로필 시스템 (3 프리셋: default/strict/relaxed)
- 프로젝트 설정 확장 (gateProfileId, analysisPolicy)
- Finding 그루핑 API (ruleId/location 기준)
- 보고서 커스터마이징 (POST /report/custom)
- 알림 시스템 (4개 REST + WS + 4개 트리거)
- 사용자/역할 시스템 (soft auth, admin 시딩)
- DB 18→21 테이블, 테스트 267→322개

### 세션 15 완료 사항 (2026-04-04)

S1↔S2 계약 drift를 backend-side에서 회귀 고정:
- `PUT /api/projects/:pid/targets/:id` 의 `includedPaths` silent ignore 제거
  - 현재 semantics: `400` + `errorDetail.code = "INVALID_INPUT"`
- backend contract test 확장:
  - `POST /api/projects/:pid/targets/discover`
  - `GET /api/projects/:pid/sdk`
  - `GET /api/projects/:pid/sdk/:id`
  - `POST /api/projects/:pid/sdk`
  - `POST /api/projects/:pid/pipeline/run/:targetId`
  - `GET /api/projects/:pid/pipeline/status` optional field assertions
- contract test harness 보강:
  - `/api/projects/:pid/sdk` mount
  - discover용 `sourceService` / `sastClient` test double
  - rerun용 `pipelineOrchestrator` test double
- canonical docs 정렬:
  - `docs/api/shared-models.md`
  - `docs/specs/backend.md`
- S1 FYI WR 발행:
  - `s2-to-s1-contract-lockdown-fyi.md`
- 검증:
  - contract suite `73 passed`
  - full backend suite `330 passed`
  - backend/shared typecheck 통과
- 관련 커밋:
  - `ca11063` — implicit contract drift 방지
  - `c12aeac` — backend spec에 locked semantics 반영

### DB hot-reload 함정

서버가 `tsx watch`로 실행 중일 때 `aegis.db`를 삭제하면 0바이트 파일이 되고 테이블이 생성되지 않는다. 반드시 서버 프로세스를 종료 -> DB 삭제 -> 서버 재시작 순서로 진행할 것.

### shared 타입 변경 시

`@aegis/shared`는 S2가 단독 소유한다. 변경 시 `docs/api/shared-models.md`를 같이 업데이트하고, S1에게 work-request로 통보한다. DB 컬럼명(snake_case)과 TypeScript 필드명(camelCase) 변환은 DAO의 `rowTo*()` 함수에서 수동으로 한다.

### 마이그레이션 순서

`db.ts`에서 인덱스 생성은 반드시 ALTER TABLE 마이그레이션 **이후**에 해야 한다. 이 순서를 어기면 기존 DB에서 "no such column" 에러로 서버가 크래시 루프에 빠진다.

---

## 11. 개발 로드맵

### 기존 파이프라인: 구현 완료

정적 분석, 동적 분석, 동적 테스트(퍼징/침투), 프로젝트 CRUD/Overview, 프로젝트 스코프 어댑터/설정 CRUD, BuildProfile/SDK 프로파일 모두 완료.

### 코어 도메인 (1~3단계): 구현 완료

- Run, Finding (7-state 라이프사이클), EvidenceRef, AuditLog
- ResultNormalizer (3개 파이프라인 통합)
- Quality Gate, Approval, Report

### 테스트 인프라: 구현 완료

vitest 기반 테스트 330개. `cd services/backend && npx vitest run`으로 실행.

```
src/
├── test/
│   ├── test-db.ts               # 인메모리 SQLite (테스트용)
│   ├── create-test-app.ts       # Express + 전체 DI 구성 (API 계약 테스트용)
│   └── factories.ts             # 팩토리 함수 (makeProject, makeRun, makeFinding, ...)
├── __tests__/
│   ├── contract/api-contract.test.ts        # API 엔드포인트 계약 테스트 (supertest)
│   └── integration/
│       ├── dao.integration.test.ts          # DAO 레이어 통합 테스트
│       └── service.integration.test.ts      # 서비스 파이프라인 통합 테스트
├── services/__tests__/
│   ├── result-normalizer.test.ts            # ResultNormalizer 단위 테스트
│   ├── finding.service.test.ts              # Finding 라이프사이클 테스트
│   └── ... (서비스별 단위 테스트)
├── dao/__tests__/                            # DAO 단위 테스트
└── lib/__tests__/
    └── vulnerability-utils.test.ts          # mergeAndDedup 등 유틸 테스트
```

### 즉시 다음 작업 (Next S2 Session)

1. **Build Snapshot / BuildAttempt 협의 상태 재평가**
   - `docs/work-requests/s3-to-s2-build-snapshot-*.md`
   - `docs/work-requests/s2-to-s3-build-snapshot-*.md`
   - 현재 기준 S2 입장은 “kickoff 수용, 실제 구현 착수는 게이트 이후”
2. **E2E 풀스택 통합 테스트**
   - 전체 파이프라인 (업로드→서브프로젝트→빌드→스캔→Deep) 검증
   - 단, 사용자 허가 없는 start script 실행 금지 원칙 유지

### 후순위

- `source.get_span` API — 소스 파일 특정 범위 반환 (S3 Agent tool)
- Overview에 `deep_analysis` 모듈 집계 추가 (project.service.ts)
- 사용자 인증 강화: AUTH_REQUIRED=true 모드 + RBAC 적용 (soft auth 구현 완료, S1 로그인 UI 대기)
- Build Snapshot / BuildAttempt persistence seam
  - `BuildTarget` provenance → snapshot/attempt canonical object로의 migration plan 수립
  - 게이트 전에는 설계/메모 수준으로만 유지

### 인프라 로드맵 (v1.0.0 이후)

**현재**: WSL2 단일 머신 + DGX Spark. 서비스 7개 직접 실행 (`scripts/start.sh`).

**단기 — Docker화** (v1.0.0 태그 이후 검토):
- `docker-compose.yml`로 7개 서비스 + Neo4j + Qdrant 일괄 기동
- 소스코드/SDK는 공유 볼륨(`uploads:`)으로 S2/S3/S4 간 공유
- config.ts 환경변수가 이미 외부 주입 가능 → localhost를 컨테이너 DNS(`http://sast-runner:9000`)로 교체만 하면 됨
- 서비스별 `Dockerfile` 추가 필요, 코드 변경 거의 없음
- SDK 마운트: `-v /home/kosh/sdks:/sdks`

**장기 — Kubernetes** (SaaS화 또는 다중 고객 서비스 시):
- 서비스별 Pod 스케일링 (SAST Runner 병렬 확장 등)
- 자동 스케일링, 무중단 배포, 장애 복구
- 현 시점에서는 오버킬 — docker-compose로 충분

**설계 원칙** (지금부터 유지):
- S4는 항상 "경로"만 받는 구조 → 저장소가 로컬이든 NFS든 코드 변경 없음
- S3도 projectPath만 받음 → 동일
- S2만 StorageProvider 추상화 레이어 추가하면 로컬↔클라우드 전환 가능
- SDK `.bin` 인스톨러 자동 실행은 VM 환경에서만 (보안상 로컬 실행 금지)
