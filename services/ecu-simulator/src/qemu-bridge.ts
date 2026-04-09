import type { CanFrame, EcuResponse } from "./protocol";

const DEFAULT_TELEMETRY_CAN_ID = "0x700";

export function hexPayloadToAscii(data: string): string {
  const bytes = data
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => Number.parseInt(part, 16))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 255);

  return Buffer.from(bytes)
    .toString("utf-8")
    .replace(/\0/g, "")
    .trim();
}

export function asciiToHexPayload(text: string, maxBytes = 8): string {
  const bytes = Buffer.from(text, "utf-8").subarray(0, maxBytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0").toUpperCase()).join(" ");
}

export function createTelemetryFrame(
  line: string,
  canId = DEFAULT_TELEMETRY_CAN_ID
): CanFrame {
  const data = asciiToHexPayload(line, 8);
  const dlc = data ? data.split(" ").length : 0;

  return {
    timestamp: new Date().toISOString(),
    id: canId,
    dlc,
    data,
  };
}

export function createInjectResponse(line: string): EcuResponse {
  return {
    success: true,
    data: asciiToHexPayload(line, 64),
  };
}

export function getDefaultTelemetryCanId(): string {
  return DEFAULT_TELEMETRY_CAN_ID;
}
