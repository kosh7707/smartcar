import { describe, it, expect } from "vitest";
import React from "react";
import { renderMarkdown } from "./markdown";

// Helper: render to simplified string for testing
function renderToText(node: React.ReactNode): string {
  return flattenNode(node);
}

function flattenNode(node: React.ReactNode): string {
  if (node === null || node === undefined) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenNode).join("");
  if (React.isValidElement(node)) {
    const { children } = node.props as { children?: React.ReactNode };
    const tag = node.type;
    if (typeof tag === "string") {
      const inner = flattenNode(children);
      return `<${tag}>${inner}</${tag}>`;
    }
    return flattenNode(children);
  }
  return "";
}

describe("renderMarkdown", () => {
  it("renders plain text as paragraph", () => {
    const result = renderToText(renderMarkdown("Hello world"));
    expect(result).toContain("<p>");
    expect(result).toContain("Hello world");
  });

  it("renders headings", () => {
    const result = renderToText(renderMarkdown("## Heading"));
    expect(result).toContain("<h3>");
    expect(result).toContain("Heading");
  });

  it("renders code blocks", () => {
    const md = "```python\nprint('hello')\n```";
    const result = renderToText(renderMarkdown(md));
    expect(result).toContain("<pre>");
    expect(result).toContain("<code>");
    expect(result).toContain("print('hello')");
    expect(result).toContain("<span>python</span>");
  });

  it("renders bullet lists", () => {
    const md = "- item 1\n- item 2\n- item 3";
    const result = renderToText(renderMarkdown(md));
    expect(result).toContain("<ul>");
    expect(result).toContain("<li>item 1</li>");
    expect(result).toContain("<li>item 2</li>");
  });

  it("renders numbered lists", () => {
    const md = "1. first\n2. second";
    const result = renderToText(renderMarkdown(md));
    expect(result).toContain("<ol>");
    expect(result).toContain("<li>first</li>");
  });

  it("renders bold text", () => {
    const result = renderToText(renderMarkdown("This is **bold** text"));
    expect(result).toContain("<strong>bold</strong>");
  });

  it("renders inline code", () => {
    const result = renderToText(renderMarkdown("Use `printf()` here"));
    expect(result).toContain("<code>printf()</code>");
  });

  it("renders italic text", () => {
    const result = renderToText(renderMarkdown("This is *italic* text"));
    expect(result).toContain("<em>italic</em>");
  });

  it("handles \\r\\n line endings", () => {
    const md = "Line 1\r\n\r\nLine 2";
    const result = renderToText(renderMarkdown(md));
    expect(result).toContain("Line 1");
    expect(result).toContain("Line 2");
  });

  it("handles empty input", () => {
    const result = renderMarkdown("");
    expect(result).toBeDefined();
  });

  it("handles mixed content (heading + code + text)", () => {
    const md = "## Title\n\nSome text\n\n```c\nint main() {}\n```\n\n- bullet";
    const result = renderToText(renderMarkdown(md));
    expect(result).toContain("<h3>");
    expect(result).toContain("Some text");
    expect(result).toContain("<pre>");
    expect(result).toContain("<ul>");
  });
});
