# 세션 3 — SAST + BuildProfile + SDK

**날짜**: 2026-03-17

---

- C/C++ only 확장자 + detectLanguage 업데이트
- BuildProfile / SdkProfile 타입 (shared models)
- SDK 프로파일 12개 + API (`GET /api/sdk-profiles`, `GET /api/sdk-profiles/:id`)
- ProjectSettingsService에 buildProfile JSON 직렬화 + resolveBuildProfile()
- LLM context에 trusted.buildProfile 포함 (static-explain)
- AI Finding location fallback 개선 (멀티파일 청크 filename 매칭)
- WS phaseWeights 추가 (첫 static-progress 이벤트)
- start.sh/stop.sh에 SAST Runner (포트 9000) 추가
- S4 에이전트 아키텍처 전환 제안 검토 + S2 응답
- Durable/Transient 전략 확정
- **상태: UNCOMMITTED**
