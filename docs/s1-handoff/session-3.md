# S1 Session 3 — 2026-03-17

## 완료된 작업

4. ✅ 정적 분석 대시보드 2-탭 개편 (SonarQube 패턴)
   - **"최신 분석" 탭 (기본)**: Quality Gate 배너, Run 요약 StatCards(Finding/Critical+High/소요시간), 심각도 DonutChart, 취약 파일 Top 5, Finding 목록(파일별 그룹)
   - **"전체 현황" 탭**: 기존 대시보드 body 이동 (KPI 4종, 심각도/출처 분포, 트렌드, 상태 분포, 랭킹, 최근 Run)
   - `useStaticDashboard` 훅에 `latestRunDetail`/`latestRunLoading` 상태 추가, 최신 completed run 자동 fetch
   - PeriodSelector를 전체 현황 탭 전용으로 이동
   - 신규 컴포넌트: `LatestAnalysisTab`, `OverallStatusTab`
   - ActiveAnalysisBanner는 탭과 무관하게 항상 표시
5. ✅ 버그 수정 7건
   - 파일 네비게이션: 상대 경로 → 절대 경로 전환
   - `toast.info` → `toast.warning` (API에 `info` 없음)
   - 브레드크럼 한/영 불일치: `pageNames` 맵 보완
   - 보고서 페이지: API 에러 vs 빈 데이터 UI 분리 (`loadError` 상태)
   - Finding 수 불일치: `findings.length` 기준 표시 통일
   - 소요 시간 0초: 방어 로직 (`durationSec > 0` 조건)
   - 토스트: 3초 자동 닫기, 우측 하단 고정
6. ✅ QA 버그 3건 수정 (QA 결과 기반)
   - DonutChart 중앙 숫자: Info 제외 → 전체 Finding 표시 (`total`), 라벨 "취약점" → "Finding"
   - FindingDetailView 레이아웃: 설명/수정 가이드를 EvidencePanel 위로 이동 (175건 증적에 밀리는 문제)
   - ToastContext 안정화: `useCallback` + `api()` → `useMemo`로 변경 (context value 참조 안정성)
7. ✅ QA/리뷰 워크플로우 정립
   - 역할/규칙/작업 3단 구조로 전환
   - `docs/s1-qa/` 폴더는 2026-03-18 AEGIS 재편 시 폐기됨
8. ✅ 디자인 리뷰 피드백 8건 일괄 수정
   - **브레드크럼 한/영 통일**: `overview: "Overview"` → `"대시보드"` (Sidebar도 동시 수정)
   - **스테퍼 라벨 개선**: "대기/룰 엔진/LLM 분석" → "파일 추출/룰 분석/AI 분석"
   - **콘텐츠 max-width**: `.content`에 `max-width: 1400px` 추가 (넓은 화면 여백 완화)
   - **증적 배지 크기**: `.badge-sm` CSS 정의 추가 (기존 코드에서 사용했지만 정의 누락)
   - **상태 분포 강화**: `FindingSummary` 축약 칩 → 수평 스택 바 차트 (풀 한국어 라벨)
   - **증적 접기/펼치기**: `EvidencePanel` — 5건 초과 시 "나머지 N건 더 보기" 토글
   - **[Major] Finding 필터/그룹핑**: `LatestAnalysisTab`에 심각도 필터 탭 + 그룹핑 전환(심각도별/파일별/상태별) 추가. "기타" 56건 문제 해소
   - **네비게이션 가드**: `AnalysisGuardContext` 신규 — 분석 진행 중 사이드바 클릭 시 확인 다이얼로그 표시
