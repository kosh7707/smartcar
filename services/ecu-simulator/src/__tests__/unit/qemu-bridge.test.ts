import { describe, expect, it } from "vitest";
import {
  asciiToHexPayload,
  createInjectResponse,
  createTelemetryFrame,
  hexPayloadToAscii,
} from "../../qemu-bridge";

describe("QEMU bridge helpers", () => {
  it("decodes hex payload into ascii text", () => {
    expect(hexPayloadToAscii("68 65 6C 6C 6F")).toBe("hello");
    expect(hexPayloadToAscii("65 78 69 74 00 00")).toBe("exit");
  });

  it("encodes ascii into uppercase hex payload", () => {
    expect(asciiToHexPayload("hello")).toBe("68 65 6C 6C 6F".toUpperCase());
    expect(asciiToHexPayload("123456789", 8).split(" ")).toHaveLength(8);
  });

  it("creates telemetry can frames from firmware stdout lines", () => {
    const frame = createTelemetryFrame("[boot] qemu");
    expect(frame.id).toBe("0x700");
    expect(frame.dlc).toBeGreaterThan(0);
    expect(frame.data.split(" ").length).toBe(frame.dlc);
  });

  it("creates inject responses from firmware output lines", () => {
    const response = createInjectResponse("[ack] qemu-sample");
    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(hexPayloadToAscii(response.data!)).toContain("[ack]");
  });
});
