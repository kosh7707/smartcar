# S1 Session 9 — 2026-03-24

## 완료된 작업

26. ✅ 업로드 엔드포인트 통합 — 파일 유형 분기 로직 제거, `uploadSource` 단일 엔드포인트
27. ✅ LLM 직접 통신 제거 — StatusBar/OverviewPage/ProjectSettingsPage에서 상태 칩 제거, 백엔드 연결 끊김 시 토스트 방식
28. ✅ 업로드 비동기 + WS 프로그레스 — `useUploadProgress` 훅 (received→extracting→indexing→complete), 202 Accepted 방식
29. ✅ 파일 확장자 필터 완전 제거 — S2 서버 측 500MB 제한으로 충분
30. ✅ 파일 유형 메타데이터 (fileType 12종, previewable) — 파일별 아이콘 분기 (FileCode/Terminal/Wrench/Settings/BookOpen/Binary/Archive 등)
31. ✅ 코드 하이라이팅 — highlight.js 14개 언어 (C/C++/Shell/CMake/Python/JSON/YAML 등), 라이트/다크 테마, 5곳 적용 (FileDetail/VulnDetail/SourceTree/markdown/fixCode)
32. ✅ 마크다운 렌더러 → react-markdown + remark-gfm 교체 (GFM 테이블/링크/인용 완전 지원)
33. ✅ 파일 디테일 헤더 고도화 — 언어별 아이콘, 경로 표시, pill 뱃지 (언어/크기/줄 수/취약점), Maximize 전체 화면
34. ✅ 마크다운 프리뷰 탭 — .md 파일에서 코드/프리뷰 탭 전환
35. ✅ 파일 구성 서버 composition — S2가 GitHub Linguist 스타일 집계 제공, 프론트 LANG_GROUPS 조합 불필요
36. ✅ 코드 뷰어 CSS 개선 — 라이트 모드 밝은 배경, 주석 가독성 향상, 25줄 max-height
37. ✅ 토스트 5초 지속, 불투명 배경 + backdrop-filter
38. ✅ 서브 프로젝트 파이프라인 UI — `usePipelineProgress` WS 훅, `TargetStatusBadge` (12상태), `TargetProgressStepper` (5단계 스테퍼), BuildTargetSection 파이프라인 제어 패널
39. ✅ 서브 프로젝트 생성 — `SubprojectCreateDialog` 체크박스 파일 트리, `includedPaths` 지원 (공유 라이브러리 포함 가능)
40. ✅ 언어 분류 대폭 확장 — Shell/Build/Config/Docs/Assembly/Linker + inferLanguage 자동 추론
41. ✅ 폴더 접힘 상태 sessionStorage 유지
42. ✅ pipeline/upload/source API 다수 추가
43. ✅ 테스트 195건 (유닛 89 + 상수 26 + API 11 + 훅 14 + 컴포넌트 39 + 컨텍스트 6 + UI 7 + CVE 3)
