# S2 → S1: Rule 엔진 완전 제거 공지

**발신**: S2 (AEGIS Core)
**수신**: S1 (Frontend)
**날짜**: 2026-03-28
**유형**: 공유 모델 변경 공지

---

## 변경 사항

### 1. 공유 패키지 (`@aegis/shared`) 타입 제거

다음 타입이 `@aegis/shared`에서 **삭제**되었습니다:

- `Rule` (interface) — `models.ts`
- `RuleCreateRequest` — `dto.ts`
- `RuleUpdateRequest` — `dto.ts`
- `RuleResponse` — `dto.ts`
- `RuleListResponse` — `dto.ts`

### 2. DB `rules` 테이블 제거

- S2 백엔드 DB에서 `rules` 테이블이 완전 제거됨
- 기존 DB에서는 마이그레이션 시 `DROP TABLE IF EXISTS rules` 실행

### 3. 제거된 S2 내부 코드

- `IRuleDAO` 인터페이스
- `LlmV1Adapter` (v0→v1 LLM 호환 레이어)
- `MockEcu` (개발용 ECU 시뮬레이터)

---

## 영향 범위

- S1 프론트엔드에 Rule 관련 UI(CSS: `SettingsPage.css` — Rule Forms, Rule Rows)가 잔존
- Rule CRUD API 엔드포인트는 이미 이전 세션에서 제거됨 (S2에는 Rule 관련 컨트롤러 없음)
- `@aegis/shared`에서 `Rule` 타입 import 시 빌드 에러 발생

## 필요 조치

- Rule 관련 UI 컴포넌트, CSS, TypeScript import가 있으면 제거해 주세요.
- Rule CRUD API 호출 코드가 있으면 함께 제거해 주세요.
