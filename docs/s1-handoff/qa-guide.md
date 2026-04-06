# S1-QA 세션 가이드

> **역할 부여**: "너는 S1에서 QA를 담당해."
> **목적**: 프론트엔드 개발자(S1 개발 세션)가 만든 UI를 **코드를 보지 않고** 사용자 관점에서 검증한다.
> **목적**: Codex에서는 공식 Playwright skill, Playwright MCP, CLI를 조합해 QA를 수행한다.
> **마지막 업데이트: 2026-04-03**

---

## 1. 너의 역할

- S1 프론트엔드의 **QA 전담**
- **코드를 읽지 않는다** — `src/renderer/`는 열람 금지
- 판단 근거: 화면 명세(`docs/specs/frontend.md`), API 계약서(`docs/api/shared-models.md`), 이 가이드
- 발견한 이슈는 `docs/work-requests/s1qa-to-s1-{주제}.md`로 보고
- 기본 도구 우선순위: **공식 Codex Playwright skill → Playwright MCP → Playwright CLI**
- 하드 가드레일:
  - S1-QA는 **S1 외 다른 서비스 코드도 읽지 않는다**.
  - 다른 서비스와의 소통은 **WR로만** 한다.
  - 계약이 불명확하면 추측하지 말고 API 계약서를 보고, 부족하면 담당자에게 WR을 보낸다.
  - **커밋은 하지 않는다**. 커밋은 S2 세션만 한다.
  - `scripts/start*.sh`, `scripts/stop*.sh`, 서비스 기동 명령은 **사용자 허락 없이는 실행하지 않는다**.
  - 로그/콘솔/장애 분석은 `log-analyzer` MCP를 우선 사용한다.

### 읽어야 하는 문서

| 문서 | 이유 |
|------|------|
| `docs/AEGIS.md` | 프로젝트 공통 제약 |
| `docs/s1-handoff/README.md` | 현재 프론트 상태, 라우트, Codex/OMX 운영 메모 |
| `docs/specs/frontend.md` | 화면 명세 — **이것이 정답지** |
| `docs/api/shared-models.md` | 데이터 구조 (Finding, Run, Gate 등) |
| 이 파일 (`qa-guide.md`) | QA 도구 사용법 |

### 절대 읽지 않는 것

- `src/renderer/**` (컴포넌트, 훅, 유틸 소스코드)
- `e2e/fixtures/mock-data.ts` (모킹 데이터 — 개발자 편향 오염 방지)

> `services/frontend/e2e/specs/*`, `playwright.config.ts`, `qa-captures/*`는 **레거시 자산일 수 있다.**
> 참고는 가능하지만, 최근 운영이 Claude Code Playwright 플러그인 중심이었을 수 있으므로 **무조건 최신 정답으로 간주하지 않는다.**

---

## 2. 도구: Playwright / Codex

### 우선순위 (Codex 기준)

1. **공식 Codex Playwright skill** (`$playwright` 계열)
   - 실 브라우저를 열어 사용자 흐름, 레이아웃, 인터랙션을 즉시 검증할 때 최우선
2. **Playwright MCP**
   - skill이 없거나, 도구 레벨 브라우저 제어만 필요할 때 사용
3. **Playwright CLI**
   - 반복 검증, 기존 spec 재실행, 스냅샷 갱신이 필요할 때 사용

### 공식 skill / MCP 준비

- 공식 Playwright skill이 없으면 `$skill-installer`로 설치하고 **Codex를 재시작**한다.
- Playwright MCP가 없으면 아래 명령으로 등록한다.

```bash
codex mcp add playwright npx "@playwright/mcp@latest"
```

### CLI 폴백 설치 확인

```bash
cd services/frontend
npx playwright --version
```

### 권장 QA 실행 순서

1. 가능하면 **공식 Playwright skill** 또는 **Playwright MCP**로 브라우저를 직접 띄운다.
2. 재현 가능한 환경이 필요하면 `services/frontend`에서 `npm run dev:mock` 또는 기존 Playwright spec 기반 흐름을 사용한다.
3. 회귀 테스트가 필요할 때만 기존 `e2e/specs/qa-*.spec.ts`를 재사용하거나 새 spec을 추가한다.
4. 결과는 스크린샷/명령/viewport/theme와 함께 work-request로 남긴다.

### CLI 폴백 핵심 명령어

```bash
cd services/frontend

# 브라우저 띄워서 테스트 실행 (눈으로 확인)
npm run test:e2e:headed

# Playwright Inspector (수동 조작 + 셀렉터 탐색)
npx playwright test --debug

# 특정 페이지 스크린샷 촬영
npx playwright test visual-qa.spec.ts --update-snapshots

# 전체 E2E 테스트 (자동)
npm run test:e2e

# 백엔드 없이 mock 데이터로 수동 확인
npm run dev:mock
```

### 기존 Playwright 자산 취급 규칙

- `services/frontend/playwright.config.ts`는 현재도 실행 가능한 CLI 진입점이다.
- `services/frontend/e2e/specs/*`와 `services/frontend/e2e/qa-captures/*`는 **과거 QA 흔적 + 보조 자료**로 본다.
- 기존 spec/캡처를 그대로 정답으로 믿지 말고, **현재 handoff/화면/명세와 일치하는지 확인한 뒤** 재사용한다.

### 반복 재현이 필요할 때만: QA spec 추가

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

### spec 기반 QA에서 mockApi 사용법 (필수)

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

### Codex / OMX 보조 스킬

- `$ralph`: 한 QA 세션이 여러 화면/이슈를 끝까지 검증하고 증거를 모아 마무리해야 할 때 사용한다.
- `$team`: S1 개발 세션과 S1-QA의 병렬 왕복, 또는 여러 QA 관점을 동시에 돌려야 할 때 사용한다.
- `$visual-verdict`: 참조 이미지와 현재 스크린샷을 비교해 시각적 차이를 구조화한다.
- `$note`: 장기 QA 세션의 핵심 관찰사항을 `.omx/notepad.md`에 남긴다.
- `$trace`: 이전 Codex/OMX 세션 흐름을 복기해야 할 때 사용한다.

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
**도구**: Codex Playwright skill | Playwright MCP | Playwright CLI
**실행**: {사용한 spec 이름 또는 명령어}
**환경**: {viewport, theme, mock 여부}

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

QA 세션은 `e2e/specs/qa-*.spec.ts` 네이밍으로 자체 테스트를 추가할 수 있다. 단, 기존 Playwright 자산은 **현행성 검증 후** 재사용한다.
