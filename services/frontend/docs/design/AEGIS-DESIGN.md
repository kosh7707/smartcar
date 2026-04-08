# AEGIS Design System — IBM Carbon + NVIDIA Restraint

> 이 문서는 AEGIS 프론트엔드 디자인 시스템의 **증적**이다.
> 스타일 변경 시 이 문서를 기준으로 추적하고, QA 검증에 활용한다.
> 마지막 갱신: 2026-04-08

---

## Architecture

- **Token System**: IBM Carbon `--cds-*` + AEGIS `--aegis-*` 시맨틱 토큰
- **Single Source**: 모든 값은 `src/renderer/styles/tokens.css` 단일 파일에서 관리
- **Theme**: `:root` (라이트) + `[data-theme="dark"]` (다크, 기본 운영 모드)
- **Visual**: Flat design (shadow 없음), floating 요소만 shadow 허용
- **Radius**: 2px (NVIDIA식), pill은 24px
- **Grid**: 8px (Carbon standard)

## Color Palette

### Interactive (IBM Blue)
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--cds-interactive` | #0f62fe | #78a9ff | CTA, 링크, 포커스, 활성 |
| `--cds-interactive-hover` | #0043ce | #a6c8ff | 호버 |
| `--cds-button-primary` | #0f62fe | #0f62fe | 버튼 배경 |
| `--cds-focus` | #0f62fe | #ffffff | 포커스 링 |

### Surface (Carbon Gray)
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--cds-background` | #ffffff | #161616 | 페이지 배경 |
| `--cds-layer-01` | #f4f4f4 | #262626 | 카드, 섹션 |
| `--cds-layer-02` | #e0e0e0 | #393939 | 중첩, 호버 |
| `--cds-layer-03` | #c6c6c6 | #525252 | 깊은 중첩 |

### Text
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--cds-text-primary` | #161616 | #f4f4f4 | 제목, 본문 |
| `--cds-text-secondary` | #525252 | #c6c6c6 | 보조 텍스트 |
| `--cds-text-placeholder` | #6f6f6f | #6f6f6f | 플레이스홀더, tertiary |
| `--cds-text-on-color` | #ffffff | #ffffff | 컬러 배경 위 텍스트 |

### Severity (보안 표준 — AEGIS 도메인)
| Token | Color | Usage |
|-------|-------|-------|
| `--aegis-severity-critical` | #da1e28 | Critical 취약점 |
| `--aegis-severity-high` | #ff832b | High 취약점 |
| `--aegis-severity-medium` | #f1c21b | Medium 취약점 |
| `--aegis-severity-low` | #00539a | Low 취약점 |
| `--aegis-severity-info` | #525252 | Info/참고 |

각 severity는 `-bg` (배경 틴트)와 `-border` (테두리) 변형이 있다.

### Semantic (Carbon Support)
| Token | Color | Usage |
|-------|-------|-------|
| `--cds-support-success` | #24a148 | 성공 |
| `--cds-support-warning` | #f1c21b | 경고 |
| `--cds-support-error` | #da1e28 | 오류 |
| `--cds-support-info` | #0f62fe | 정보 |

### Sidebar (테마 불변 — 항상 다크)
| Token | Value | Usage |
|-------|-------|-------|
| `--aegis-sidebar-bg` | #161616 | 사이드바 배경 |
| `--aegis-sidebar-surface` | #262626 | 사이드바 내부 영역 |
| `--aegis-sidebar-text` | #c6c6c6 | 비활성 텍스트 |
| `--aegis-sidebar-text-active` | #f4f4f4 | 활성 텍스트 |

## Typography

### Font Stack
| Role | Font | Fallback |
|------|------|----------|
| Body/Display | IBM Plex Sans (300/400/500/600) | Pretendard → system |
| Code/Data | IBM Plex Mono (400/500) | Fira Code → monospace |

### Type Scale
| Token | Size | Weight | Letter Spacing | Usage |
|-------|------|--------|---------------|-------|
| `--cds-type-display` | 42px | 300 (Light) | 0 | 히어로 |
| `--cds-type-3xl` | 32px | 400 | 0 | 페이지 제목 |
| `--cds-type-2xl` | 26px | 400 | 0 | 섹션 제목 |
| `--cds-type-xl` | 20px | 600 | 0 | 카드 제목 |
| `--cds-type-lg` | 16px | 400 | 0 | 본문 (큰) |
| `--cds-type-md` | 14px | 400 | 0.16px | 본문, 네비 |
| `--cds-type-sm` | 12px | 400 | 0.32px | 캡션 |
| `--cds-type-xs` | 11px | 400 | 0.32px | 작은 라벨 |
| `--cds-type-2xs` | 10px | 400 | 0.32px | 마이크로 |

### Principles
- Display(42px+): weight 300 (Light) — Carbon expressive
- Body(14px): letter-spacing 0.16px — Carbon productive
- Caption(12px): letter-spacing 0.32px
- 기술 데이터(CVE, 경로, 해시): IBM Plex Mono

## Spacing (8px Grid)

| Token | Value | Old Token |
|-------|-------|-----------|
| `--cds-spacing-01` | 2px | (new) |
| `--cds-spacing-02` | 4px | --space-1 |
| `--cds-spacing-03` | 8px | --space-2 |
| `--cds-spacing-04` | 12px | --space-3 |
| `--cds-spacing-05` | 16px | --space-4 |
| `--aegis-spacing-05` | 20px | --space-5 (AEGIS 확장) |
| `--cds-spacing-06` | 24px | --space-6 |
| `--cds-spacing-07` | 32px | --space-8 |
| `--cds-spacing-08` | 40px | --space-10 |
| `--cds-spacing-09` | 48px | --space-12 |
| `--cds-spacing-10` | 64px | --space-16 |

## Component Patterns

### Buttons
| Type | Background | Text | Border |
|------|-----------|------|--------|
| Primary | --cds-button-primary | --cds-text-on-color | none |
| Secondary | --cds-button-secondary | --cds-text-on-color | none |
| Ghost | transparent | --cds-interactive | 1px solid --cds-interactive |
| Danger | --cds-button-danger | --cds-text-on-color | none |

All: `border-radius: var(--cds-radius)` (2px)

### Cards
- Background: `--cds-layer-01`
- Radius: `var(--cds-radius)` (2px)
- Shadow: **none** (flat)
- Hover: background → `--cds-layer-02`
- Severity stripe: `border-left: 3px solid var(--aegis-severity-*)`

### Inputs (Carbon bottom-border)
- Background: `--cds-field`
- Border: none (sides/top), `2px solid transparent` (bottom)
- Focus: bottom `2px solid var(--cds-focus)`
- Error: bottom `2px solid var(--cds-support-error)`

### Badges/Tags
- Radius: `var(--cds-radius-pill)` (24px)
- Background: color at 10% opacity
- Text: 60-grade color

### Sidebar
- Always dark (--aegis-sidebar-* 테마 불변 토큰)
- Active: `border-left: 3px solid var(--cds-interactive)`
- Menu font: 14px+

## AEGIS Identity Markers

이 4가지는 Carbon 구조 위에서 반드시 보존:

1. **Severity 색상 계층**: Critical→High→Medium→Low 시각적 긴박감 차등
2. **다크모드 기본**: 커맨드 센터/운영 콘솔 느낌
3. **모노스페이스 데이터**: CVE, 파일 경로, 해시 → IBM Plex Mono
4. **밀도 있는 레이아웃**: Carbon productive density, 불필요 여백 최소화

## Reference
- IBM Carbon: `/home/kosh/AEGIS/docs/design/ibm/DESIGN.md`
- NVIDIA: `/home/kosh/AEGIS/docs/design/nvidia/DESIGN.md`
- WR: `wiki/canon/work-requests/s1-qa-to-s1-aegis-ibm-carbon-nvidia.md`
