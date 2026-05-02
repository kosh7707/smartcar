import { describe, it, expect } from "vitest";
import { STATUS_LABELS } from "./dynamic";

describe("dynamic STATUS_LABELS", () => {
  it("has connected status", () => {
    expect(STATUS_LABELS.connected).toBe("대기");
  });

  it("has monitoring status", () => {
    expect(STATUS_LABELS.monitoring).toBe("모니터링 중");
  });

  it("has stopped status", () => {
    expect(STATUS_LABELS.stopped).toBe("종료됨");
  });
});
