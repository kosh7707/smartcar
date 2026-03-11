export interface CanScenarioStep {
  canId: string;
  dlc: number;
  data: "random" | string;
  burst?: number;
}

export interface CanPhase {
  name: string;
  count: number;
  steps: CanScenarioStep[];
}

export interface CanScenario {
  name: string;
  phases: CanPhase[];
}

function randomHexByte(): string {
  return Math.floor(Math.random() * 256).toString(16).padStart(2, "0").toUpperCase();
}

export function randomPayload(dlc: number): string {
  return Array.from({ length: dlc }, () => randomHexByte()).join(" ");
}

const NORMAL_IDS = ["0x100", "0x200", "0x300", "0x400", "0x500"];

export const SCENARIOS: Record<string, CanScenario> = {
  mixed: {
    name: "Mixed (Normal + Attacks)",
    phases: [
      {
        name: "Normal traffic",
        count: 100,
        steps: NORMAL_IDS.map((id) => ({ canId: id, dlc: 8, data: "random" as const })),
      },
      {
        name: "Diagnostic DoS",
        count: 50,
        steps: [{ canId: "0x7DF", dlc: 8, data: "02 01 00 00 00 00 00 00", burst: 10 }],
      },
      {
        name: "Normal recovery",
        count: 50,
        steps: NORMAL_IDS.map((id) => ({ canId: id, dlc: 8, data: "random" as const })),
      },
      {
        name: "Unauthorized ID",
        count: 50,
        steps: [
          ...NORMAL_IDS.map((id) => ({ canId: id, dlc: 8, data: "random" as const })),
          { canId: "0x666", dlc: 8, data: "random" as const },
        ],
      },
      {
        name: "Normal traffic",
        count: 100,
        steps: NORMAL_IDS.map((id) => ({ canId: id, dlc: 8, data: "random" as const })),
      },
      {
        name: "Replay attack",
        count: 50,
        steps: [{ canId: "0x100", dlc: 8, data: "DE AD BE EF 01 02 03 04" }],
      },
      {
        name: "Normal finish",
        count: 100,
        steps: NORMAL_IDS.map((id) => ({ canId: id, dlc: 8, data: "random" as const })),
      },
    ],
  },

  normal: {
    name: "Normal Only",
    phases: [
      {
        name: "Normal traffic",
        count: 500,
        steps: NORMAL_IDS.map((id) => ({ canId: id, dlc: 8, data: "random" as const })),
      },
    ],
  },
};
