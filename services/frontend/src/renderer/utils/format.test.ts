import { describe, it, expect } from "vitest";
import { formatFileSize, formatTime, formatUptime } from "./format";

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

describe("formatUptime", () => {
  it("formats seconds", () => {
    expect(formatUptime(30)).toBe("30초");
    expect(formatUptime(0)).toBe("0초");
  });

  it("formats minutes", () => {
    expect(formatUptime(60)).toBe("1분");
    expect(formatUptime(300)).toBe("5분");
  });

  it("formats hours and minutes", () => {
    expect(formatUptime(3600)).toBe("1시간 0분");
    expect(formatUptime(7290)).toBe("2시간 1분");
  });

  it("formats days and hours", () => {
    expect(formatUptime(86400)).toBe("1일 0시간");
    expect(formatUptime(90000)).toBe("1일 1시간");
    expect(formatUptime(259200)).toBe("3일 0시간");
  });
});
