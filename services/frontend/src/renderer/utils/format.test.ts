import { describe, it, expect } from "vitest";
import { formatFileSize, formatTime } from "./format";

describe("formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1023)).toBe("1023 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(10240)).toBe("10.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe("2.5 MB");
  });
});

describe("formatTime", () => {
  it("extracts time from ISO datetime", () => {
    expect(formatTime("2026-01-01T14:30:45.123Z")).toBe("14:30:45.123");
  });

  it("returns raw string if no T separator", () => {
    expect(formatTime("14:30:00")).toBe("14:30:00");
  });
});
