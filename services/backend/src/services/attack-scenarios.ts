import type { AttackScenario } from "@aegis/shared";

export const ATTACK_SCENARIOS: AttackScenario[] = [
  {
    id: "dos-burst",
    name: "DoS Burst",
    description: "동일 메시지 10회 고속 반복 → 버스 포화",
    severity: "high",
    steps: Array.from({ length: 10 }, (_, i) => ({
      canId: "0x100",
      dlc: 8,
      data: "AA BB CC DD EE FF 00 11",
      label: `DoS burst #${i + 1}`,
    })),
  },
  {
    id: "diagnostic-abuse",
    name: "진단 서비스 남용",
    description: "0x7DF 진단 ID로 비인가 명령 3종 전송",
    severity: "critical",
    steps: [
      { canId: "0x7DF", dlc: 8, data: "02 10 03 00 00 00 00 00", label: "Diagnostic Session Control" },
      { canId: "0x7DF", dlc: 8, data: "02 27 01 00 00 00 00 00", label: "Security Access Request" },
      { canId: "0x7DF", dlc: 8, data: "02 11 01 00 00 00 00 00", label: "ECU Reset" },
    ],
  },
  {
    id: "replay-attack",
    name: "리플레이 공격",
    description: "동일 페이로드 5회 반복 전송",
    severity: "high",
    steps: Array.from({ length: 5 }, (_, i) => ({
      canId: "0x200",
      dlc: 8,
      data: "DE AD BE EF DE AD BE EF",
      label: `Replay #${i + 1}`,
    })),
  },
  {
    id: "bus-off",
    name: "Bus-Off 유도",
    description: "0xFF 페이로드로 Bus-Off 상태 유도",
    severity: "critical",
    steps: [
      { canId: "0x000", dlc: 8, data: "FF FF FF FF FF FF FF FF", label: "Bus-Off payload 1" },
      { canId: "0x000", dlc: 8, data: "FF FF FF FF FF FF FF FF", label: "Bus-Off payload 2" },
      { canId: "0x000", dlc: 8, data: "FF FF FF FF FF FF FF FF", label: "Bus-Off payload 3" },
    ],
  },
  {
    id: "unauthorized-id",
    name: "비인가 CAN ID",
    description: "허용 목록 외 CAN ID 3종 탐색",
    severity: "medium",
    steps: [
      { canId: "0x7FF", dlc: 8, data: "01 02 03 04 05 06 07 08", label: "Unauthorized ID 0x7FF" },
      { canId: "0x6FF", dlc: 8, data: "01 02 03 04 05 06 07 08", label: "Unauthorized ID 0x6FF" },
      { canId: "0x5FF", dlc: 8, data: "01 02 03 04 05 06 07 08", label: "Unauthorized ID 0x5FF" },
    ],
  },
  {
    id: "boundary-probe",
    name: "경계값 탐색",
    description: "0x00/0xFF/0x7F/0x80 페이로드로 경계 조건 테스트",
    severity: "medium",
    steps: [
      { canId: "0x7DF", dlc: 8, data: "00 00 00 00 00 00 00 00", label: "All zeros" },
      { canId: "0x7DF", dlc: 8, data: "FF FF FF FF FF FF FF FF", label: "All 0xFF" },
      { canId: "0x7DF", dlc: 8, data: "7F 7F 7F 7F 7F 7F 7F 7F", label: "All 0x7F" },
      { canId: "0x7DF", dlc: 8, data: "80 80 80 80 80 80 80 80", label: "All 0x80" },
    ],
  },
];
