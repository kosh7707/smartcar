# 세션 12: Build Agent v3 + 외부 피드백 P0 수정 (2026-03-27, 완료)

**Build Agent v3 고도화 (2026-03-26)**:
- **list_files 도구 신설**: 프로젝트 디렉토리 트리 반환. 140회 read_file → 1회 list_files로 구조 파악 효율화
- **Phase 0 결정론적 사전 분석**: LLM 루프 전에 빌드 시스템(cmake/make/autotools/shell), SDK, 언어, 기존 스크립트를 자동 탐지. 시스템 프롬프트에 결과 주입
- **BuildErrorClassifier**: try_build 실패 시 9개 카테고리로 에러 분류 + 결정론적 복구 제안. LLM이 구조화된 진단을 보고 복구 결정
- **컨텍스트 압축**: TurnSummarizer 활성화 (16K 토큰 임계치). tool_call/tool 쌍 보존. read_file 50KB → 8KB + 절삭 공지
- **S4 v0.6.0 options.tools 대응**: Phase 1에 `sastTools` 파라미터 경로 개방
- **테스트**: 146 → 185 passed (+39)

**외부 피드백 P0 수정 (2026-03-27)**:
- **경로 스코프 통합**: `resolve_scoped_path()` 공통 유틸 신설 (agent-shared). Path.resolve() + is_relative_to()로 prefix confusion 방지
- **중복 호출 차단 수정**: mutating tool 성공 후 duplicate hash 초기화
- **스크립트 내용 안전성**: write_file/edit_file 시 금지 패턴 스캔 + _content_warnings
- **MessageManager API 보완**: add_user_message() 추가
- **TurnSummarizer 역할 수정**: 생략 메시지 role user → system
- **토큰 추정 보강**: tool_calls JSON 크기 포함
- **chmod 모순 해소**: "bash script.sh로 실행" 변경
