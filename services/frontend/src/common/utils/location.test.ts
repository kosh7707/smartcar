import { describe, it, expect } from "vitest";
import { parseLocation, getHighlightLine, getFileNameFromLocation } from "./location";

describe("parseLocation", () => {
  it("parses file:line format", () => {
    expect(parseLocation("src/main.c:42")).toEqual({ fileName: "src/main.c", line: "42" });
  });

  it("parses filename without line", () => {
    expect(parseLocation("main.c")).toEqual({ fileName: "main.c" });
  });

  it("handles paths with colons in directory names", () => {
    // e.g. "C:/path/file.c:10" — last colon with digits after is the line
    expect(parseLocation("C:/path/file.c:10")).toEqual({ fileName: "C:/path/file.c", line: "10" });
  });

  it("returns 기타 for null/undefined", () => {
    expect(parseLocation(null)).toEqual({ fileName: "기타" });
    expect(parseLocation(undefined)).toEqual({ fileName: "기타" });
    expect(parseLocation("")).toEqual({ fileName: "기타" });
  });

  it("returns full string when colon at start", () => {
    expect(parseLocation(":42")).toEqual({ fileName: ":42" });
  });

  it("returns full string when non-numeric after colon", () => {
    expect(parseLocation("file:abc")).toEqual({ fileName: "file:abc" });
  });
});

describe("getHighlightLine", () => {
  it("extracts line number", () => {
    expect(getHighlightLine("file.c:42")).toBe(42);
  });

  it("returns -1 for no line", () => {
    expect(getHighlightLine("file.c")).toBe(-1);
    expect(getHighlightLine(undefined)).toBe(-1);
  });
});

describe("getFileNameFromLocation", () => {
  it("extracts filename", () => {
    expect(getFileNameFromLocation("src/main.c:42")).toBe("src/main.c");
  });

  it("returns 기타 for null", () => {
    expect(getFileNameFromLocation(null)).toBe("기타");
  });
});
