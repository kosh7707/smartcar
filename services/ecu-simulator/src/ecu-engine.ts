import type { CanFrame, EcuResponse } from "./protocol";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class EcuEngine {
  private inputCounts = new Map<string, number>();

  async processInjection(frame: CanFrame): Promise<EcuResponse> {
    // base delay simulating real ECU communication
    await sleep(10 + Math.random() * 40);

    const response = this.matchScenario(frame);

    if (response.delayMs) {
      await sleep(response.delayMs);
    }

    return response;
  }

  reset(): void {
    this.inputCounts.clear();
  }

  private matchScenario(frame: CanFrame): EcuResponse {
    const dataBytes = frame.data
      .split(" ")
      .map((b) => parseInt(b, 16));

    // 1. all 0xFF (8 bytes) -> crash (no response)
    if (dataBytes.length >= 8 && dataBytes.every((b) => b === 0xff)) {
      return { success: false, error: "no_response" };
    }

    // 2. diagnostic ID (0x7DF) -> ECU reset
    if (frame.id.toUpperCase() === "0X7DF" || frame.id === "7DF") {
      return { success: false, error: "reset" };
    }

    // 3. all 0x00 (8 bytes) -> malformed
    if (dataBytes.length >= 8 && dataBytes.every((b) => b === 0x00)) {
      return { success: true, data: "MALFORMED_RESPONSE", error: "malformed" };
    }

    // 4. repeated same input 3+ times -> unexpected state
    const sig = `${frame.id}:${frame.data}`;
    const count = (this.inputCounts.get(sig) ?? 0) + 1;
    this.inputCounts.set(sig, count);
    if (count >= 3) {
      return { success: true, data: "UNEXPECTED_STATE", error: "malformed" };
    }

    // 5. boundary values (0x7F or 0x80) -> delayed response
    if (dataBytes.some((b) => b === 0x7f || b === 0x80)) {
      return {
        success: true,
        data: this.normalResponse(),
        error: "delayed",
        delayMs: 2000,
      };
    }

    // 6. normal response
    return { success: true, data: this.normalResponse() };
  }

  private normalResponse(): string {
    return Array.from({ length: 8 }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, "0")
        .toUpperCase()
    ).join(" ");
  }
}
