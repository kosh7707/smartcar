# S2 개발 로드맵

> 즉시 다음 작업 + 후순위 + 인프라 계획
> 진입점: `README.md` → 필요 시 이 문서 참조

---

## 10. 알려진 이슈 / 로드맵 / 세션 로그

### 대기 중인 작업 요청 (2026-03-28 기준)

`docs/work-requests/`: `s2-to-s1-rule-engine-removal.md` — Rule 엔진 완전 제거 공지 (S1이 처리 후 삭제).

### 세션 13 완료 사항 (2026-03-28)

- DB `rules` 테이블 + 마이그레이션 + 인덱스 완전 제거 (19→18 테이블)
- CREATE TABLE에 최종 컬럼 통합 (가독성 향상, ALTER TABLE은 레거시 호환용 유지)
- 공유 패키지: `Rule`, `RuleCreateRequest/UpdateRequest/Response/ListResponse` 타입 제거
- `LlmV1Adapter` 제거 → `LlmTaskClient`에 concurrency queue 통합, Dynamic 서비스 직접 사용
- `MockEcu` 제거 → 인터페이스를 `adapter-client.ts`로 인라인
- `IRuleDAO`, `makeRule()`, 빈 `rules/` 디렉토리, stale dist 산출물 제거
- `db-stats.sh` 전면 갱신 (9→18 테이블 조회)
- S3 통합 테스트 완료 대응: 파이프라인 격리 경로(`target.sourcePath`) 사용, Build Agent 경로 수정, 부분 빌드 처리, PoC에 `projectPath` 추가
- log-analyzer 토큰 절감 (메시지 축약, 중복 그룹핑, max_lines)

### DB hot-reload 함정

서버가 `tsx watch`로 실행 중일 때 `aegis.db`를 삭제하면 0바이트 파일이 되고 테이블이 생성되지 않는다. 반드시 서버 프로세스를 종료 -> DB 삭제 -> 서버 재시작 순서로 진행할 것.

### shared 타입 변경 시

`@aegis/shared`는 S2가 단독 소유한다. 변경 시 `docs/api/shared-models.md`를 같이 업데이트하고, S1에게 work-request로 통보한다. DB 컬럼명(snake_case)과 TypeScript 필드명(camelCase) 변환은 DAO의 `rowTo*()` 함수에서 수동으로 한다.

### 마이그레이션 순서

`db.ts`에서 인덱스 생성은 반드시 ALTER TABLE 마이그레이션 **이후**에 해야 한다. 이 순서를 어기면 기존 DB에서 "no such column" 에러로 서버가 크래시 루프에 빠진다.

---

## 11. 개발 로드맵

### 기존 파이프라인: 구현 완료

정적 분석, 동적 분석, 동적 테스트(퍼징/침투), 프로젝트 CRUD/Overview, 프로젝트 스코프 어댑터/룰/설정 CRUD, BuildProfile/SDK 프로파일 모두 완료.

### 코어 도메인 (1~3단계): 구현 완료

- Run, Finding (7-state 라이프사이클), EvidenceRef, AuditLog
- ResultNormalizer (3개 파이프라인 통합)
- Quality Gate, Approval, Report

### 테스트 인프라: 구현 완료

vitest 기반 테스트 267개. `cd services/backend && npx vitest run`으로 실행.

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

1. **E2E 풀스택 통합 테스트** — 전체 파이프라인 (업로드→서브프로젝트→빌드→스캔→Deep) 검증

### 후순위

- `source.get_span` API — 소스 파일 특정 범위 반환 (S3 Agent tool)
- Overview에 `deep_analysis` 모듈 집계 추가 (project.service.ts)
- 사용자 인증 (JWT 기반) — Approval 고도화 시 필요

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
