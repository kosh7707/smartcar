import { describe, it, expect } from "vitest";
import { highlightCode, highlightLines } from "./highlight";

describe("highlightCode", () => {
  it("returns empty string for empty input", () => {
    expect(highlightCode("")).toBe("");
  });

  it("highlights C code", () => {
    const result = highlightCode('#include <stdio.h>', "c");
    expect(result).toContain("span");
    expect(result).toContain("stdio");
  });

  it("highlights Python code", () => {
    const result = highlightCode("def foo():\n  pass", "python");
    expect(result).toContain("span");
  });

  it("maps file extension to language (cpp)", () => {
    const result = highlightCode("int main() {}", "cpp");
    expect(result).toContain("span");
  });

  it("falls back to auto-detection for unknown language", () => {
    const result = highlightCode("function test() { return 42; }", "unknown-lang");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("escapes HTML on error gracefully", () => {
    const result = highlightCode("<script>alert(1)</script>", undefined);
    // Should either be highlighted or escaped, not raw HTML
    expect(result).not.toContain("<script>");
  });

  it("maps yml extension", () => {
    const result = highlightCode("key: value", "yml");
    expect(result).toContain("span");
  });

  it("maps bash alias", () => {
    const result = highlightCode("echo hello", "bash");
    // bash is registered; may or may not wrap in span depending on hljs version
    expect(result).toContain("hello");
  });
});

describe("highlightLines", () => {
  it("returns array of lines", () => {
    const lines = highlightLines("line1\nline2\nline3", "c");
    expect(lines).toHaveLength(3);
  });

  it("each line is valid HTML (balanced tags)", () => {
    const code = `#include <stdio.h>
int main() {
  printf("hello");
  return 0;
}`;
    const lines = highlightLines(code, "c");
    for (const line of lines) {
      const opens = (line.match(/<span/g) ?? []).length;
      const closes = (line.match(/<\/span>/g) ?? []).length;
      expect(opens).toBe(closes);
    }
  });

  it("returns single line for no newlines", () => {
    const lines = highlightLines("int x = 42;", "c");
    expect(lines).toHaveLength(1);
  });

  it("handles empty code", () => {
    expect(highlightLines("", "c")).toEqual([""]);
  });
});
