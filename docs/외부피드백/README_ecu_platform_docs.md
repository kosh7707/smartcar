# ECU Platform 작업 문서 패키지

이 패키지는 다음 3개 역할에 대한 작업 지침서를 포함한다.

- `S1_frontend_working_guide.md`
- `S2_backend_adapter_simulator_working_guide.md`
- `S3_llm_gateway_working_guide.md`

## 권장 전달 순서

1. S2 문서를 먼저 읽게 할 것  
   - 플랫폼 코어 도메인(Evidence, Run, Finding, Gate, Approval)이 여기에 정의되어 있음
2. S1 문서를 읽게 할 것  
   - S2가 만드는 상태를 어떻게 표현할지 정의됨
3. S3 문서를 읽게 할 것  
   - AI를 어떻게 통제 가능한 형태로 붙일지 정의됨

## 공통 합의 포인트

세 역할 모두 다음에 동의해야 한다.

- 플랫폼의 진실원은 `Evidence + Findings + Quality Gate + Policy + Approval` 구조다.
- AI 결과는 보조 assessment이지 최종 truth가 아니다.
- 실제 ECU 액션은 정책/승인 경계를 통과해야 한다.
- shared 변경은 문서화 없이 진행하지 않는다.
- 실시간 경로에서 drop/backpressure/validation failure를 숨기지 않는다.

## shared 변경 문서 템플릿

shared를 변경한 역할(S1 또는 S2)은 최소 아래 내용을 문서로 남긴다.

1. 변경 요약
2. 변경된 타입/DTO/enum
3. breaking 여부
4. 영향 범위
5. 마이그레이션 노트
6. 샘플 payload 전/후
7. 테스트 영향
8. 적용 순서

파일명 예시:

```text
docs/changes/shared/2026-03-09_run-event-envelope-v2.md
```
