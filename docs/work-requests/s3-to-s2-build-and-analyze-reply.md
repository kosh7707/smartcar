# S3 → S2: Phase 1 빌드 자동화 진행 상황 회신

> **작성일**: 2026-03-19
> **발신**: S3 (Analysis Agent)
> **수신**: S2 (AEGIS Core)
> **원본 요청**: `s2-to-s3-build-and-analyze-status.md`

---

## 1. 진행 상황

**`build-and-analyze` 통합은 아직 미착수입니다.** 오늘은 다른 고도화 작업에 집중했습니다:

| 완료 항목 | 설명 |
|----------|------|
| S7 분리 | LLM Gateway + Engine을 S7으로 분리, Agent는 Gateway 경유 |
| Phase 1 확장 | KB 위협 조회 + CVE 실시간 조회 + 위험 호출자 (결정론적 3건 추가) |
| 프롬프트 재설계 | 포매터 → 분석가 임무 중심 4단계 |
| 테스트 | 96 → 114 tests |
| 모델 전환 준비 | 122B-INT4 벤치 완료, 전환 승인 (S7 작업 중) |

## 2. 현재 상태에서 동작하나요?

**`files[]`를 보내면 지금도 동작합니다.** 현재 Phase 1은:

```
files[] → S4 /v1/scan (SAST)
files[] → S4 /v1/functions (코드 그래프)
projectPath → S4 /v1/libraries (SCA) — 선택
```

`projectPath`만 보내서 `build-and-analyze` 한 방에 처리하는 건 미구현. 당장 연동 테스트를 하려면 **S2가 소스 파일을 읽어서 `files[]`에 넣어주시면** 현재 코드로 E2E가 가능합니다.

## 3. 연동 테스트 제안

`build-and-analyze` 통합을 기다리지 말고, **현재 상태에서 먼저 연동 테스트**하는 것을 제안합니다:

```json
{
  "taskType": "deep-analyze",
  "taskId": "e2e-test-001",
  "context": {
    "trusted": {
      "objective": "프로젝트 보안 취약점 심층 분석",
      "files": [
        {"path": "src/main.c", "content": "...소스코드..."}
      ],
      "projectId": "test-project",
      "projectPath": "/home/kosh/AEGIS/uploads/test-project",
      "buildProfile": {
        "compiler": "gcc",
        "languageStandard": "c17"
      }
    }
  },
  "evidenceRefs": [
    {"refId": "eref-file-00", "artifactId": "art-001", "artifactType": "raw-source", "locatorType": "lineRange", "locator": {"file": "src/main.c", "fromLine": 1, "toLine": 999}}
  ],
  "constraints": {"maxTokens": 4096, "timeoutMs": 300000}
}
```

S2가 `files[]`를 C/C++ 파일만 필터링해서 채우면 현재 코드로 바로 돌아갑니다.

## 4. build-and-analyze 통합 예상

S7 모델 전환 + 라이브 검증이 끝나면 착수 예정. S4의 `POST /v1/build-and-analyze`를 Phase 1에 통합하여 `projectPath` 하나로 모든 것을 처리하는 경로를 추가합니다.

현재 `files[]` 경로는 그대로 유지 (fallback).
