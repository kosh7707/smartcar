import { describe, it, expect } from "vitest";
import React from "react";
import { highlightCVEs } from "./cveHighlight";

function flattenNode(node: React.ReactNode): string {
  if (node === null || node === undefined) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenNode).join("");
  if (React.isValidElement(node)) {
    const { children } = node.props as { children?: React.ReactNode };
    const tag = node.type;
    if (typeof tag === "string") return `<${tag}>${flattenNode(children)}</${tag}>`;
    return flattenNode(children);
  }
  return "";
}

describe("highlightCVEs", () => {
  it("highlights a single CVE", () => {
    const result = flattenNode(highlightCVEs("Found CVE-2025-55763 in civetweb"));
    expect(result).toContain("<span>CVE-2025-55763</span>");
    expect(result).toContain("Found ");
    expect(result).toContain(" in civetweb");
  });

  it("highlights multiple CVEs", () => {
    const result = flattenNode(highlightCVEs("CVE-2024-1234 and CVE-2025-5678"));
    expect(result).toContain("<span>CVE-2024-1234</span>");
    expect(result).toContain("<span>CVE-2025-5678</span>");
  });

  it("returns plain text when no CVE", () => {
    const result = highlightCVEs("No CVE here");
    expect(result).toBe("No CVE here");
  });

  it("handles empty string", () => {
    expect(highlightCVEs("")).toBe("");
  });

  it("handles CVE at start of string", () => {
    const result = flattenNode(highlightCVEs("CVE-2025-12345 is critical"));
    expect(result).toContain("<span>CVE-2025-12345</span>");
    expect(result).toContain(" is critical");
  });

  it("handles CVE at end of string", () => {
    const result = flattenNode(highlightCVEs("Vulnerability: CVE-2025-99999"));
    expect(result).toContain("<span>CVE-2025-99999</span>");
  });

  it("does not match partial CVE patterns", () => {
    const result = highlightCVEs("CVE-20 is not valid");
    expect(result).toBe("CVE-20 is not valid");
  });
});
