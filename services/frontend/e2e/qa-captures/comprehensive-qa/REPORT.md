# AEGIS 종합 디자인 QA 리포트

- **날짜**: 2026-04-06
- **페르소나**: 1년차 주니어 개발자 (처음 사용)
- **환경**: dev:mock (VITE_MOCK=true) + Playwright MCP, Chromium
- **WR**: s1-to-s1-qa-s1-qa-qa (S1 -> S1-QA)

---

## Executive Summary

| 항목 | 결과 |
|------|------|
| **라우트 생존** | 16/16 PASS (14 운영 + 2 placeholder) |
| **Interaction 회귀** | 10/14 PASS, **4 FAIL** (approval 2건 + override/creation 2건) |
| **Visual baseline** | 3/25 PASS, **24 FAIL** (전역 디자인 변경 23건 + regression 1건) |
| **CSS audit** | 67/67 ALL PASS |
| **페르소나 이슈** | **P0: 1건, P1: 5건, P2: 3건** (총 9건) |

**핵심 발견**: Approval 페이지에서 승인/거부 액션 버튼이 사라짐 (P0). 나머지 visual diff 24건 중 23건은 v0.7.0 디자인 진화로 인한 baseline 갱신 필요.

---

## Test Asset Audit

| 분류 | Spec | 테스트 수 |
|------|------|-----------|
| **Active** | navigation, interactions, visual-qa, visual-qa-dark, responsive, theme, qa-design-audit | 7개 (총 ~112 tests) |
| **Excluded** | qa-expert-review, qa-redesign-review, qa-finding-detail | 3개 (이전 QA 사이클 아티팩트, 중복 캡처) |
| **Reference** | qa-verify-s1-response | 1개 (UX-3 진단 데이터) |

---

## CSS 3축 검증 결과

### 축 1: 전체 화면 스냅샷

- qa-design-audit.spec.ts **67/67 ALL PASS** — light/dark 전 라우트, interactions, empty states, responsive, wide 포괄
- Phase 1에서 14개 운영 라우트 dark theme 스크린샷 캡처 완료
- Light theme overview/settings 추가 캡처 완료

### 축 2: 테마 일관성

- **CSS 변수 체계**: `--surface-0~3`, `--text-primary`, `--sidebar-*` — `:root`에 light 기본값, `[data-theme="dark"]`으로 오버라이드
- **전환 방식**: `data-theme` attribute on `<html>` + localStorage `aegis:theme`
- **사이드바**: light/dark 모두 dark 배경 유지 (의도적 디자인)
- **하드코딩 색상**: 발견되지 않음
- **전환 동작**: Settings에서 라이트/다크/시스템 전환 즉시 반영, 네비게이션 후에도 유지

### 축 3: 반응형 (480/768/1024)

| Breakpoint | 사이드바 | 카드 레이아웃 | 오버플로우 | 텍스트 잘림 |
|------------|---------|-------------|----------|-----------|
| 480px | 아이콘 모드 (접힘) | 2열 reflow | 없음 | 없음 |
| 768px | 아이콘 모드 (접힘) | 4열, LOW 카드 다음 줄 | 없음 | 없음 |
| 1024px | 라벨 모드 (펼침) | 5열 완전 표시 | 없음 | 없음 |

---

## Visual Baseline 분류 결과 (Phase 3)

| Spec | PASS | FAIL |
|------|------|------|
| visual-qa.spec.ts | 0 | 12 |
| visual-qa-dark.spec.ts | 0 | 6 |
| responsive.spec.ts | 0 | 5 |
| theme.spec.ts | 3 | 1 |
| **Total** | **3** | **24** |

### 3-Bucket 분류

| Bucket | 건수 | 설명 |
|--------|------|------|
| **정상 (의도된 변경)** | 23건 | 전역 테마/디자인 진화 (light->dark 기본, 카드 리디자인, 정보 밀도 증가, v0.7.0). **Baseline 갱신 필요** |
| **Regression** | 1건 | approvals 페이지 — "승인/거부" 액션 버튼이 pending 카드에서 제거됨 |
| **판단 불가** | 0건 | 전역 변경 패턴이 명확하여 해당 없음 |

**근거**: Baseline은 이전 light-theme 버전에서 생성됨. 현재 v0.7.0은 dark 기본 + 대폭 리디자인. theme.spec.ts에서 dark 3건 PASS / light 전환 1건 FAIL → light 테마가 가장 크게 변경됨.

---

## Interaction 진단 결과 (Phase 2)

**interactions.spec.ts: 10 PASS / 4 FAIL**

| 테스트 | 결과 | 원인 분류 |
|--------|------|-----------|
| Create Project (3/4) | cancel, empty name, open form PASS | - |
| successful creation calls POST | **FAIL** | Mock/API route 문제 |
| Finding Filters (4/4) | ALL PASS | - |
| Quality Gate Override (2/3) | override button, cancel PASS | - |
| submit calls overrideGate API | **FAIL** | Mock/API route 문제 |
| Approval filter buttons | PASS | - |
| **approve button opens decision dialog** | **FAIL** | **UI Regression** — 승인 버튼 미렌더링 |
| **confirm approve calls decideApproval API** | **FAIL** | 위 테스트 의존 |

**Approval CTA 원인**: `.approval-card button.btn-sm` selector에 "승인" 텍스트 요소가 DOM에 존재하지 않음. Baseline 스크린샷에는 "승인"/"거부" 버튼이 명확히 보임. **UI Regression 확정**.

---

## 이슈 목록 (P0/P1/P2)

### P0 — 사용 불가 (1건)

**P0-1: Approval 승인/거부 버튼 누락**
- 범주: Interaction bug
- 라우트: `/projects/p-1/approvals`
- 환경: 1280x720 / dark / mock
- 증거: `phase2-approvals-pending-no-action-btn.png`, baseline `approvals-chromium-linux.png`
- 현상: pending 상태 "Quality Gate 오버라이드" 카드에 "Gate 보기" 버튼만 존재. "승인"/"거부" 액션 버튼 없음.
- 기대 동작: Baseline처럼 pending 카드 하단에 "승인" + "거부" 버튼 렌더링
- 재현 절차:
  1. `/projects/p-1/approvals` 진입
  2. "대기" 탭 클릭
  3. "Quality Gate 오버라이드" 카드 확인 → 승인/거부 버튼 없음
- 페르소나: "팀에서 이걸 승인하라고 했는데, 승인 버튼이 어디야? 어떻게 해야 하는 거지?"

### P1 — UX 불편 (5건)

**P1-1: 사이드바 한/영 혼용**
- 범주: UX consistency
- 라우트: 전체 프로젝트 뷰
- 현상: "Quality Gate", "Approval Queue"만 영어, 나머지 전부 한국어
- 페르소나: "왜 이것만 영어야? 나머지는 다 한국어인데"

**P1-2: 프로젝트 카드 severity 약어**
- 범주: Information clarity
- 라우트: `/projects`
- 현상: "C:1 H:2 M:1 L:1" 약어에 tooltip/범례 없음
- 페르소나: "C가 뭐야? Critical인 건 짐작하지만 확실하지 않아"

**P1-3: 버전 불일치**
- 범주: Information consistency
- 라우트: `/settings` + 전체 푸터
- 현상: 푸터 "AEGIS v0.7.0" vs 설정 페이지 "버전 v0.1.0"
- 페르소나: "이 프로그램 버전이 뭐야? 둘이 다른데?"

**P1-4: 파일 상세 "0줄" 표시**
- 범주: Information accuracy
- 라우트: `/files/f-2`
- 현상: gateway.c (27.6 KB) 파일에 "0줄" 표시
- 페르소나: "파일이 비어있는 건가? 근데 27KB인데?"

**P1-5: Quality Gate "오버라이드" 무설명**
- 범주: Terminology clarity
- 라우트: `/quality-gate`
- 현상: "오버라이드" 버튼에 설명/tooltip 없음
- 페르소나: "오버라이드? 무시하는 건가? 클릭하면 어떻게 되는 거지?"

### P2 — 디자인 단점 (3건)

**P2-1: Placeholder 라우트 사이드바 미노출**
- 라우트: `/dynamic-analysis`, `/dynamic-test`
- 현상: URL 직접 접근 가능하지만 사이드바 메뉴에 없음
- 페르소나: "URL로는 들어갈 수 있는데 메뉴에는 안 보여"

**P2-2: 키보드 단축키 힌트 극소 표시**
- 라우트: `/vulnerabilities`
- 현상: 하단에 작은 "키보드 단축키" 텍스트
- 페르소나: "하단에 뭔가 있긴 한데 너무 작아서 안 보여"

**P2-3: 알림 뱃지 동작 불명확**
- 라우트: 전체 (푸터)
- 현상: "3건 미확인" 뱃지 표시되나 알림 패널 동작 불명확
- 페르소나: "알림 아이콘 눌렀는데 뭐가 열리는지 잘 모르겠어"

---

## S1 WR 요약

S1에 발행할 WR:

1. **P0-1**: Approval 승인/거부 버튼 복원 (긴급)
2. **P1-3**: 버전 불일치 수정 (v0.7.0 vs v0.1.0)
3. **P1-4**: 파일 상세 줄 수 표시 수정 (0줄 → 실제 줄 수)
4. **P1-1**: 사이드바 한/영 혼용 정리
5. **Baseline 갱신**: 23건 visual baseline을 현재 v0.7.0 기준으로 갱신
