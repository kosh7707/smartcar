# S1 Session 4 — 2026-03-18

## 완료된 작업

9. ✅ 디자인 리뷰 2차 피드백 8건 수정
   - **StatCard 교체**: 최신 분석 탭 "소요 시간" → "미해결" (open/needs_review/needs_revalidation/sandbox 집계)
   - **도넛차트 교체**: 최신 분석 탭 심각도 분포 DonutChart → 출처별 분포 바차트 (룰/AI/룰+AI). 심각도는 필터 탭과 중복이므로 제거
   - **트렌드 가이드**: TrendChart `data.length < 2`일 때 "2회 이상 분석 필요" 가이드 메시지 표시 (1포인트 막대 제거)
   - **KPI 해결률**: 전체 현황 탭 "미해결" 카드에 `해결률 N%` detail 추가 (총 Finding = 미해결일 때 같은 숫자 반복 방지)
   - **배지 툴팁**: FindingStatusBadge, ConfidenceBadge, SourceBadge에 `title` 속성 추가 (상태/신뢰도/출처별 한 줄 설명)
   - **어댑터 neutral**: StatusBar 어댑터 미등록 → `neutral` 클래스 (회색 dot, 글로우 없음. 빨간색 경고 피로 해소)
   - **진행률 가중치**: AsyncAnalysisProgressView 균등 20% → 시간 가중치 (queued 2.5%, rule 7.5%, LLM 10-90%, merging 95%). 서버 `phaseWeights` 우선 + 하드코딩 fallback
   - **Finding 브레드크럼**: FindingDetailView에 "정적 분석 › Finding 상세" 간이 경로 텍스트 추가
10. ✅ S2 work-request 3건 발송 → S2 처리 완료
    - AI Finding location fallback 강화 (S2 수정 완료, 새 분석부터 적용)
    - 감사 로그: 정상 동작 확인 (상태 변경 전에는 빈 배열이 맞음)
    - phaseWeights 서버 제공 시작 (S1에서 서버값 우선 사용 반영 완료)
11. ✅ AEGIS 6인 체제 재편 대응
    - 프로젝트명 AEGIS 확정 (Automotive Embedded Governance & Inspection System)
    - 4인 → 6인 체제 (S5 Knowledge Base, S6 Dynamic Analysis 신설)
    - `docs/AEGIS.md` 신설 (공통 제약 사항) — S1 인수인계서 + 명세서에 참조 반영
    - `docs/s1-qa/` 폴더 폐기 (4파일 삭제)

12. ✅ `smartcar` → `AEGIS` 네이밍 전환 (S2 WR `s2-to-all-rename-smartcar-to-aegis.md` 대응)
    - `package.json`: `@smartcar/frontend` → `@aegis/frontend`, 의존성 `@aegis/shared`
    - HTML/Electron 윈도우 타이틀 → `AEGIS`
    - Sidebar 브랜드: `Smartcar` / `Security Framework` → `AEGIS` / `Security Platform`
    - SettingsPage 프레임워크명 → `AEGIS`
    - `window.d.ts`: `SmartcarApi` → `AegisApi`
    - localStorage 키: `smartcar:backendUrl` → `aegis:backendUrl`, `smartcar:theme` → `aegis:theme`
    - 소스 49개 파일 `@smartcar/shared` → `@aegis/shared` import 전량 치환
    - S1 소유 문서 2건 (`s1-handoff/README.md`, `specs/frontend.md`) 치환
    - S1 영역 `smartcar`/`Smartcar` 잔여 0건 확인
