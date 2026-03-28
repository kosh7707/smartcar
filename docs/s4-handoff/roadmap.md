# S4 SAST Runner — 로드맵

> 다음 작업 + 후순위 계획. README.md에서 분리.
> **마지막 업데이트: 2026-03-28**

---

## 즉시 다음

없음. 외부 피드백 전건 반영 완료, 문서 전면 갱신 완료 (specs v0.7.0, API v0.7.0). 통합테스트 대기.

---

## 잔여 고도화 (후순위)

- CWE-457 (56%) 추가 개선 — gcc-fanalyzer 한계, Semgrep 불가. 도구 자체 한계로 당장 개선 여지 적음
- code graph 품질 평가 기준 수립 — S5(KB) 연동 후 의미 있음. 통합테스트 이후

---

## 알려진 이슈

- tinydtls 버전: `libcoap/ext/tinydtls`에 configure.ac 없음 -> 버전 미탐지
- wakaama 버전: 하위 tinydtls의 configure.ac를 잡아서 오탐
- clang-tidy + compile_commands.json: `-p` 연동 불안정
- `build-and-analyze`: 빌드 환경(SDK, 컴파일러)이 서버에 설치되어 있어야 함
