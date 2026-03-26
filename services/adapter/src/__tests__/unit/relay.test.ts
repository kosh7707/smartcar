import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Relay } from "../../relay";
import { createMockWs, parseSent, sendCount } from "../../test/helpers";
import { WebSocket } from "ws";

vi.mock("../../logger", () => ({
  default: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("Relay", () => {
  let relay: Relay;

  beforeEach(() => {
    relay = new Relay();
  });

  describe("initial state", () => {
    it("ecuConnected is false", () => {
      expect(relay.ecuConnected).toBe(false);
    });

    it("ecuMeta is null", () => {
      expect(relay.ecuMeta).toBeNull();
    });

    it("backendCount is 0", () => {
      expect(relay.backendCount).toBe(0);
    });
  });

  describe("onEcuConnect", () => {
    it("sets ecuConnected to true", () => {
      relay.onEcuConnect(createMockWs());
      expect(relay.ecuConnected).toBe(true);
    });

    it("broadcasts ecu-status:connected to all backends", () => {
      const backend = createMockWs();
      relay.onBackendConnect(backend);
      // clear the initial ecu-status sent on backend connect
      (backend.send as ReturnType<typeof vi.fn>).mockClear();

      relay.onEcuConnect(createMockWs());
      const msg = parseSent(backend);
      expect(msg.type).toBe("ecu-status");
      expect(msg.status).toBe("connected");
    });

    it("replaces existing ECU connection (closes previous with code 1000)", () => {
      const oldEcu = createMockWs();
      relay.onEcuConnect(oldEcu);
      relay.onEcuConnect(createMockWs());
      expect(oldEcu.close).toHaveBeenCalledWith(1000, "replaced");
    });
  });

  describe("onEcuDisconnect", () => {
    it("sets ecuConnected to false", () => {
      relay.onEcuConnect(createMockWs());
      relay.onEcuDisconnect();
      expect(relay.ecuConnected).toBe(false);
    });

    it("clears ecuMeta", () => {
      relay.onEcuConnect(createMockWs());
      relay.onEcuMessage(
        JSON.stringify({ type: "ecu-info", ecu: { name: "ECU", canIds: ["0x100"] } })
      );
      expect(relay.ecuMeta).not.toBeNull();
      relay.onEcuDisconnect();
      expect(relay.ecuMeta).toBeNull();
    });

    it("broadcasts ecu-status:disconnected to all backends", () => {
      const backend = createMockWs();
      relay.onBackendConnect(backend);
      relay.onEcuConnect(createMockWs());
      (backend.send as ReturnType<typeof vi.fn>).mockClear();

      relay.onEcuDisconnect();
      const msg = parseSent(backend);
      expect(msg.type).toBe("ecu-status");
      expect(msg.status).toBe("disconnected");
    });

    it("resolves all pending requests with error no_response", () => {
      vi.useFakeTimers();
      const ecuWs = createMockWs();
      const backendWs = createMockWs();
      relay.onEcuConnect(ecuWs);
      relay.onBackendConnect(backendWs);
      (backendWs.send as ReturnType<typeof vi.fn>).mockClear();

      relay.onBackendMessage(
        backendWs,
        JSON.stringify({
          type: "inject-request",
          requestId: "req-1",
          frame: { timestamp: "t", id: "0x100", dlc: 8, data: "01 02 03 04 05 06 07 08" },
        })
      );

      relay.onEcuDisconnect();

      // Should have: ecu-status:disconnected + inject-response
      const calls = (backendWs.send as ReturnType<typeof vi.fn>).mock.calls;
      const responses = calls.map((c: any) => JSON.parse(c[0]));
      const injectResp = responses.find((m: any) => m.type === "inject-response");
      expect(injectResp).toBeDefined();
      expect(injectResp.requestId).toBe("req-1");
      expect(injectResp.response.success).toBe(false);
      expect(injectResp.response.error).toBe("no_response");
      vi.useRealTimers();
    });
  });

  describe("onBackendConnect", () => {
    it("increments backendCount", () => {
      relay.onBackendConnect(createMockWs());
      expect(relay.backendCount).toBe(1);
      relay.onBackendConnect(createMockWs());
      expect(relay.backendCount).toBe(2);
    });

    it("sends ecu-status:disconnected when no ECU", () => {
      const backend = createMockWs();
      relay.onBackendConnect(backend);
      const msg = parseSent(backend);
      expect(msg.type).toBe("ecu-status");
      expect(msg.status).toBe("disconnected");
    });

    it("sends ecu-status:connected when ECU is present", () => {
      relay.onEcuConnect(createMockWs());
      const backend = createMockWs();
      relay.onBackendConnect(backend);
      const msg = parseSent(backend);
      expect(msg.type).toBe("ecu-status");
      expect(msg.status).toBe("connected");
    });

    it("sends cached ecu-info if available", () => {
      relay.onEcuConnect(createMockWs());
      relay.onEcuMessage(
        JSON.stringify({
          type: "ecu-info",
          ecu: { name: "ECU_SIM", canIds: ["0x100", "0x200"] },
        })
      );

      const backend = createMockWs();
      relay.onBackendConnect(backend);
      // msg 0 = ecu-status, msg 1 = ecu-info
      const infoMsg = parseSent(backend, 1);
      expect(infoMsg.type).toBe("ecu-info");
      expect(infoMsg.ecu.name).toBe("ECU_SIM");
      expect(infoMsg.ecu.canIds).toEqual(["0x100", "0x200"]);
    });

    it("does not send ecu-info when no ECU meta", () => {
      const backend = createMockWs();
      relay.onBackendConnect(backend);
      // only ecu-status sent
      expect(sendCount(backend)).toBe(1);
    });
  });

  describe("onBackendDisconnect", () => {
    it("decrements backendCount", () => {
      const b1 = createMockWs();
      const b2 = createMockWs();
      relay.onBackendConnect(b1);
      relay.onBackendConnect(b2);
      relay.onBackendDisconnect(b1);
      expect(relay.backendCount).toBe(1);
    });

    it("cleans up pending requests owned by disconnecting backend", () => {
      vi.useFakeTimers();
      const ecuWs = createMockWs();
      const b1 = createMockWs();
      const b2 = createMockWs();
      relay.onEcuConnect(ecuWs);
      relay.onBackendConnect(b1);
      relay.onBackendConnect(b2);

      relay.onBackendMessage(
        b1,
        JSON.stringify({
          type: "inject-request",
          requestId: "req-b1",
          frame: { timestamp: "t", id: "0x100", dlc: 8, data: "01 02 03 04 05 06 07 08" },
        })
      );

      relay.onBackendDisconnect(b1);

      // Timeout should not try to send to disconnected b1
      vi.advanceTimersByTime(5000);
      // No error thrown = success
      vi.useRealTimers();
    });

    it("does not affect pending requests from other backends", () => {
      vi.useFakeTimers();
      const ecuWs = createMockWs();
      const b1 = createMockWs();
      const b2 = createMockWs();
      relay.onEcuConnect(ecuWs);
      relay.onBackendConnect(b1);
      relay.onBackendConnect(b2);
      (b2.send as ReturnType<typeof vi.fn>).mockClear();

      relay.onBackendMessage(
        b2,
        JSON.stringify({
          type: "inject-request",
          requestId: "req-b2",
          frame: { timestamp: "t", id: "0x100", dlc: 8, data: "01 02 03 04 05 06 07 08" },
        })
      );

      relay.onBackendDisconnect(b1);

      // b2's request should still timeout normally
      vi.advanceTimersByTime(5000);
      const calls = (b2.send as ReturnType<typeof vi.fn>).mock.calls;
      const resp = calls.map((c: any) => JSON.parse(c[0])).find(
        (m: any) => m.type === "inject-response"
      );
      expect(resp).toBeDefined();
      expect(resp.requestId).toBe("req-b2");
      vi.useRealTimers();
    });
  });

  describe("onEcuMessage — can-frame routing", () => {
    it("broadcasts can-frame to all connected backends", () => {
      const b1 = createMockWs();
      const b2 = createMockWs();
      relay.onBackendConnect(b1);
      relay.onBackendConnect(b2);
      (b1.send as ReturnType<typeof vi.fn>).mockClear();
      (b2.send as ReturnType<typeof vi.fn>).mockClear();

      relay.onEcuConnect(createMockWs());
      // clear the ecu-status:connected broadcast
      (b1.send as ReturnType<typeof vi.fn>).mockClear();
      (b2.send as ReturnType<typeof vi.fn>).mockClear();

      relay.onEcuMessage(
        JSON.stringify({
          type: "can-frame",
          frame: { timestamp: "t", id: "0x100", dlc: 8, data: "AA BB CC DD EE FF 00 11" },
        })
      );

      expect(parseSent(b1).type).toBe("can-frame");
      expect(parseSent(b2).type).toBe("can-frame");
    });

    it("ignores invalid JSON", () => {
      relay.onEcuMessage("not json");
      // no error thrown
    });
  });

  describe("onEcuMessage — ecu-info routing", () => {
    it("caches ecu meta and broadcasts to all backends", () => {
      const backend = createMockWs();
      relay.onBackendConnect(backend);
      relay.onEcuConnect(createMockWs());
      (backend.send as ReturnType<typeof vi.fn>).mockClear();

      relay.onEcuMessage(
        JSON.stringify({
          type: "ecu-info",
          ecu: { name: "TEST_ECU", canIds: ["0x300"] },
        })
      );

      expect(relay.ecuMeta).toEqual({ name: "TEST_ECU", canIds: ["0x300"] });
      const msg = parseSent(backend);
      expect(msg.type).toBe("ecu-info");
      expect(msg.ecu.name).toBe("TEST_ECU");
    });
  });

  describe("onEcuMessage — inject-response routing", () => {
    it("routes inject-response to the requesting backend only (unicast)", () => {
      vi.useFakeTimers();
      const ecuWs = createMockWs();
      const b1 = createMockWs();
      const b2 = createMockWs();
      relay.onEcuConnect(ecuWs);
      relay.onBackendConnect(b1);
      relay.onBackendConnect(b2);
      (b1.send as ReturnType<typeof vi.fn>).mockClear();
      (b2.send as ReturnType<typeof vi.fn>).mockClear();

      relay.onBackendMessage(
        b1,
        JSON.stringify({
          type: "inject-request",
          requestId: "req-uni",
          frame: { timestamp: "t", id: "0x100", dlc: 8, data: "01 02 03 04 05 06 07 08" },
        })
      );

      relay.onEcuMessage(
        JSON.stringify({
          type: "inject-response",
          requestId: "req-uni",
          response: { success: true, data: "AA BB CC DD EE FF 00 11" },
        })
      );

      // b1 should have the response
      const b1Msgs = (b1.send as ReturnType<typeof vi.fn>).mock.calls.map((c: any) =>
        JSON.parse(c[0])
      );
      expect(b1Msgs.some((m: any) => m.type === "inject-response")).toBe(true);

      // b2 should NOT have the response
      const b2Msgs = (b2.send as ReturnType<typeof vi.fn>).mock.calls.map((c: any) =>
        JSON.parse(c[0])
      );
      expect(b2Msgs.some((m: any) => m.type === "inject-response")).toBe(false);
      vi.useRealTimers();
    });

    it("clears the pending request timer", () => {
      vi.useFakeTimers();
      const ecuWs = createMockWs();
      const backendWs = createMockWs();
      relay.onEcuConnect(ecuWs);
      relay.onBackendConnect(backendWs);
      (backendWs.send as ReturnType<typeof vi.fn>).mockClear();

      relay.onBackendMessage(
        backendWs,
        JSON.stringify({
          type: "inject-request",
          requestId: "req-timer",
          frame: { timestamp: "t", id: "0x100", dlc: 8, data: "01 02 03 04 05 06 07 08" },
        })
      );

      // ECU responds
      relay.onEcuMessage(
        JSON.stringify({
          type: "inject-response",
          requestId: "req-timer",
          response: { success: true },
        })
      );

      (backendWs.send as ReturnType<typeof vi.fn>).mockClear();

      // Advance past timeout — should NOT send a duplicate response
      vi.advanceTimersByTime(5000);
      expect(sendCount(backendWs)).toBe(0);
      vi.useRealTimers();
    });

    it("ignores inject-response for unknown requestId", () => {
      relay.onEcuConnect(createMockWs());
      // No pending request exists for "req-unknown"
      relay.onEcuMessage(
        JSON.stringify({
          type: "inject-response",
          requestId: "req-unknown",
          response: { success: true },
        })
      );
      // no error thrown
    });
  });

  describe("onBackendMessage — inject-request routing", () => {
    it("forwards inject-request to ECU when connected", () => {
      const ecuWs = createMockWs();
      relay.onEcuConnect(ecuWs);
      const backendWs = createMockWs();
      relay.onBackendConnect(backendWs);

      relay.onBackendMessage(
        backendWs,
        JSON.stringify({
          type: "inject-request",
          requestId: "req-fwd",
          frame: { timestamp: "t", id: "0x100", dlc: 8, data: "01 02 03 04 05 06 07 08" },
        })
      );

      expect(ecuWs.send).toHaveBeenCalled();
      const ecuMsg = JSON.parse(
        (ecuWs.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      );
      expect(ecuMsg.type).toBe("inject-request");
      expect(ecuMsg.requestId).toBe("req-fwd");
    });

    it("returns immediate error when ECU is not connected", () => {
      const backendWs = createMockWs();
      relay.onBackendConnect(backendWs);
      (backendWs.send as ReturnType<typeof vi.fn>).mockClear();

      relay.onBackendMessage(
        backendWs,
        JSON.stringify({
          type: "inject-request",
          requestId: "req-noEcu",
          frame: { timestamp: "t", id: "0x100", dlc: 8, data: "01 02 03 04 05 06 07 08" },
        })
      );

      const msg = parseSent(backendWs);
      expect(msg.type).toBe("inject-response");
      expect(msg.requestId).toBe("req-noEcu");
      expect(msg.response.success).toBe(false);
      expect(msg.response.error).toBe("no_response");
    });

    it("ignores invalid JSON", () => {
      const backendWs = createMockWs();
      relay.onBackendConnect(backendWs);
      relay.onBackendMessage(backendWs, "{{invalid}");
      // no error thrown
    });
  });

  describe("inject timeout", () => {
    it("sends no_response error after 5 seconds if ECU does not respond", () => {
      vi.useFakeTimers();
      const ecuWs = createMockWs();
      const backendWs = createMockWs();
      relay.onEcuConnect(ecuWs);
      relay.onBackendConnect(backendWs);
      (backendWs.send as ReturnType<typeof vi.fn>).mockClear();

      relay.onBackendMessage(
        backendWs,
        JSON.stringify({
          type: "inject-request",
          requestId: "req-timeout",
          frame: { timestamp: "t", id: "0x100", dlc: 8, data: "01 02 03 04 05 06 07 08" },
        })
      );

      // Before timeout — no inject-response yet
      vi.advanceTimersByTime(4999);
      const beforeCalls = (backendWs.send as ReturnType<typeof vi.fn>).mock.calls;
      expect(
        beforeCalls.some((c: any) => JSON.parse(c[0]).type === "inject-response")
      ).toBe(false);

      // After timeout
      vi.advanceTimersByTime(1);
      const afterCalls = (backendWs.send as ReturnType<typeof vi.fn>).mock.calls;
      const resp = afterCalls.map((c: any) => JSON.parse(c[0])).find(
        (m: any) => m.type === "inject-response"
      );
      expect(resp).toBeDefined();
      expect(resp.requestId).toBe("req-timeout");
      expect(resp.response.success).toBe(false);
      expect(resp.response.error).toBe("no_response");
      vi.useRealTimers();
    });
  });

  describe("broadcast failure handling", () => {
    it("removes backend client that throws on send", () => {
      const goodBackend = createMockWs();
      const badBackend = createMockWs();
      (badBackend.send as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("connection lost");
      });

      relay.onBackendConnect(goodBackend);
      relay.onBackendConnect(badBackend);
      expect(relay.backendCount).toBe(2);

      relay.onEcuConnect(createMockWs());
      // broadcast of ecu-status:connected should trigger send failure
      // badBackend should be removed
      expect(relay.backendCount).toBe(1);
    });
  });
});
