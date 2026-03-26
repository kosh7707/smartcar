import type { CanFrame } from "../protocol";

export function makeFrame(overrides?: Partial<CanFrame>): CanFrame {
  return {
    timestamp: "2026-01-01T00:00:00.000Z",
    id: "0x100",
    dlc: 8,
    data: "DE AD BE EF 01 02 03 04",
    ...overrides,
  };
}
