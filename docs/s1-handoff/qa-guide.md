# S1-QA 실행 가이드

> **역할**: S1 프론트엔드를 사용자 관점에서 검증하는 QA lane
> **최신 상태 반영일**: 2026-04-04

---

## 1. 역할과 기본 원칙

- QA는 `services/frontend/src/renderer/**` 구현 코드를 읽지 않는다.
- 판단 기준은 아래 네 문서다.
  1. `docs/AEGIS.md`
  2. `docs/s1-handoff/README.md`
  3. `docs/specs/frontend.md`
  4. `docs/api/shared-models.md`
- 현재 동적 분석/동적 테스트는 **실운영 화면이 아니라 placeholder 라우트**다.
- repo의 Playwright 자산은 참고 가능하지만, **이 문서의 현재 검증 상태를 우선 기준**으로 삼는다.

---

## 2. 2026-04-04 기준 자동 검증 상태

| 영역 | 명령 | 결과 |
|------|------|------|
| 전체 유닛 | `cd services/frontend && npm test` | PASS (`356` tests) |
| 라우트 스모크 | `cd services/frontend && npx playwright test e2e/specs/navigation.spec.ts` | PASS (`13` tests) |
| 전체 E2E | `cd services/frontend && npm run test:e2e` | **FAIL** (`154` passed / `26` failed / `180` total) |

### 현재 실패 묶음

1. **Approval interaction 2건**
   - 승인 버튼 탐색/클릭 단계 실패
2. **Visual baseline drift 24건**
   - `responsive.spec.ts`
   - `theme.spec.ts`
   - `visual-qa.spec.ts`
   - `visual-qa-dark.spec.ts`

> 따라서 QA는 현재 **라우트 생존 여부는 안정적**이라고 보고, 우선순위를 approval 흐름과 시각 baseline 차이 분석에 둔다.

---

## 3. 현재 제품 표면(실제 라우트)

### 전역 라우트

- `/projects`
- `/settings`
- `/login`

### 프로젝트 라우트

- `/overview`
- `/static-analysis`
- `/files`
- `/files/:fileId`
- `/vulnerabilities`
- `/analysis-history`
- `/report`
- `/quality-gate`
- `/approvals`
- `/settings`
- `/dynamic-analysis` → placeholder
- `/dynamic-test` → placeholder

### QA가 알아야 할 현재 사실

- 동적 placeholder 경로는 라우트에 존재하지만 **사이드바에는 노출되지 않는다**.
- 파일 상세는 `/files`에서 항목 클릭으로 진입한다.
- report/quality-gate/approvals/settings는 모두 현재 mounted 상태다.

---

## 4. 도구 우선순위

1. **Playwright MCP / 공식 Playwright skill**
   - 실제 브라우저 확인이 필요할 때 우선 사용
2. **Playwright CLI**
   - 회귀 재현, spec 재실행, baseline 확인이 필요할 때 사용
3. **log-analyzer MCP**
   - 콘솔/에러 원인 추적이 필요할 때 사용

### CLI 핵심 명령

```bash
cd services/frontend

npm test
npx playwright test e2e/specs/navigation.spec.ts
npx playwright test e2e/specs/interactions.spec.ts -g "Approval Decision"
npx playwright test e2e/specs/visual-qa.spec.ts
npx playwright test e2e/specs/visual-qa-dark.spec.ts
npx playwright test e2e/specs/responsive.spec.ts
npx playwright test e2e/specs/theme.spec.ts
npm run test:e2e
```

---

## 5. 권장 QA 실행 순서

### A. 라우트/기본 생존 확인

1. `npx playwright test e2e/specs/navigation.spec.ts`
2. `/projects`, `/settings`, 프로젝트 하위 핵심 라우트 진입 확인
3. `/dynamic-analysis`, `/dynamic-test`는 placeholder가 보여야 정상

### B. 현재 알려진 회귀 재현

1. `npx playwright test e2e/specs/interactions.spec.ts -g "Approval Decision"`
2. 승인 버튼 노출/클릭 가능 여부, dialog 표시 여부 확인
3. 실패 시 selector 문제인지 실제 UI regression인지 구분

### C. 시각 회귀 확인

1. `visual-qa.spec.ts`
2. `visual-qa-dark.spec.ts`
3. `responsive.spec.ts`
4. `theme.spec.ts`

확인 포인트:
- baseline이 오래된 것인지
- 실제 레이아웃이 깨진 것인지
- 테마/폰트/spacing 변경이 의도된 것인지

---

## 6. 테스트 자산 맵

| spec | 목적 |
|------|------|
| `navigation.spec.ts` | 해시 라우팅/사이드바/핵심 서브페이지 smoke |
| `interactions.spec.ts` | 생성/필터/quality gate/approval 상호작용 |
| `responsive.spec.ts` | 480/768/1024 반응형 스냅샷 |
| `theme.spec.ts` | light/dark/system 테마 전환 |
| `visual-qa.spec.ts` | 주요 라이트 테마 페이지 스냅샷 |
| `visual-qa-dark.spec.ts` | 주요 다크 테마 페이지 스냅샷 |
| `qa-design-audit.spec.ts` | 광범위한 화면/상호작용/빈 상태/반응형 audit |
| `qa-expert-review.spec.ts` | expert review 흐름 검증 |
| `qa-finding-detail.spec.ts` | finding detail drill-down 회귀 |
| `qa-redesign-review.spec.ts` | 리디자인 스냅샷 회귀 |
| `qa-verify-s1-response.spec.ts` | 특정 S1 응답/수정 검증 |

---

## 7. 이슈 보고 포맷

```md
# S1-QA → S1: {이슈 제목}

- 날짜: YYYY-MM-DD
- 범주: Route regression | Interaction bug | Visual drift | Responsive bug
- 실행 명령: `{실행한 명령}`
- 환경: `{viewport} / {theme} / mock 여부`
- 증거:
  - 스크린샷: `services/frontend/e2e/test-results/...`
  - 에러 컨텍스트: `services/frontend/e2e/test-results/.../error-context.md`

## 현상
{무엇이 보였는지}

## 기대 동작
{spec 또는 handoff 기준}

## 재현 절차
1. ...
2. ...
3. ...
```

---

## 8. 지금 QA가 특히 봐야 할 것

1. Approval 페이지에서 실제 CTA가 왜 잡히지 않는지
2. visual snapshot diff가 전역 디자인 변경 때문인지, 특정 페이지 regression인지
3. 동적 placeholder 라우트가 여전히 placeholder로 유지되는지
4. report / quality gate / approvals / project settings가 최신 라우트 구조와 일치하는지

---

## 9. 금지 / 주의

- 구현 코드를 보고 원인을 단정하지 말 것
- baseline mismatch를 무조건 스냅샷 갱신으로 덮지 말 것
- 동적 placeholder를 실패로 오해하지 말 것
- lint는 현재 공식 게이트가 아니므로, QA 결과는 **브라우저 동작/스크린샷/로그** 중심으로 정리할 것
