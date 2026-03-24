# Adapter WebSocket API 명세 (v0.1.0)

> **AEGIS — Automotive Embedded Governance & Inspection System**
>
> S2(AEGIS Core)가 Adapter를 통해 ECU와 실시간 CAN 프레임을 교환할 때 참조하는 API 계약서.
> Adapter는 ECU ↔ Backend 간 **WebSocket 릴레이**로, 모든 메시지는 JSON 텍스트 프레임이다.

---

## Base URL

```
ws://localhost:4000
```

HTTP(Health 전용):
```
http://localhost:4000
```

---

## 엔드포인트 요약

| 프로토콜 | 경로 | 방향 | 용도 |
|----------|------|------|------|
| WebSocket | `/ws/backend` | Backend ↔ Adapter | CAN 프레임 수신, 주입 요청/응답, ECU 상태 |
| WebSocket | `/ws/ecu` | ECU ↔ Adapter | CAN 프레임 전송, 주입 요청/응답, ECU 메타 |
| HTTP GET | `/health` | 외부 → Adapter | 서비스 상태 확인 |

---

## 공통 타입

### CanFrame

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| timestamp | string (ISO 8601) | O | 프레임 생성 시각 |
| id | string | O | CAN ID (hex 문자열, 예: `"0x100"`) |
| dlc | number | O | Data Length Code (현재 고정 8) |
| data | string | O | 페이로드 (hex, 공백 구분, 예: `"DE AD BE EF 01 02 03 04"`) |

```json
{
  "timestamp": "2026-03-18T14:23:45.123Z",
  "id": "0x100",
  "dlc": 8,
  "data": "DE AD BE EF 01 02 03 04"
}
```

### EcuResponse

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| success | boolean | O | 응답 성공 여부 |
| data | string | X | 응답 페이로드 (hex, 공백 구분) |
| error | string | X | 에러 종류 (아래 표 참조). `null`이면 정상 |
| delayMs | number | X | 응답 지연 시간 (ms). `error: "delayed"` 시 포함 |

**error 값**:

| 값 | 의미 |
|----|------|
| (없음/null) | 정상 응답 |
| `"no_response"` | ECU 무응답 (크래시, 타임아웃 포함) |
| `"reset"` | ECU 리셋 발생 |
| `"malformed"` | 비정상 응답 형식 |
| `"delayed"` | 응답 지연 (`delayMs` 참조) |

---

## WebSocket `/ws/backend` — Backend 연결

S2(AEGIS Core)의 AdapterClient가 연결하는 엔드포인트.

### 연결 정책

| 항목 | 값 |
|------|-----|
| 동시 연결 | N (제한 없음) |
| 연결 시 동작 | 현재 ECU 상태(`ecu-status`) 즉시 전송. ECU 메타가 있으면 `ecu-info`도 전송 |
| 연결 해제 시 동작 | 해당 Backend의 pending inject 요청 정리 |

### 수신 메시지 (Adapter → Backend)

#### `can-frame` — CAN 프레임 수신 (broadcast)

ECU가 생성한 CAN 트래픽을 모든 연결된 Backend에 전달한다.

```json
{
  "type": "can-frame",
  "frame": {
    "timestamp": "2026-03-18T14:23:45.123Z",
    "id": "0x100",
    "dlc": 8,
    "data": "DE AD BE EF 01 02 03 04"
  }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| type | `"can-frame"` | 고정 |
| frame | CanFrame | CAN 프레임 데이터 |

#### `inject-response` — 주입 응답 (unicast)

inject-request를 보낸 **해당 Backend에만** 응답을 전달한다.

```json
{
  "type": "inject-response",
  "requestId": "req-abc123",
  "response": {
    "success": true,
    "data": "DE AD BE EF 01 02 03 04",
    "error": null,
    "delayMs": 25
  }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| type | `"inject-response"` | 고정 |
| requestId | string | 원본 inject-request의 requestId와 동일 |
| response | EcuResponse | ECU 응답 데이터 |

#### `ecu-status` — ECU 연결 상태 변경 (broadcast)

ECU가 연결/해제될 때 모든 Backend에 전달한다.

```json
{
  "type": "ecu-status",
  "status": "connected"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| type | `"ecu-status"` | 고정 |
| status | `"connected"` \| `"disconnected"` | ECU 연결 상태 |

#### `ecu-info` — ECU 메타데이터 (broadcast)

ECU가 연결 시 전송한 메타데이터를 모든 Backend에 릴레이한다. Backend 신규 연결 시에도 저장된 메타를 즉시 전송한다.

```json
{
  "type": "ecu-info",
  "ecu": {
    "name": "ECU_SIM",
    "canIds": ["0x100", "0x200", "0x300", "0x500"]
  }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| type | `"ecu-info"` | 고정 |
| ecu.name | string | ECU 식별자 |
| ecu.canIds | string[] | ECU가 사용하는 CAN ID 목록 (hex) |

### 송신 메시지 (Backend → Adapter)

#### `inject-request` — 주입 요청

동적 테스트에서 ECU에 CAN 프레임을 주입한다.

```json
{
  "type": "inject-request",
  "requestId": "req-abc123",
  "frame": {
    "timestamp": "2026-03-18T14:23:45.123Z",
    "id": "0x7DF",
    "dlc": 8,
    "data": "02 01 00 00 00 00 00 00"
  }
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| type | `"inject-request"` | O | 고정 |
| requestId | string | O | 고유 요청 ID (응답 매칭용). 호출자가 생성 |
| frame | CanFrame | O | 주입할 CAN 프레임 |

---

## 주입 요청-응답 흐름

```
Backend → inject-request(requestId: "req-123")
  ↓
Adapter: ECU 연결 확인
  ├─ 미연결 → 즉시 inject-response(error: "no_response") 반환
  └─ 연결됨 → ECU에 전달 + 타임아웃 등록
      ↓
ECU → inject-response(requestId: "req-123")
  ↓
Adapter: requestId로 원래 요청한 Backend 식별
  → 해당 Backend에만 응답 전달 (unicast)
  → 타임아웃 해제
```

### 타임아웃

| 항목 | 값 | 설명 |
|------|-----|------|
| inject 타임아웃 | **5초** | ECU 응답이 없으면 `{ success: false, error: "no_response" }` 자동 반환 |

### ECU 미연결 시

inject-request를 보냈지만 ECU가 연결되어 있지 않으면, Adapter가 **즉시** `inject-response`로 응답한다:

```json
{
  "type": "inject-response",
  "requestId": "req-abc123",
  "response": { "success": false, "error": "no_response" }
}
```

### ECU 연결 해제 시

진행 중인 모든 pending inject 요청에 `{ success: false, error: "no_response" }` 일괄 응답 후 정리한다.

---

## WebSocket `/ws/ecu` — ECU 연결

ECU(또는 ECU Simulator)가 연결하는 엔드포인트. **S2는 이 엔드포인트를 사용하지 않는다.**

### 연결 정책

| 항목 | 값 |
|------|-----|
| 동시 연결 | **1** (새 ECU 연결 시 기존 연결은 code 1000으로 정상 종료) |
| 연결 시 동작 | 모든 Backend에 `ecu-status: connected` broadcast |
| 연결 해제 시 동작 | ECU 메타 초기화, 모든 Backend에 `ecu-status: disconnected` broadcast, pending inject 일괄 resolve |

### 수신 메시지 (ECU → Adapter)

| type | 설명 | 라우팅 |
|------|------|--------|
| `can-frame` | CAN 트래픽 | → 모든 Backend에 broadcast |
| `inject-response` | 주입 응답 | → 요청한 Backend에만 unicast |
| `ecu-info` | ECU 메타데이터 | → Adapter 저장 + 모든 Backend에 broadcast |

### 송신 메시지 (Adapter → ECU)

| type | 설명 |
|------|------|
| `inject-request` | Backend가 보낸 주입 요청을 ECU에 전달 |

---

## GET /health — 상태 확인

```
GET http://localhost:4000/health
```

### 응답

```json
{
  "status": "ok",
  "ecu": {
    "connected": true,
    "name": "ECU_SIM",
    "canIds": ["0x100", "0x200", "0x300"]
  },
  "backends": 1
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| status | `"ok"` | 서비스 상태 |
| ecu.connected | boolean | ECU 연결 여부 |
| ecu.name | string? | ECU 식별자 (연결 시에만) |
| ecu.canIds | string[]? | ECU CAN ID 목록 (연결 시에만) |
| backends | number | 현재 연결된 Backend 수 |

---

## 상태 관리

모든 상태는 **인메모리**. Adapter 재시작 시 초기화된다.

| 상태 | 타입 | 설명 |
|------|------|------|
| ecuWs | WebSocket \| null | 현재 연결된 ECU (단일) |
| ecuMeta | `{ name, canIds }` \| null | ECU 메타데이터 (ecu-info 수신 시 저장) |
| backendClients | Set\<WebSocket\> | 연결된 Backend 목록 |
| pendingRequests | Map\<requestId, { timer, backendWs, startTime }\> | 진행 중인 주입 요청 (startTime으로 elapsedMs 계산) |

---

## 제약사항

| 항목 | 현재 상태 |
|------|----------|
| ECU 동시 연결 | 1대 (새 연결 시 기존 종료) |
| 인증/인가 | 없음 |
| 메시지 형식 | JSON 텍스트만 (바이너리 미지원) |
| inject 타임아웃 | 5초 하드코딩 |
| 상태 영속성 | 없음 (인메모리) |

---

## 로깅

| 항목 | 값 |
|------|-----|
| 로그 파일 | `logs/adapter.jsonl` |
| 형식 | JSON structured (observability.md 준수) |
| 필수 필드 | `level`, `time` (epoch ms), `service` ("s6-adapter"), `msg` |
| 라이브러리 | pino |

---

## 관련 문서

- [Adapter 기능 명세](../specs/adapter.md)
- [ECU Simulator 기능 명세](../specs/ecu-simulator.md)
- [공유 모델](shared-models.md)
- [Observability 규약](../specs/observability.md)
- [S6 인수인계서](../s6-handoff/README.md)
