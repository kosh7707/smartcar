# LLM Gateway (S3)

자동차 전장부품 사이버보안 검증 프레임워크의 LLM 연동 게이트웨이 서비스.

## 역할

Core Service(S2)로부터 분석 요청을 받아 프롬프트를 조립하고,
LLM(또는 Mock)에 전달하여 파싱된 취약점 분석 결과를 반환한다.

## 실행

```bash
cd services/llm-gateway
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| SMARTCAR_LLM_MODE | mock | `mock`: Mock 응답 / `real`: 실 LLM 연동 |
| SMARTCAR_LLM_ENDPOINT | http://localhost:8080 | LLM Engine(S4) 엔드포인트 |
| SMARTCAR_LLM_MODEL | qwen-14b | 사용할 모델명 |
| SMARTCAR_LLM_API_KEY | (빈 문자열) | API 키 (필요 시) |

## API

- `POST /api/llm/analyze` — LLM 분석 요청
- `GET /health` — 헬스체크

상세: [API 명세](../../docs/api/llm-gateway-api.md)

## 실 LLM 전환

```bash
export SMARTCAR_LLM_MODE=real
export SMARTCAR_LLM_ENDPOINT=http://dgx-spark:8080
export SMARTCAR_LLM_MODEL=qwen-14b
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

환경변수만 바꾸면 동일 코드로 실 LLM이 연동됩니다.

## 내부 구조

```
app/
├── main.py                 # FastAPI 앱 진입점
├── config.py               # 설정 (환경변수 → Settings)
├── routers/
│   ├── analyze.py          # POST /api/llm/analyze
│   └── health.py           # GET /health
├── schemas/
│   ├── request.py          # 요청 Pydantic 모델
│   └── response.py         # 응답 Pydantic 모델
├── services/
│   ├── prompt_builder.py   # 모듈별 프롬프트 조립
│   ├── llm_client.py       # LlmClient ABC + Mock/Real 구현
│   └── response_parser.py  # LLM 응답 → 구조화 JSON 변환
└── templates/
    ├── static_analysis.py  # 정적 분석 프롬프트 템플릿
    ├── dynamic_analysis.py # 동적 분석 프롬프트 템플릿
    └── dynamic_testing.py  # 동적 테스트 프롬프트 템플릿
```
