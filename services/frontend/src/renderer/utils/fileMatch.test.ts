import { describe, it, expect } from "vitest";
import type { UploadedFile } from "@aegis/shared";
import { findFileByLocation } from "./fileMatch";

function makeFile(name: string, path?: string): UploadedFile {
  return { id: `f-${name}`, name, size: 100, path };
}

describe("findFileByLocation", () => {
  const files = [
    makeFile("main.c", "src/main.c"),
    makeFile("util.c", "src/util.c"),
    makeFile("header.h", "include/header.h"),
  ];

  it("matches by exact name", () => {
    expect(findFileByLocation(files, "main.c")?.id).toBe("f-main.c");
  });

  it("matches by exact path", () => {
    expect(findFileByLocation(files, "src/main.c")?.id).toBe("f-main.c");
  });

  it("matches by basename fallback", () => {
    expect(findFileByLocation(files, "deep/nested/header.h")?.id).toBe("f-header.h");
  });

  it("returns undefined for no match", () => {
    expect(findFileByLocation(files, "nonexistent.c")).toBeUndefined();
  });

  it("handles empty file list", () => {
    expect(findFileByLocation([], "main.c")).toBeUndefined();
  });

  it("prefers name match over path match", () => {
    const ambiguous = [
      makeFile("file.c", "other/path.c"),
      makeFile("path.c", "some/file.c"),
    ];
    // "file.c" matches first file by name
    expect(findFileByLocation(ambiguous, "file.c")?.id).toBe("f-file.c");
  });
});
