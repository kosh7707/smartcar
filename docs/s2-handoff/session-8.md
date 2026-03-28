# 세션 8 — 풀스택 통합 테스트 + 서브 프로젝트 파이프라인

**날짜**: 2026-03-24

---

- **풀스택 통합 테스트 시작** — S1 프론트엔드와 실 데이터(RE100) 테스트
- **업로드 비동기 전환** — POST /source/upload → 202 + WS 상태머신 (received→extracting→indexing→complete)
- **파일 분류 시스템**: fileType 12종 + 매직 바이트 ELF 감지 + language 30+ 매핑 + composition 집계
- **서브 프로젝트 파이프라인**: PipelineOrchestrator + PipelineController (build→scan→graph→ready)
- **KbClient 신규**: S5 Knowledge Base HTTP 클라이언트 (코드그래프 ingest/stats/delete)
- **BuildTarget 대폭 확장**: status 상태머신(12상태), includedPaths(물리적 복사), sourcePath, 파이프라인 컬럼 10개
- **SastClient.build()**: S4 /v1/build 연동 (compile_commands.json 생성)
- **Build Agent(:8003) 등록**: start.sh/stop.sh + AEGIS.md 포트 테이블
- **source/files 개선**: 전체 파일 반환(기본), ?filter=source, composition 집계, fileType/previewable/lineCount
- **source/file 메타데이터**: size, language, fileType, previewable, lineCount 포함
- **아카이브 포맷 확장**: tar.gz, tgz, tar.bz2, tar 지원 (매직 바이트 판별)
- **tsconfig.json**: uploads/ exclude 추가
- **버그 수정**: CMakeLists.txt 분류(doc→build), .bin 누락, 파일명 우선 매핑
- **shared-models.md 대규모 갱신**: BuildTargetStatus, WsPipelineMessage, WsUploadMessage, PipelinePhase, UploadPhase, SourceFileEntry 확장
- **S1 WR 다수 처리**: 업로드 통합, 파일 필터 제거, 대시보드 summary, 파이프라인 UI 등
- **상태: TypeScript 0에러, 테스트 153개 통과**
