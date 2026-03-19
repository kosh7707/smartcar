# S6. Dynamic Analysis 인수인계서

> **반드시 `docs/AEGIS.md`를 먼저 읽을 것.** 프로젝트 공통 제약 사항, 역할 정의, 소유권이 그 문서에 있다.
> 이 문서는 S6(Dynamic Analysis) 개발을 이어받는 다음 세션을 위한 인수인계서다.
> 이것만 읽으면 현재 상태를 파악하고 바로 작업을 이어갈 수 있어야 한다.
> **마지막 업데이트: 2026-03-18 (이관 완료 세션)**

---

## 1. S6의 역할

AEGIS 플랫폼의 **동적 분석 인프라**를 담당한다. ECU와의 CAN 통신을 시뮬레이션하고, S2(AEGIS Core)가 동적 분석/동적 테스트를 수행할 수 있도록 CAN 프레임 중계 인프라를 제공한다.

### 소유 서비스

| 서비스 | 디렉토리 | 포트 | 역할 |
|--------|----------|------|------|
| **Adapter** | `services/adapter/` | :4000 | ECU ↔ Backend WS 릴레이 |
| **ECU Simulator** | `services/ecu-simulator/` | standalone | CAN 트래픽 생성 + 주입 응답 시뮬레이션 |

### 통신 구조

```
ECU Simulator ──WS──→ Adapter (:4000/ws/ecu)
                          ↕
                     S2 (AEGIS Core :3000) ──WS──→ Adapter (:4000/ws/backend)
```

- ECU Simulator → Adapter: 1:1 연결 (CAN 프레임 전송)
- S2 → Adapter: N:1 연결 (CAN 프레임 수신 + 주입 요청)
- 추후 실 ECU 연결 시 ECU Simulator 대신 실 ECU가 Adapter에 연결

---

## 2. 소유 파일

### 코드
- `services/adapter/src/` — index.ts, relay.ts, protocol.ts, logger.ts
- `services/ecu-simulator/src/` — index.ts, ecu-engine.ts, scenarios.ts, traffic-generator.ts, protocol.ts, logger.ts

### 문서
- `docs/specs/adapter.md` — Adapter 기능 명세 (S6 소유)
- `docs/specs/ecu-simulator.md` — ECU Simulator 기능 명세 (S6 소유)
- `docs/api/adapter-api.md` — Adapter WS API 계약서 (S6 소유, S2 검토 승인 완료, AEGIS.md 등재)
- `docs/s6-handoff/README.md` — 이 인수인계서

### 인프라
- `services/adapter/.env` — Adapter 환경변수 (S6 관리)
- `services/ecu-simulator/.env` — ECU Simulator 환경변수 (S6 관리)
- `scripts/start-adapter.sh` — Adapter 기동 스크립트 (존재, `start.sh`/`stop.sh`에 통합 완료)
- `scripts/start-ecu-sim.sh` — ECU Simulator 기동 스크립트 (존재, `start.sh`/`stop.sh`에 통합 완료)

---

## 3. 현재 구현 상태

### Adapter (`services/adapter/`)
- Express.js + ws 기반 경량 릴레이
- ECU 측 WS: `/ws/ecu` (1:1)
- Backend 측 WS: `/ws/backend` (1:N)
- CAN 프레임 양방향 중계
- ECU 메타데이터(`ecu-info`) 수신 시 Backend에 전파
- inject-request/inject-response 요청-응답 패턴
- 구조화 로깅 (pino, `logs/adapter.jsonl`)

### ECU Simulator (`services/ecu-simulator/`)
- Adapter의 `/ws/ecu`에 WS 클라이언트로 연결
- 시나리오 기반 CAN 트래픽 생성 (mixed, normal)
- 주입 응답 규칙: 0xFF→crash, 0x7DF→reset, 0x00→malformed, 반복3회→anomaly, 경계값→timeout(2000ms)
- CLI 옵션: `--adapter`, `--scenario`, `--speed`, `--loop`
- 구조화 로깅 (pino, `logs/ecu-simulator.jsonl`)

### 상세 명세
- Adapter: `docs/specs/adapter.md`
- ECU Simulator: `docs/specs/ecu-simulator.md`

---

## 4. 환경변수

| 서비스 | .env 위치 | 주요 변수 |
|--------|----------|----------|
| Adapter | `services/adapter/.env` | `PORT`, `LOG_DIR`, `LOG_LEVEL` |
| ECU Simulator | `services/ecu-simulator/.env` | `ADAPTER_URL`, `SCENARIO`, `SPEED`, `LOG_DIR`, `LOG_LEVEL` |

---

## 5. S2와의 관계

- **S2가 Adapter를 호출하는 쪽이다.** S2의 `AdapterManager` → `AdapterClient`가 Adapter에 WS로 연결.
- S6는 Adapter/ECU Simulator의 **내부 구현**을 소유하고, S2는 **호출자**이다.
- Adapter의 WS 프로토콜(메시지 형식)을 변경하면 S2에 영향이 있으므로 **반드시 work-request로 고지**.
- **WS 계약서**: `docs/api/adapter-api.md`가 S2↔S6 간 WS 프로토콜의 유일한 진실 소스. 변경 시 계약서 갱신 + S2에 WR 필수.

---

## 6. 로드맵 (S2가 제시한 우선순위: 1→3)

> S2 우선순위: (1) WS 계약서 작성 **완료** → (2) 멀티 ECU 지원 → (3) CAN FD 지원

### Adapter 고도화
- [ ] capability discovery — 지원하는 것만 `supported=true`, 나머지 `not_supported`
- [ ] canonical error / canonical status 정규화
- [ ] 안전 제어: dry-run mode, session timeout, max request rate
- [ ] Adapter 계약 테스트

### Simulator 고도화
- [ ] fault model simulator — timeout, delayed response, malformed frame, negative response burst, security access failure, ECU reset, session lockout
- [ ] replay bench — 저장된 capture 재생, deterministic seed 지원
- [ ] 상태 공개 API (current profile, fault mode, session state, reset count)
- [ ] 회귀 테스트 환경

### 에이전트 시대 비전 (S4 제안)
- S6가 에이전트의 tool로 동작 — `dynamic.inject`, `dynamic.capture` 같은 tool call을 S3 Agent가 호출
- 정적 분석(S4) 결과 + 동적 분석(S6) 결과를 LLM이 통합 판단

---

## 7. 참고 문서

| 문서 | 경로 | 용도 |
|------|------|------|
| 공통 제약 사항 | `docs/AEGIS.md` | **필독** |
| Adapter WS 계약서 | `docs/api/adapter-api.md` | **S6 소유** — S2↔S6 WS 프로토콜 유일한 진실 소스 |
| Adapter 명세 | `docs/specs/adapter.md` | S6 소유 |
| ECU Simulator 명세 | `docs/specs/ecu-simulator.md` | S6 소유 |
| S2 인수인계서 | `docs/s2-handoff/README.md` | S2가 Adapter를 어떻게 호출하는지 이해 |
| S2 백엔드 명세 | `docs/specs/backend.md` | 동적 분석 파이프라인 상세 |
