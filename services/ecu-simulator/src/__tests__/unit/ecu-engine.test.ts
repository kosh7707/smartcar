import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EcuEngine } from "../../ecu-engine";
import { makeFrame } from "../../test/fixtures";

vi.mock("../../logger", () => ({
  default: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("EcuEngine", () => {
  let engine: EcuEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    engine = new EcuEngine();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function inject(overrides?: Parameters<typeof makeFrame>[0]) {
    const promise = engine.processInjection(makeFrame(overrides));
    await vi.advanceTimersByTimeAsync(5000);
    return promise;
  }

  describe("Rule 1: all 0xFF → no_response", () => {
    it("returns no_response for 8 bytes of 0xFF", async () => {
      const result = await inject({ data: "FF FF FF FF FF FF FF FF" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("no_response");
    });

    it("does not trigger for 7 bytes of 0xFF + one other byte", async () => {
      const result = await inject({ data: "FF FF FF FF FF FF FF 00" });
      expect(result.error).not.toBe("no_response");
    });
  });

  describe("Rule 2: diagnostic CAN ID 0x7DF → reset", () => {
    it('returns reset for id "0x7DF"', async () => {
      const result = await inject({ id: "0x7DF" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("reset");
    });

    it('returns reset for id "7DF" (no prefix)', async () => {
      const result = await inject({ id: "7DF" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("reset");
    });

    it('returns reset for id "0x7df" (lowercase)', async () => {
      const result = await inject({ id: "0x7df" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("reset");
    });
  });

  describe("Rule 3: all 0x00 → malformed", () => {
    it("returns malformed with MALFORMED_RESPONSE data", async () => {
      const result = await inject({ data: "00 00 00 00 00 00 00 00" });
      expect(result.success).toBe(true);
      expect(result.error).toBe("malformed");
      expect(result.data).toBe("MALFORMED_RESPONSE");
    });
  });

  describe("Rule 4: repeated input 3+ times → malformed", () => {
    it("returns normal for 1st and 2nd identical injection", async () => {
      const frame = { id: "0x100", data: "AA BB CC DD EE FF 00 11" };
      const r1 = await inject(frame);
      const r2 = await inject(frame);
      expect(r1.success).toBe(true);
      expect(r1.error).toBeUndefined();
      expect(r2.success).toBe(true);
      expect(r2.error).toBeUndefined();
    });

    it("returns UNEXPECTED_STATE on 3rd identical injection", async () => {
      const frame = { id: "0x100", data: "AA BB CC DD EE FF 00 11" };
      await inject(frame);
      await inject(frame);
      const r3 = await inject(frame);
      expect(r3.success).toBe(true);
      expect(r3.error).toBe("malformed");
      expect(r3.data).toBe("UNEXPECTED_STATE");
    });

    it("tracks by id+data signature — different data resets count", async () => {
      const frameA = { id: "0x100", data: "AA BB CC DD EE FF 00 11" };
      const frameB = { id: "0x100", data: "11 22 33 44 55 66 77 88" };
      await inject(frameA);
      await inject(frameA);
      await inject(frameB); // different data
      const r3 = await inject(frameA); // 3rd for frameA
      expect(r3.error).toBe("malformed");

      // frameB only has 1 call
      const rB2 = await inject(frameB);
      expect(rB2.error).toBeUndefined();
    });
  });

  describe("Rule 5: boundary values 0x7F/0x80 → delayed", () => {
    it("returns delayed with delayMs 2000 when data contains 0x7F", async () => {
      const result = await inject({ data: "01 02 03 7F 05 06 07 08" });
      expect(result.success).toBe(true);
      expect(result.error).toBe("delayed");
      expect(result.delayMs).toBe(2000);
    });

    it("returns delayed when data contains 0x80", async () => {
      const result = await inject({ data: "01 02 80 04 05 06 07 08" });
      expect(result.success).toBe(true);
      expect(result.error).toBe("delayed");
      expect(result.delayMs).toBe(2000);
    });
  });

  describe("Rule 6: normal response", () => {
    it("returns success with 8 hex byte data string", async () => {
      const result = await inject({ data: "01 02 03 04 05 06 07 08" });
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      // 8 hex bytes separated by spaces: "XX XX XX XX XX XX XX XX"
      expect(result.data!.split(" ")).toHaveLength(8);
      result.data!.split(" ").forEach((byte) => {
        expect(byte).toMatch(/^[0-9A-F]{2}$/);
      });
    });
  });

  describe("Rule priority", () => {
    it("all-0xFF takes priority over repeated input (Rule 1 > Rule 4)", async () => {
      const frame = { data: "FF FF FF FF FF FF FF FF" };
      await inject(frame);
      await inject(frame);
      const r3 = await inject(frame);
      // Rule 1 should fire, not Rule 4
      expect(r3.success).toBe(false);
      expect(r3.error).toBe("no_response");
    });

    it("diagnostic ID takes priority over all-0x00 data (Rule 2 > Rule 3)", async () => {
      const result = await inject({ id: "0x7DF", data: "00 00 00 00 00 00 00 00" });
      expect(result.error).toBe("reset");
    });
  });

  describe("reset()", () => {
    it("clears input counts so repeated-input detection starts fresh", async () => {
      const frame = { id: "0x100", data: "AA BB CC DD EE FF 00 11" };
      await inject(frame);
      await inject(frame);
      engine.reset();
      // Should be treated as 1st call again
      const r = await inject(frame);
      expect(r.success).toBe(true);
      expect(r.error).toBeUndefined();
    });
  });
});
