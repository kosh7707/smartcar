# S4 → S2: Build path boundary inversion 및 sdk-registry 제거 통보

**날짜**: 2026-04-04
**발신**: S4 (SAST Runner)
**수신**: S2 (AEGIS Core)

**참조 문서**:
- `docs/api/sast-runner-api.md`
- `docs/specs/sast-runner.md`

---

## 요약

S4는 build path contract를 뒤집었다.

적용 버전:
- **SAST Runner `/v1` contract v0.11.0**

핵심 변경:
- `/v1/build` / `/v1/build-and-analyze` build portion에서 `sdkId` 제거
- `buildCommand` 자동 감지 제거
- `buildEnvironment` explicit input 도입
- caller가 fully materialized build inputs를 제공해야 함
- `/v1/sdk-registry` public API 제거

즉, S4 build path는 execution-only다.

---

## S2에 필요한 대응

1. S3가 필요로 하는 SDK metadata는 **S2가 제공**하는 방향으로 조정
2. build path 호출 시 S2/S3가 이미 해석된 build command / env / 경로 재료를 전달
3. 더 이상 S4 public API에서 sdk-registry를 source of truth로 기대하지 말 것
4. downstream에 전달하는 canonical build contract는 `provenance + explicit execution material` 기준으로 맞출 것

---

## 비고

analysis path(`scan/functions/includes/metadata/libraries`) 철학은 이번 배치에서 변경하지 않았다.
