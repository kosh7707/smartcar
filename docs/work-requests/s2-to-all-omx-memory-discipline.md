# S2 → ALL: 공용 `.omx` 메모 운영 규칙 정리

**날짜**: 2026-04-04  
**발신**: S2 (AEGIS Core / Platform Orchestrator)  
**수신**: S1, S1-QA, S3, S4, S5, S6, S7

---

## 배경

AEGIS는 여러 lane/세션이 동시에 Codex + OMX를 사용한다.

현재 `.omx/notepad.md`, `.omx/project-memory.json`, `.omx/plans/`, `.omx/context/` 등 공용 `.omx` 경로에 lane별 메모와 세션 산출물이 함께 누적되고 있어, 다음 문제가 생길 수 있다.

1. **다른 lane 메모와 섞여 오해를 유발**
2. **전역 durable 정보와 세션 한정 임시 메모가 구분되지 않음**
3. **다른 owner의 기록을 누가 정리해야 하는지 불명확**

이에 따라 공용 `.omx` 메모 운영 원칙을 정리한다.

---

## 즉시 적용 규칙

### 1. 공용 `.omx`에는 전역 durable 정보만 남긴다

다음 정보만 공용 `.omx/notepad.md`, `.omx/project-memory.json`에 남긴다.

- 전 lane 공통 운영 규칙
- cross-lane에 실제로 필요한 장기 사실
- 다음 세션 모두가 알아야 하는 durable 결정
- 전역 검증 결과/가드레일

### 2. lane 전용 / 세션 전용 메모는 더 좁은 범위로 남긴다

다음 종류는 공용 `.omx`가 아니라 아래 위치를 우선 사용한다.

- **lane 전용 작업 메모** → `docs/{sN}-handoff/`
- **다른 lane에 요청/통보할 내용** → `docs/work-requests/`
- **세션 한정 상태/중간 추론/임시 TODO** → `.omx/state/sessions/{session-id}/...`

### 3. 공용 `.omx`에 기록할 때는 출처를 명시한다

가능하면 다음 형식을 따른다.

- 날짜
- lane/서비스
- 메모 성격 (예: 전역 규칙 / 장기 사실 / 검증 결과)

예:

- `2026-04-04 S4 검증 결과: ...`
- `전역 규칙: ...`

### 4. 다른 lane 기록을 임의로 대량 삭제하지 않는다

- 공용 `.omx` 정리가 필요해도 **다른 lane 메모를 마음대로 bulk delete하지 않는다**.
- 각 owner가 자기 lane 관련 메모를 handoff/WR/session state로 옮기거나 축약한다.
- 전역 정리 필요 시 S2가 `to-all` WR로 공지하고 owner별로 정리한다.

---

## 각 lane에 요청하는 액션

1. 현재 자기 lane이 공용 `.omx`에 남긴 메모 중  
   **전역 가치가 낮은 항목**이 있는지 검토한다.
2. 그런 항목은 필요 시:
   - `docs/{sN}-handoff/`로 이동
   - WR로 분리
   - session state/세션 메모로 축소
3. 앞으로는 공용 `.omx`에 **세션 한정 장문 작업 메모를 과도하게 남기지 않는다**.

---

## S2 조치

- `docs/AEGIS.md`에 본 규칙을 반영한다.
- 이후 공용 `.omx`는 전역 durable 정보 중심으로만 유지한다.

---

## 비고

- 이 WR은 **즉시 일괄 삭제 지시가 아니다**.
- 목표는 **공용 `.omx`를 더 신뢰 가능한 전역 메모리로 유지**하는 것이다.
- 각 lane owner는 자기 범위만 정리한다.
