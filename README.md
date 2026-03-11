# Smartcar Security Framework

차량 보안 분석 운영 콘솔 프로토타입.

## Prerequisites

| 도구 | 용도 |
|------|------|
| **Node.js** (v18+) | Backend, Adapter, ECU Simulator, Frontend |
| **Python 3.10+** | LLM Gateway (FastAPI) |
| **lsof** | 포트 헬스체크 (start.sh 내부에서 사용) |

## Setup

```bash
# 1. Node 의존성 설치 (루트 workspaces + 개별 서비스)
npm install
cd services/adapter && npm install && cd ../..
cd services/ecu-simulator && npm install && cd ../..

# 2. LLM Gateway Python 환경
cd services/llm-gateway
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
deactivate
cd ../..
```

## Run

```bash
./scripts/start.sh            # 전체 기동
./scripts/stop.sh             # 전체 종료
```

### start.sh 옵션

| 옵션 | 설명 |
|------|------|
| `--no-ecu` | ECU Simulator 미기동 |
| `--no-frontend` | Frontend 미기동 |
| `--scenario=NAME` | ECU 시나리오 (기본: mixed) |
| `--speed=N` | ECU 트래픽 속도 (기본: 1) |

## Services

| 서비스 | 포트 | 스택 |
|--------|------|------|
| LLM Gateway | 8000 | Python / FastAPI |
| Adapter | 4000 | TypeScript |
| Backend | 3000 | TypeScript |
| ECU Simulator | — | TypeScript |
| Frontend | 5173 | Vite + React |
