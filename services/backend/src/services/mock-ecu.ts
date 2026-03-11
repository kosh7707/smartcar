export interface EcuInput {
  canId: string;
  dlc: number;
  data: string; // hex string, e.g. "FF FF FF FF FF FF FF FF"
}

export interface EcuResponse {
  success: boolean;
  data?: string;
  error?: "no_response" | "malformed" | "reset" | "delayed";
  delayMs?: number;
}

export interface IEcuAdapter {
  sendAndReceive(input: EcuInput): Promise<EcuResponse>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockEcu implements IEcuAdapter {
  private inputCounts = new Map<string, number>();

  reset(): void {
    this.inputCounts.clear();
  }

  async sendAndReceive(input: EcuInput): Promise<EcuResponse> {
    // 기본 지연 (실 ECU 통신 시뮬레이션)
    await sleep(10 + Math.random() * 40);

    const response = this.matchScenario(input);

    // 추가 지연 (timeout 시뮬레이션)
    if (response.delayMs) {
      await sleep(response.delayMs);
    }

    return response;
  }

  private matchScenario(input: EcuInput): EcuResponse {
    const dataBytes = input.data
      .split(" ")
      .map((b) => parseInt(b, 16));

    // 1. 모든 비트 1 (0xFF x8) → 크래시 (응답 없음)
    if (dataBytes.length >= 8 && dataBytes.every((b) => b === 0xff)) {
      return { success: false, error: "no_response" };
    }

    // 2. 진단 ID (0x7DF) → ECU 리셋
    if (input.canId.toUpperCase() === "0X7DF" || input.canId === "7DF") {
      return { success: false, error: "reset" };
    }

    // 3. 모든 비트 0 (0x00 x8) → 잘못된 형식
    if (dataBytes.length >= 8 && dataBytes.every((b) => b === 0x00)) {
      return { success: true, data: "MALFORMED_RESPONSE", error: "malformed" };
    }

    // 4. 반복 동일 입력 3회+ → 비정상 응답
    const sig = `${input.canId}:${input.data}`;
    const count = (this.inputCounts.get(sig) ?? 0) + 1;
    this.inputCounts.set(sig, count);
    if (count >= 3) {
      return { success: true, data: "UNEXPECTED_STATE", error: "malformed" };
    }

    // 5. 경계값 (0x7F 또는 0x80 포함) → 지연 응답
    if (dataBytes.some((b) => b === 0x7f || b === 0x80)) {
      return {
        success: true,
        data: this.normalResponse(input),
        error: "delayed",
        delayMs: 2000,
      };
    }

    // 6. 일반 → 정상 응답
    return { success: true, data: this.normalResponse(input) };
  }

  private normalResponse(input: EcuInput): string {
    // 정상 응답: 입력 CAN ID + 0x08 오프셋의 응답 ID 시뮬레이션
    const responseBytes = Array.from({ length: 8 }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, "0")
        .toUpperCase()
    );
    return responseBytes.join(" ");
  }
}
