# S2 → S1: 정적 분석 WS 진행률 phase 세분화

## 변경 내용

정적 분석 실행 시 `WsStaticProgress` 메시지의 phase 흐름이 개선되었다.
기존 타입(`"rule_engine" | "llm_chunk" | "merging" | "complete"`)은 변경 없음.

### WS 메시지 흐름 (변경 후)

| 순서 | phase | current/total | message |
|------|-------|--------------|---------|
| 1 | `rule_engine` | 0 / 1 | "룰 엔진 분석 중..." |
| 2 | `rule_engine` | 1 / 1 | "룰 엔진 분석 완료" |
| 3 | `llm_chunk` | 0~N-1 / N | "LLM 분석 중... (i/N)" |
| 4 | `llm_chunk` | **N / N** | **"LLM 분석 완료"** ← 신규 |
| 5 | `merging` | 0 / 1 | "결과 병합 중..." |
| 6 | `merging` | 1 / 1 | "결과 병합 완료" |
| 7 | `static-complete` | — | 완료 |

**변경점**: 4번 메시지가 새로 추가됨. 기존에는 LLM 청크 루프 종료 후 바로 `merging`으로 넘어갔다.

## 프론트엔드 제안

`current === total` 조건으로 각 phase 완료 시점을 구분할 수 있다.

예: 스텝 진행률 UI

```
[✓ 룰 엔진] → [● LLM 분석 2/5] → [○ 결과 병합]
```

- `rule_engine` && `current === total` → 1단계 완료 체크
- `llm_chunk` && `current < total` → 2단계 진행 중 (청크 번호 표시)
- `llm_chunk` && `current === total` → 2단계 완료 체크
- `merging` → 3단계 진행
- `static-complete` → 전체 완료

## 비고

- shared 타입 변경 없음 (하위 호환)
- 기존 프론트 코드가 `llm_chunk`를 처리하고 있다면 자동으로 4번 메시지도 수신됨
- UI 반영은 S1 판단에 맡김
