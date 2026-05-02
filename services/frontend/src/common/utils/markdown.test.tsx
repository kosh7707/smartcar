import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { renderMarkdown } from "./markdown";

function renderMd(md: string) {
  const { container } = render(<div>{renderMarkdown(md)}</div>);
  return container;
}

describe("renderMarkdown", () => {
  it("renders plain text as paragraph", () => {
    const c = renderMd("Hello world");
    expect(c.querySelector("p")).toBeTruthy();
    expect(c.textContent).toContain("Hello world");
  });

  it("renders headings", () => {
    const c = renderMd("## Heading");
    expect(c.querySelector("h2")).toBeTruthy();
    expect(c.textContent).toContain("Heading");
  });

  it("renders code blocks", () => {
    const c = renderMd("```python\nprint('hello')\n```");
    expect(c.querySelector("pre")).toBeTruthy();
    expect(c.querySelector("code")).toBeTruthy();
    expect(c.querySelector(".markdown-code-block__lang")?.textContent).toBe("python");
  });

  it("renders bullet lists", () => {
    const c = renderMd("- item 1\n- item 2\n- item 3");
    expect(c.querySelector("ul")).toBeTruthy();
    expect(c.querySelectorAll("li").length).toBe(3);
  });

  it("renders numbered lists", () => {
    const c = renderMd("1. first\n2. second");
    expect(c.querySelector("ol")).toBeTruthy();
  });

  it("renders bold text", () => {
    const c = renderMd("This is **bold** text");
    expect(c.querySelector("strong")).toBeTruthy();
    expect(c.querySelector("strong")?.textContent).toBe("bold");
  });

  it("renders inline code", () => {
    const c = renderMd("Use `printf()` here");
    expect(c.querySelector("code")).toBeTruthy();
    expect(c.querySelector("code")?.textContent).toBe("printf()");
    expect(c.querySelector("code")?.className).toContain("markdown-inline-code");
  });

  it("renders italic text", () => {
    const c = renderMd("This is *italic* text");
    expect(c.querySelector("em")).toBeTruthy();
  });

  it("renders links", () => {
    const c = renderMd("[Click here](https://example.com)");
    const link = c.querySelector("a");
    expect(link).toBeTruthy();
    expect(link?.getAttribute("href")).toBe("https://example.com");
  });

  it("renders horizontal rules", () => {
    const c = renderMd("Above\n\n---\n\nBelow");
    expect(c.querySelector("hr")).toBeTruthy();
  });

  it("renders blockquotes", () => {
    const c = renderMd("> This is a quote");
    expect(c.querySelector("blockquote")).toBeTruthy();
  });

  it("renders tables (GFM)", () => {
    const c = renderMd("| A | B |\n|---|---|\n| 1 | 2 |");
    expect(c.querySelector("table")).toBeTruthy();
  });

  it("handles empty input", () => {
    const c = renderMd("");
    expect(c).toBeTruthy();
  });

  it("handles mixed content", () => {
    const c = renderMd("## Title\n\nSome text\n\n```c\nint main() {}\n```\n\n- bullet");
    expect(c.querySelector("h2")).toBeTruthy();
    expect(c.querySelector("pre")).toBeTruthy();
    expect(c.querySelector("ul")).toBeTruthy();
  });
});
