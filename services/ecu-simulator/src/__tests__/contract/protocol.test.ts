import { describe, it, expect } from "vitest";
import type {
  CanFrame,
  EcuResponse,
  EcuToAdapterMessage,
  AdapterToEcuMessage,
} from "../../protocol";

/**
 * Protocol contract tests — verifies ECU Simulator's TypeScript type definitions
 * are compatible with the adapter-api.md contract.
 */

const sampleFrame: CanFrame = {
  timestamp: "2026-03-18T14:23:45.123Z",
  id: "0x100",
  dlc: 8,
  data: "DE AD BE EF 01 02 03 04",
};

describe("ECU Simulator Protocol Contract", () => {
  describe("CanFrame", () => {
    it("has required fields: timestamp, id, dlc, data", () => {
      expect(typeof sampleFrame.timestamp).toBe("string");
      expect(typeof sampleFrame.id).toBe("string");
      expect(typeof sampleFrame.dlc).toBe("number");
      expect(typeof sampleFrame.data).toBe("string");
    });
  });

  describe("EcuResponse", () => {
    it("has required field: success (boolean)", () => {
      const resp: EcuResponse = { success: true };
      expect(typeof resp.success).toBe("boolean");
    });

    it("error values match documented set", () => {
      const errors: EcuResponse["error"][] = [
        "no_response",
        "malformed",
        "reset",
        "delayed",
        undefined,
      ];
      errors.forEach((err) => {
        const resp: EcuResponse = { success: false, error: err };
        expect(resp).toBeDefined();
      });
    });
  });

  describe("EcuToAdapterMessage", () => {
    it("supports can-frame, inject-response, and ecu-info types", () => {
      const messages: EcuToAdapterMessage[] = [
        { type: "can-frame", frame: sampleFrame },
        { type: "inject-response", requestId: "req-1", response: { success: true } },
        { type: "ecu-info", ecu: { name: "ECU_SIM", canIds: ["0x100"] } },
      ];
      expect(messages.map((m) => m.type)).toEqual([
        "can-frame",
        "inject-response",
        "ecu-info",
      ]);
    });
  });

  describe("AdapterToEcuMessage", () => {
    it("supports inject-request with requestId and frame", () => {
      const msg: AdapterToEcuMessage = {
        type: "inject-request",
        requestId: "req-123",
        frame: sampleFrame,
      };
      expect(msg.type).toBe("inject-request");
      expect(msg).toHaveProperty("requestId");
      expect(msg).toHaveProperty("frame");
    });
  });
});
