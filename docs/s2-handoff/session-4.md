# 세션 4 — AEGIS 6인 체제 재편

**날짜**: 2026-03-18

---

- 프로젝트명 확정: **AEGIS — Automotive Embedded Governance & Inspection System** (전원 동의)
- 6인 체제 재편: S1(Frontend+QA), S2(AEGIS Core), S3(Agent+LLM), S4(SAST), S5(KB), S6(동적분석)
- `docs/AEGIS.md` 공통 제약 사항 문서 신규 작성 (S2 관리)
- S2에서 Adapter/ECU Simulator 소유권 → S6로 이전
- S2 = 플랫폼 오케스트레이터 역할 명확화
- 인프라 스크립트 정책 강화 (start/stop은 S2만, 개별 기동 스크립트는 각 서비스 소유자)
- MEMORY.md 전면 개편 (AEGIS 체제 반영)
- S3/S4 작업 요청 3건 확인 (역할 재편 후 처리 예정)
- 인수인계서 6개 헤더 양식 통일 (AEGIS.md 참조 → 역할 소개 → 마지막 업데이트 순서)
- 풀스택 예외 조항 전면 삭제 (S1, S2, S3 — AEGIS.md에서 예외 없음 확정)
- S3: Gateway/Agent "통합 예정" → "분리 유지 결정 (2026-03-18)" 반영
- S4: AEGIS.md 참조 추가, LLM Engine 관리 문서 행 제거 (S3 이관 반영)
- **상태: 문서만 변경, 코드 변경 없음**
