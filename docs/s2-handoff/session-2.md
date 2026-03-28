# 세션 2 — 버그 수정 + S1 WR 처리

**날짜**: 2026-03-17

---

- Run 타임스탬프 0초 버그 수정: NormalizerContext.startedAt 추가
- mergeAndSort undefined-location 중복 제거 버그 수정: mergeAndDedup() 순수 함수 추출
- 보고서 API 500 에러 수정: non-null assertion 제거 + try-catch
- findingCount 불일치 해소 (mergeAndDedup 수정으로)
- 테스트 133개 통과 (기존 118 + 신규 15)
