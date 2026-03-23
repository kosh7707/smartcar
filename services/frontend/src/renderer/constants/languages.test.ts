import { describe, it, expect } from "vitest";
import type { UploadedFile } from "@aegis/shared";
import { LANG_COLORS, LANG_GROUPS, getLangColor, getLangColorByName } from "./languages";

function makeFile(name: string, language?: string): UploadedFile {
  return { id: "1", name, size: 100, language };
}

describe("LANG_COLORS", () => {
  it("has colors for common languages", () => {
    expect(LANG_COLORS.c).toBeTruthy();
    expect(LANG_COLORS.cpp).toBeTruthy();
    expect(LANG_COLORS.python).toBeTruthy();
    expect(LANG_COLORS.java).toBeTruthy();
    expect(LANG_COLORS.typescript).toBeTruthy();
  });
});

describe("LANG_GROUPS", () => {
  it("groups C and C++ headers together", () => {
    expect(LANG_GROUPS.c.group).toBe(LANG_GROUPS.cpp.group);
    expect(LANG_GROUPS.h.group).toBe(LANG_GROUPS.hpp.group);
  });
});

describe("getLangColor", () => {
  it("returns color from language field", () => {
    expect(getLangColor(makeFile("test.c", "c"))).toBe(LANG_COLORS.c);
  });

  it("falls back to extension when no language", () => {
    // Extension "c" matches LANG_COLORS key directly
    expect(getLangColor(makeFile("test.c"))).toBe(LANG_COLORS.c);
  });

  it("returns fallback for unknown language/extension", () => {
    expect(getLangColor(makeFile("test.xyz"))).toBe("var(--text-tertiary)");
  });
});

describe("getLangColorByName", () => {
  it("returns color for known language", () => {
    expect(getLangColorByName("typescript")).toBe(LANG_COLORS.typescript);
  });

  it("returns fallback for unknown language", () => {
    expect(getLangColorByName("rust")).toBe("var(--text-tertiary)");
    expect(getLangColorByName("")).toBe("var(--text-tertiary)");
  });
});
