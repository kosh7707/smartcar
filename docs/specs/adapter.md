# Adapter 기능 명세

> ECU ↔ Backend 사이의 WebSocket 릴레이 서비스
> Express.js + ws 기반, 프로토콜 변환 계층

---

## 역할

Adapter는 ECU(또는 ECU Simulator)와 Backend(S2) 사이에서 CAN 프레임을 중계하는 **경량 릴레이**다.

```
ECU Simulator ←—WS—→ Adapter ←—WS—→ Backend (S2)
  /ws/ecu (1:1)         :4000        /ws/backend (1:N)
```

- ECU 측: 단일 연결 (1대의 ECU만 연결 가능)
- Backend 측: 다중 연결 (N개의 S2 인스턴스 동시 연결 가능)
- 추후 실 ECU를 연결할 때 이 Adapter만 교체하면 된다

---

## 파일 구조

```
services/adapter/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts        # 진입점: HTTP 서버 + WS 업그레이드 라우팅
    ├── relay.ts        # 릴레이 코어: 메시지 라우팅, 타임아웃, 상태 관리
    ├── protocol.ts     # 메시지 타입 정의
    └── logger.ts       # 구조화 로깅 (pino)
```

---

## 실행

```bash
# 기본 (포트 4000)
cd services/adapter && npx tsx watch src/index.ts --port=4000

# 또는 전체 기동
./scripts/start.sh
```

| CLI 인자 | 기본값 | 설명 |
|---------|--------|------|
| `--port` | `4000` | HTTP/WebSocket 서버 포트 |

---

## WebSocket 엔드포인트

### `/ws/ecu` — ECU 연결

- **연결 수**: 1 (새 ECU 연결 시 기존 연결은 정상 종료 code 1000)
- **방향**: ECU → Adapter (can-frame), Adapter → ECU (inject-request)
- ECU가 연결/해제되면 모든 Backend에 `ecu-status` 메시지 broadcast

### `/ws/backend` — Backend 연결

- **연결 수**: N (제한 없음)
- **방향**: Adapter → Backend (can-frame, inject-response, ecu-status), Backend → Adapter (inject-request)
- Backend 연결 시 현재 ECU 상태를 즉시 전송

---

## 메시지 프로토콜

모든 메시지는 **JSON 텍스트 프레임**.

### ECU → Adapter → Backend (broadcast)

```jsonc
// CAN 프레임 — ECU가 생성한 트래픽을 모든 Backend에 전달
{
  "type": "can-frame",
  "frame": {
    "timestamp": "2026-03-08T14:23:45.123Z",
    "id": "0x100",       // CAN ID (hex 문자열)
    "dlc": 8,            // Data Length Code
    "data": "DE AD BE EF 01 02 03 04"  // 페이로드 (hex, 공백 구분)
  }
}
```

### Backend → Adapter → ECU (unicast)

```jsonc
// 주입 요청 — 동적 테스트에서 ECU에 프레임 주입
{
  "type": "inject-request",
  "requestId": "req-abc123",   // 고유 ID (응답 매칭용)
  "frame": {
    "timestamp": "2026-03-08T14:23:45.123Z",
    "id": "0x7DF",
    "dlc": 8,
    "data": "02 01 00 00 00 00 00 00"
  }
}
```

### ECU → Adapter → Backend (unicast, 요청한 Backend에만)

```jsonc
// 주입 응답 — ECU의 처리 결과
{
  "type": "inject-response",
  "requestId": "req-abc123",
  "response": {
    "success": true,
    "data": "DE AD BE EF 01 02 03 04",   // 응답 페이로드 (선택)
    "error": null,                         // 에러 종류 (선택)
    "delayMs": 25                          // 응답 지연 시간 (선택)
  }
}
```

**에러 종류** (`response.error`):

| 값 | 의미 |
|----|------|
| `null` | 정상 응답 |
| `"no_response"` | ECU 무응답 (크래시 가능성) |
| `"reset"` | ECU 리셋 발생 |
| `"malformed"` | 비정상 응답 형식 |
| `"delayed"` | 응답 지연 (`delayMs` 참조) |

### Adapter → Backend (broadcast, ECU 상태 변경 시)

```jsonc
{
  "type": "ecu-status",
  "status": "connected"   // "connected" | "disconnected"
}
```

### ECU → Adapter → Backend (broadcast, ECU 연결 시)

```jsonc
// ECU 메타데이터 — ECU가 연결 시 자신의 정보를 전송
{
  "type": "ecu-info",
  "ecu": {
    "name": "ECU_SIM",                          // ECU 식별자
    "canIds": ["0x100", "0x200", "0x300"]       // 사용하는 CAN ID 목록
  }
}
```

- ECU Sim이 Adapter에 연결 시 시나리오 CAN ID 목록과 ECU 이름을 전송
- Adapter가 저장 후 모든 Backend에 릴레이
- Backend 신규 연결 시에도 저장된 ECU 메타를 즉시 전송
- ECU 해제 시 메타 초기화

---

## Health 엔드포인트

```
GET /health
```

```json
{
  "status": "ok",
  "ecu": {
    "connected": true,
    "name": "ECU_SIM",                    // ECU 메타 (연결 시에만)
    "canIds": ["0x100", "0x200", "0x300"] // ECU 메타 (연결 시에만)
  },
  "backends": 1
}
```

---

## 주입 요청 라우팅

```
Backend B1 → inject-request(requestId: "req-123")
  ↓
Adapter: ECU 연결 확인
  ├─ 미연결 → 즉시 inject-response(error: "no_response") 반환
  └─ 연결됨 → ECU에 전달 + 타임아웃 등록 (5초)
      ↓
ECU → inject-response(requestId: "req-123")
  ↓
Adapter: requestId로 원래 요청한 B1 식별
  → B1에만 응답 전달 (unicast, 다른 Backend에는 안 감)
  → 타임아웃 해제
```

**타임아웃**: 5초 내 ECU 응답이 없으면 `error: "no_response"`로 자동 응답.

---

## 상태 관리

| 상태 | 타입 | 설명 |
|------|------|------|
| `ecuWs` | `WebSocket \| null` | 현재 연결된 ECU (단일) |
| `_ecuMeta` | `{ name, canIds } \| null` | ECU 메타데이터 (ecu-info 수신 시 저장) |
| `backendClients` | `Set<WebSocket>` | 연결된 Backend 목록 |
| `pendingRequests` | `Map<requestId, { timer, backendWs }>` | 진행 중인 주입 요청 |

모든 상태는 인메모리. Adapter 재시작 시 초기화됨.

---

## 연결 해제 처리

### ECU 연결 해제 시

1. `ecuWs = null`, `_ecuMeta = null`
2. 모든 Backend에 `ecu-status: disconnected` broadcast
3. 대기 중인 모든 inject 요청에 `error: "no_response"` 응답
4. `pendingRequests` 클리어

### Backend 연결 해제 시

1. `backendClients`에서 제거
2. 해당 Backend가 소유한 pending inject 요청 정리

---

## Backend 측 연결 클라이언트 (AdapterClient)

Backend의 `adapter-client.ts`가 Adapter에 WS 클라이언트로 연결한다.

| 설정 | 값 |
|------|---|
| 자동 재연결 | 3초 간격, 무한 재시도 |
| 연결 타임아웃 | 5초 |
| 주입 타임아웃 | 5초 |

- `connected`: Backend ↔ Adapter 연결 상태
- `ecuConnected`: Adapter로부터 수신한 ECU 상태 (`ecu-status` 메시지)
- 사용자가 명시적으로 disconnect하면 자동 재연결 비활성화

---

## 제약사항

- ECU 연결은 1개만 가능 (새 연결 시 기존 종료)
- 인증/인가 없음 (아무나 연결 가능)
- 잘못된 JSON은 무시 (try/catch)
- 주입 타임아웃 5초 하드코딩
- 바이너리 프레임 미지원 (JSON 텍스트만)
