import crypto from "crypto";
import type { DynamicTestConfig } from "@aegis/shared";

export interface TestInput {
  canId: string;
  dlc: number;
  data: string; // hex string, e.g. "FF FF FF FF FF FF FF FF"
  label?: string;
}

export class InputGenerator {
  generate(config: DynamicTestConfig): TestInput[] {
    switch (config.strategy) {
      case "random":
        return this.generateRandom(config.targetId, config.count ?? 10);
      case "boundary":
        return this.generateBoundary(config.targetId);
      case "scenario":
        return this.generateScenario(config.targetId, config.protocol);
      default:
        return this.generateRandom(config.targetId, config.count ?? 10);
    }
  }

  private generateRandom(targetId: string, count: number): TestInput[] {
    const inputs: TestInput[] = [];
    for (let i = 0; i < count; i++) {
      const bytes = crypto.randomBytes(8);
      const data = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
        .join(" ");
      inputs.push({ canId: targetId, dlc: 8, data, label: `random-${i + 1}` });
    }
    return inputs;
  }

  private generateBoundary(targetId: string): TestInput[] {
    const inputs: TestInput[] = [];

    // 데이터 경계값
    const boundaryData: Array<{ data: string; label: string }> = [
      { data: "00 00 00 00 00 00 00 00", label: "all-zero" },
      { data: "FF FF FF FF FF FF FF FF", label: "all-one" },
      { data: "7F 7F 7F 7F 7F 7F 7F 7F", label: "max-positive" },
      { data: "80 80 80 80 80 80 80 80", label: "min-negative" },
      { data: "00 00 00 00 00 00 00 01", label: "min-plus-one" },
      { data: "FE FF FF FF FF FF FF FF", label: "max-minus-one" },
      { data: "01 00 00 00 00 00 00 00", label: "lsb-set" },
      { data: "AA 55 AA 55 AA 55 AA 55", label: "alternating-bits" },
    ];

    for (const { data, label } of boundaryData) {
      inputs.push({ canId: targetId, dlc: 8, data, label: `boundary-${label}` });
    }

    // DLC 경계값
    const dlcVariations: Array<{ dlc: number; data: string; label: string }> = [
      { dlc: 0, data: "", label: "dlc-zero" },
      { dlc: 1, data: "FF", label: "dlc-one" },
      { dlc: 4, data: "FF FF FF FF", label: "dlc-half" },
      { dlc: 7, data: "FF FF FF FF FF FF FF", label: "dlc-seven" },
    ];

    for (const { dlc, data, label } of dlcVariations) {
      inputs.push({ canId: targetId, dlc, data, label: `boundary-${label}` });
    }

    return inputs;
  }

  private generateScenario(targetId: string, protocol: string): TestInput[] {
    const inputs: TestInput[] = [];

    // 시나리오 1: DoS burst — 동일 메시지 10연발
    for (let i = 0; i < 10; i++) {
      inputs.push({
        canId: targetId,
        dlc: 8,
        data: "DE AD BE EF DE AD BE EF",
        label: `scenario-dos-burst-${i + 1}`,
      });
    }

    // 시나리오 2: 진단 요청 (0x7DF)
    inputs.push({
      canId: "0x7DF",
      dlc: 8,
      data: "02 10 01 00 00 00 00 00",
      label: "scenario-diag-session",
    });
    inputs.push({
      canId: "0x7DF",
      dlc: 8,
      data: "02 27 01 00 00 00 00 00",
      label: "scenario-diag-security-access",
    });
    inputs.push({
      canId: "0x7DF",
      dlc: 8,
      data: "02 11 01 00 00 00 00 00",
      label: "scenario-diag-ecu-reset",
    });

    // 시나리오 3: 리플레이 — 같은 데이터 5회 반복
    for (let i = 0; i < 5; i++) {
      inputs.push({
        canId: targetId,
        dlc: 8,
        data: "A5 A5 A5 A5 A5 A5 A5 A5",
        label: `scenario-replay-${i + 1}`,
      });
    }

    // 시나리오 4: 파괴적 입력
    inputs.push({
      canId: targetId,
      dlc: 8,
      data: "FF FF FF FF FF FF FF FF",
      label: "scenario-destructive-all-ones",
    });
    inputs.push({
      canId: targetId,
      dlc: 8,
      data: "00 00 00 00 00 00 00 00",
      label: "scenario-destructive-all-zeros",
    });

    return inputs;
  }
}
