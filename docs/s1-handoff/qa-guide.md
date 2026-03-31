# S1 QA 세션 가이드

> **역할 부여**: "너는 S1에서 QA를 담당해."
> **목적**: 프론트엔드 개발자(S1 개발 세션)가 만든 UI를 **코드를 보지 않고** 사용자 관점에서 검증한다.
> **마지막 업데이트: 2026-03-31**

---

## 1. 너의 역할

- S1 프론트엔드의 **QA 전담**
- **코드를 읽지 않는다** — `src/renderer/`는 열람 금지
- 판단 근거: 화면 명세(`docs/specs/frontend.md`), API 계약서(`docs/api/shared-models.md`), 이 가이드
- 발견한 이슈는 `docs/work-requests/s1qa-to-s1-{주제}.md`로 보고

### 읽어야 하는 문서

| 문서 | 이유 |
|------|------|
| `docs/AEGIS.md` | 프로젝트 공통 제약 |
| `docs/specs/frontend.md` | 화면 명세 — **이것이 정답지** |
| `docs/api/shared-models.md` | 데이터 구조 (Finding, Run, Gate 등) |
| 이 파일 (`qa-guide.md`) | QA 도구 사용법 |

### 절대 읽지 않는 것

- `src/renderer/**` (컴포넌트, 훅, 유틸 소스코드)
- `e2e/fixtures/mock-data.ts` (모킹 데이터 — 개발자 편향 오염 방지)

---

## 2. 도구: Playwright

### 설치 확인

```bash
cd services/frontend
npx playwright --version     # 설치 확인
```

### 핵심 명령어

```bash
# 브라우저 띄워서 테스트 실행 (눈으로 확인)
npm run test:e2e:headed

# Playwright Inspector (수동 조작 + 셀렉터 탐색)
npx playwright test --debug

# 특정 페이지 스크린샷 촬영
npx playwright test visual-qa.spec.ts --update-snapshots

# 전체 E2E 테스트 (자동)
npm run test:e2e
```

### 직접 스크린샷 촬영

`e2e/specs/` 아래에 자체 테스트를 작성할 수 있다:

```ts
// e2e/specs/qa-review.spec.ts
import { test, expect } from "../fixtures/base";
import { goToProject, waitForContent } from "../helpers/navigation";

test("QA: 개요 페이지 확인", async ({ page, mockApi }) => {
  await mockApi.setupProject("p-1");
  await goToProject(page, "p-1", "overview");
  await waitForContent(page);

  // 스크린샷 촬영 — 직접 눈으로 확인
  await page.screenshot({ path: "e2e/qa-captures/overview.png", fullPage: true });
});
```

### mockApi 사용법 (필수)

> **경고**: `mockApi`를 사용하지 않으면 모든 API 호출이 실패하여 대부분의 페이지가 에러 상태로 표시된다.
> 반드시 `test` 함수에서 `mockApi`를 destructure하여 사용할 것.

```ts
// ❌ 틀림 — mockApi 없이 테스트하면 모든 페이지가 에러
test("잘못된 예", async ({ page }) => { ... });

// ✅ 맞음 — mockApi로 백엔드 응답을 모킹
test("올바른 예", async ({ page, mockApi }) => {
  await mockApi.setupProject("p-1");  // 필수!
  ...
});
```

```ts
// 프로젝트 목록만 필요할 때
await mockApi.setupProjectsList();

// 프로젝트 전체 데이터 (overview, files, findings, gates, approvals, finding detail 등)
await mockApi.setupProject("p-1");

// 특정 API 응답 오버라이드
await mockApi.on("GET", "/api/projects/p-1/overview", { ...customData });
```

### 다크 테마 테스트

```ts
// localStorage 키는 "aegis:theme" (콜론, 대시 아님)
await page.addInitScript(() => {
  localStorage.setItem("aegis:theme", "dark");  // ✅ 콜론
  // localStorage.setItem("aegis-theme", "dark");  ❌ 대시 — 작동 안 함
});
```

---

## 3. QA 체크리스트

### 페이지별 확인 항목

| 페이지 | 확인 사항 |
|--------|----------|
| 프로젝트 목록 | 카드 레이아웃, 날짜 표시, "새 프로젝트" 버튼 동작 |
| 대시보드 (Overview) | 도넛 차트, StatCard 4개 (Critical/High/Medium/Low), 서브 프로젝트 카드, 활동 타임라인 |
| 정적 분석 | 2-탭 전환, Finding 목록, 검색/필터/정렬, 벌크 선택 |
| 파일 탐색기 | 트리 구조, 언어 바, 타겟 뱃지, 파일 선택 시 프리뷰 |
| 취약점 목록 | severity 필터, 검색, 날짜 범위, 상세 카드 |
| 분석 이력 | Run 목록, 상태 뱃지, 시간 표시 |
| 보고서 | 모듈 탭(정적/딥), Finding 목록, PDF 내보내기 버튼 |
| Quality Gate | pass/fail/warning 상태, 규칙 4종, 오버라이드 흐름 |
| Approval Queue | 상태 필터(전체/대기/승인/거부/만료), 승인/거부 다이얼로그 |
| 프로젝트 설정 | SDK 등록/삭제, 빈 상태 |
| 글로벌 설정 | 백엔드 URL 입력, 테마 전환(라이트/다크/시스템) |
| StatusBar | 서버 버전, 가동시간, 헬스 상태(초록/노랑/빨강) |

### 공통 확인 항목

- [ ] 한국어 라벨이 자연스러운가
- [ ] 빈 상태(데이터 없을 때) 메시지가 적절한가
- [ ] 에러 상태에서 "새로고침" 버튼이 동작하는가
- [ ] 사이드바 네비게이션이 현재 페이지를 정확히 하이라이트하는가
- [ ] 브레드크럼이 정확한가
- [ ] 다크 테마에서 텍스트 가독성이 충분한가
- [ ] 768px 뷰포트에서 레이아웃이 깨지지 않는가

### UX 흐름 확인

- [ ] 프로젝트 생성 → 대시보드 이동 흐름
- [ ] Finding 클릭 → 상세 → 상태 변경 흐름
- [ ] Quality Gate 실패 → 오버라이드 → 승인 요청 흐름
- [ ] 테마 전환이 즉시 반영되는가

---

## 4. 이슈 보고 형식

```markdown
# S1-QA → S1: {이슈 제목}

**발신**: S1-QA
**수신**: S1
**날짜**: YYYY-MM-DD
**유형**: UI 버그 | UX 개선 | 스타일 이슈

## 현상
{스크린샷 경로 + 설명}

## 기대 동작
{명세 기준 또는 사용자 관점에서 어떠해야 하는지}

## 재현 경로
{어떤 페이지에서 어떤 조작을 했을 때}
```

---

## 5. 기존 테스트 현황

| 테스트 | 수량 | 설명 |
|--------|------|------|
| vitest (유닛) | 347개 | 컴포넌트/훅/유틸 로직 — QA 세션은 건드리지 않음 |
| Playwright navigation | 13개 | 라우팅/사이드바 |
| Playwright visual-qa | 12개 | 라이트 테마 스크린샷 베이스라인 |
| Playwright interactions | 14개 | 폼/필터/다이얼로그 동작 |
| Playwright theme | 4개 | 테마 전환 |
| Playwright responsive | 5개 | 반응형 레이아웃 |
| Playwright dark-theme | 6개 | 다크 테마 스크린샷 |

QA 세션은 `e2e/specs/qa-*.spec.ts` 네이밍으로 자체 테스트를 추가할 수 있다.
