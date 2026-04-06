# AEGIS — Automotive Embedded Governance & Inspection System

자동차 임베디드 소프트웨어 보안 취약점 종합 검증 플랫폼.

## Documentation

- Canonical agent-facing wiki: `/home/kosh/aegis-static-wiki`
- Start at: `/home/kosh/aegis-static-wiki/wiki/system/index.md`
- Local repo docs are intentionally reduced to:
  - `docs/AEGIS.md`
  - `docs/mcp.md`
- Use `/home/kosh/aegis-static-wiki/wiki/system/migration-map.md` to resolve legacy `docs/**` references that still appear in comments or historical notes.

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

## Services (7인 체제, 8서비스)

| ID | 서비스 | 포트 | 스택 |
|----|--------|------|------|
| S1 | Frontend + QA | 5173 | Vite + React + TypeScript |
| S2 | AEGIS Core (Backend) | 3000 | Express 5 + TypeScript + SQLite |
| S3 | Analysis Agent | 8001 | Python + FastAPI |
| S3 | Build Agent (S3 겸임) | 8003 | Python + FastAPI |
| S4 | SAST Runner | 9000 | Python + FastAPI |
| S5 | Knowledge Base | 8002 | Python + FastAPI + Neo4j + Qdrant |
| S6 | Dynamic Analysis (Adapter + ECU Sim) | 4000 | TypeScript |
| S7 | LLM Gateway + Engine | 8000, DGX | Python + FastAPI + vLLM |
