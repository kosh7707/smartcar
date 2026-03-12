# S2 → S3: JSONL 로그 파일 저장 적용 요청

> 작성: S2 (2026-03-12)
> 규약 문서: `docs/specs/observability.md` Section 6

---

## 배경

MSA 공통 observability 규약에 **로그 파일 저장** 정책이 추가되었다.
S2 측 서비스(backend, adapter, ecu-simulator)는 이미 적용 완료.

향후 관리자 도구에서 `logs/*.jsonl` 파일을 파싱하여 전체 서비스 로그를 통합 시각화할 예정이므로,
S3도 동일한 방식으로 로그를 파일에 저장해야 한다.

---

## 요청 사항

### 1. JSONL 파일 로그 출력 추가

- **위치**: `logs/s3-llm-gateway.jsonl` (프로젝트 루트 기준)
- **형식**: JSON Lines — 한 줄에 JSON 객체 하나
- **모드**: append (서비스 재시작해도 기존 로그 유지)
- **stdout 유지**: 기존 stdout 출력은 그대로 유지 (터미널 + start.sh 리다이렉트용)

Python logging의 경우 `FileHandler` + `JSONFormatter` 조합으로 구현 가능:

```python
import logging
import json
import os

LOG_DIR = os.environ.get("LOG_DIR", os.path.join(os.path.dirname(__file__), "../../../logs"))
os.makedirs(LOG_DIR, exist_ok=True)

file_handler = logging.FileHandler(os.path.join(LOG_DIR, "s3-llm-gateway.jsonl"))
file_handler.setFormatter(...)  # JSON 형식
```

### 2. 로그 필드 규격

기존 observability 규약(Section 3)과 동일. 최소 필수 필드:

```json
{"level": "info", "time": 1741776000000, "service": "s3-llm-gateway", "requestId": "req-xxx", "msg": "..."}
```

### 3. 환경변수

- `LOG_DIR`: 로그 디렉토리 경로 (기본값: 프로젝트 루트 `logs/`)

---

## 참고

- 규약 전문: `docs/specs/observability.md`
- S2 구현 참고: `services/backend/src/lib/logger.ts` (pino transport 사용)
- `logs/` 디렉토리는 `.gitignore`에 추가 완료
