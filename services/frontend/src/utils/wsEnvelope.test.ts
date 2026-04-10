import { describe, it, expect, vi } from "vitest";
import { createSeqTracker, parseWsMessage } from "./wsEnvelope";

describe("createSeqTracker", () => {
  it("returns 0 gap for first message", () => {
    const tracker = createSeqTracker("test");
    expect(tracker.check({ channel: "analysis", timestamp: 1000, seq: 1 })).toBe(0);
  });

  it("returns 0 gap for consecutive seq", () => {
    const tracker = createSeqTracker("test");
    tracker.check({ channel: "analysis", timestamp: 1000, seq: 1 });
    expect(tracker.check({ channel: "analysis", timestamp: 1001, seq: 2 })).toBe(0);
    expect(tracker.check({ channel: "analysis", timestamp: 1002, seq: 3 })).toBe(0);
  });

  it("detects gap and warns", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tracker = createSeqTracker("test");
    tracker.check({ channel: "analysis", timestamp: 1000, seq: 1 });
    const gap = tracker.check({ channel: "analysis", timestamp: 1005, seq: 5 });
    expect(gap).toBe(3);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("seq gap detected"),
    );
    spy.mockRestore();
  });

  it("returns 0 for messages without seq", () => {
    const tracker = createSeqTracker("test");
    expect(tracker.check({ channel: "upload", timestamp: 1000 })).toBe(0);
  });

  it("returns 0 when meta is undefined", () => {
    const tracker = createSeqTracker("test");
    expect(tracker.check(undefined)).toBe(0);
  });

  it("reset clears state", () => {
    const tracker = createSeqTracker("test");
    tracker.check({ channel: "analysis", timestamp: 1000, seq: 10 });
    tracker.reset();
    // After reset, first message should not report gap
    expect(tracker.check({ channel: "analysis", timestamp: 2000, seq: 50 })).toBe(0);
  });
});

describe("parseWsMessage", () => {
  it("parses message with meta", () => {
    const raw = JSON.stringify({
      type: "test-event",
      payload: { value: 42 },
      meta: { channel: "analysis", timestamp: 1000, seq: 1 },
    });
    const msg = parseWsMessage<{ value: number }>(raw);
    expect(msg.type).toBe("test-event");
    expect(msg.payload.value).toBe(42);
    expect(msg.meta?.channel).toBe("analysis");
    expect(msg.meta?.seq).toBe(1);
  });

  it("parses message without meta", () => {
    const raw = JSON.stringify({
      type: "simple",
      payload: { ok: true },
    });
    const msg = parseWsMessage(raw);
    expect(msg.type).toBe("simple");
    expect(msg.meta).toBeUndefined();
  });
});
