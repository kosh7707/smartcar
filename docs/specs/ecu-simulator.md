# ECU Simulator 기능 명세

> 가상 ECU — CAN 트래픽 생성 + 주입 응답 시뮬레이션
> Adapter의 `/ws/ecu` 엔드포인트에 WS 클라이언트로 연결

---

## 역할

ECU Simulator는 실제 ECU 대신 CAN 트래픽을 생성하고, Backend의 주입 요청에 시나리오 기반으로 응답하는 **테스트용 가상 ECU**다.

```
ECU Simulator —WS→ Adapter (:4000/ws/ecu)
                      ↓
               Backend (S2)가 CAN 프레임 수신 + 주입 요청 전송
```

추후 실 ECU를 연결하면 이 시뮬레이터 대신 실 ECU가 Adapter에 연결된다.

---

## 파일 구조

```
services/ecu-simulator/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts              # 진입점: WS 연결 + 메시지 라우팅
    ├── protocol.ts           # 메시지 타입 정의
    ├── ecu-engine.ts         # 주입 요청 처리 (응답 규칙)
    ├── scenarios.ts          # CAN 트래픽 시나리오 정의
    ├── traffic-generator.ts  # 비동기 프레임 생성기
    └── logger.ts             # 구조화 로깅 (pino)
```

---

## 실행

```bash
cd services/ecu-simulator && npx tsx watch src/index.ts \
  --adapter=ws://localhost:4000/ws/ecu --scenario=mixed --speed=1 --loop

# 또는 전체 기동
./scripts/start.sh
```

| CLI 인자 | 기본값 | 설명 |
|---------|--------|------|
| `--adapter` | `ws://localhost:4000/ws/ecu` | Adapter WS URL |
| `--scenario` | `mixed` | 시나리오 이름 (`mixed`, `normal`) |
| `--ecu-name` | `ECU_SIM` | ECU 식별자 (ecu-info 메시지에 포함) |
| `--speed` | `1` | 속도 배율 (높을수록 빠름) |
| `--loop` | `false` (플래그) | 시나리오 무한 반복 |

---

## 연결 시 ECU 메타 전송

Adapter에 연결되면 트래픽 생성 **전에** `ecu-info` 메시지를 전송한다.

```jsonc
// ECU → Adapter (ecu-info) — 연결 직후 1회
{
  "type": "ecu-info",
  "ecu": {
    "name": "ECU_SIM",                          // --ecu-name 인자값
    "canIds": ["0x100", "0x200", "0x300", "0x500"]  // 시나리오 phases에서 추출한 고유 CAN ID
  }
}
```

- `name`: `--ecu-name` CLI 인자 (기본값 `ECU_SIM`)
- `canIds`: 현재 시나리오의 모든 phase → steps에서 `canId`를 추출하고 중복 제거
- Adapter가 이 메타를 저장하여 Backend에 릴레이 → 프론트엔드에서 ECU 식별에 활용

---

## 세 가지 기능

### 1. CAN 트래픽 생성 (자동, 시나리오 기반)

시나리오에 정의된 CAN 프레임을 일정 간격으로 생성하여 Adapter에 전송한다.

```jsonc
// ECU → Adapter (can-frame)
{
  "type": "can-frame",
  "frame": {
    "timestamp": "2026-03-08T14:23:45.123Z",
    "id": "0x100",
    "dlc": 8,
    "data": "DE AD BE EF 01 02 03 04"
  }
}
```

**프레임 간격**: `max(10, round(50 / speed))` ms

| speed | 간격 | 초당 프레임 |
|-------|------|------------|
| 1 | 50ms | ~20fps |
| 2 | 25ms | ~40fps |
| 5 | 10ms | ~100fps |

### 2. ECU 메타 전송 (자동, 연결 시 1회)

위 "연결 시 ECU 메타 전송" 섹션 참조.

### 3. 주입 응답 (수동, Backend 요청에 반응)

Backend가 동적 테스트 중 `inject-request`를 보내면, ECU Engine이 시나리오 기반으로 응답한다.

```
Backend → inject-request → Adapter → ECU Simulator
                                         ↓
                                    EcuEngine.processInjection(frame)
                                         ↓
ECU Simulator → inject-response → Adapter → Backend
```

---

## 주입 응답 규칙 (EcuEngine)

모든 요청에 기본 지연 10~50ms (랜덤)를 적용한 뒤, 아래 규칙을 **순서대로** 매칭한다.

| 우선순위 | 조건 | 응답 | 용도 |
|---------|------|------|------|
| 1 | 데이터가 모두 `0xFF` (8바이트) | `success: false, error: "no_response"` | 크래시/ECU 무응답 시뮬레이션 |
| 2 | CAN ID = `0x7DF` 또는 `7DF` | `success: false, error: "reset"` | 진단 요청 → ECU 리셋 |
| 3 | 데이터가 모두 `0x00` (8바이트) | `success: true, error: "malformed"` | 비정상 응답 형식 |
| 4 | 동일 프레임 3회 이상 반복 | `success: true, error: "malformed"` | 리플레이 공격 탐지 |
| 5 | 데이터에 `0x7F` 또는 `0x80` 포함 | `success: true, error: "delayed", delayMs: 2000` | 경계값 → 지연 응답 |
| 6 | 그 외 | `success: true, data: "랜덤 8바이트 hex"` | 정상 응답 |

**반복 프레임 추적**: `${canId}:${data}` 시그니처별 카운터 관리. 3회 이상 동일 프레임 수신 시 "malformed" 반환.

**지연 응답**: 규칙 5에 해당하면 기본 지연(10~50ms) + 추가 2000ms = 총 ~2010~2050ms 소요.

---

## 시나리오

### `mixed` (기본값) — 정상 + 공격 혼합

총 500 프레임, 7개 페이즈:

| 페이즈 | 이름 | 프레임 수 | CAN ID | 설명 |
|--------|------|----------|--------|------|
| 1 | Normal traffic | 100 | 0x100~0x500 | 랜덤 페이로드 정상 트래픽 |
| 2 | Diagnostic DoS | 50 | 0x7DF | burst=10, 진단 요청 폭주 |
| 3 | Normal recovery | 50 | 0x100~0x500 | 공격 후 정상 트래픽 복원 |
| 4 | Unauthorized ID | 50 | 0x100~0x500 + **0x666** | 비인가 CAN ID 삽입 |
| 5 | Normal traffic | 100 | 0x100~0x500 | 정상 트래픽 |
| 6 | Replay attack | 50 | 0x100 | 고정 페이로드 `DE AD BE EF 01 02 03 04` 반복 |
| 7 | Normal finish | 100 | 0x100~0x500 | 마무리 정상 트래픽 |

**공격 시나리오 설계 의도**:
- 페이즈 2 (Diagnostic DoS) → 빈도 급증 + 진단 ID(0x7DF) 패턴으로 DoS 탐지 테스트
- 페이즈 4 (Unauthorized ID) → 비인가 CAN ID(0x666) 삽입으로 허용 목록 검증 테스트
- 페이즈 6 (Replay Attack) → 동일 프레임 반복으로 리플레이 공격 탐지 테스트

### `normal` — 정상 트래픽만

| 페이즈 | 이름 | 프레임 수 | CAN ID | 설명 |
|--------|------|----------|--------|------|
| 1 | Normal traffic | 500 | 0x100~0x500 | 랜덤 페이로드만 |

베이스라인 테스트용. 공격 없이 정상 트래픽만 생성.

---

## CAN 프레임 생성 규칙

- **CAN ID**: 시나리오 step에 정의된 ID 목록에서 순환 선택
- **DLC**: 8 (고정)
- **데이터**: step의 `data`가 고정 문자열이면 그대로, `"random"`이면 랜덤 8바이트 hex
- **Burst**: step에 `burst: N`이 있으면 동일 프레임을 N회 연속 전송 (DoS 시뮬레이션)
- **타임스탬프**: 전송 시점의 `new Date().toISOString()`

---

## 자동 재연결

Adapter와의 연결이 끊기면 **3초 후** 자동 재연결 시도. 재연결 성공 시 트래픽 생성 재개.

---

## 로깅

| 항목 | 값 |
|------|-----|
| 로그 파일 | `logs/ecu-simulator.jsonl` |
| 형식 | JSON structured (observability.md 준수) |
| 필수 필드 | `level`, `time` (epoch ms), `service` ("s6-ecu"), `msg` |
| 라이브러리 | pino |

주요 로그 이벤트:
- Adapter 연결/해제
- ecu-info 전송
- Phase 시작 (이름, 프레임 수)
- 트래픽 진행 (100프레임 단위)
- inject-request 수신 및 처리
- inject-response 전송 (requestId, success)

---

## 제약사항

- 단일 Adapter에만 연결 (멀티 Adapter 미지원)
- 반복 프레임 카운터가 자동 초기화되지 않음 (프로세스 재시작 필요)
- 시나리오 2개만 제공 (`mixed`, `normal`). 추가 시 `scenarios.ts` 수정
- 바이너리 CAN 프레임이 아닌 hex 문자열로 전송 (프로토타입 단계)
