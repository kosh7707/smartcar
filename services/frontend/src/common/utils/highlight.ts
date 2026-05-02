import hljs from "highlight.js/lib/core";
import "./highlight.css";

// Register only needed languages (bundle size optimization)
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import python from "highlight.js/lib/languages/python";
import shell from "highlight.js/lib/languages/shell";
import cmake from "highlight.js/lib/languages/cmake";
import makefile from "highlight.js/lib/languages/makefile";
import json from "highlight.js/lib/languages/json";
import yaml from "highlight.js/lib/languages/yaml";
import xml from "highlight.js/lib/languages/xml";
import markdown from "highlight.js/lib/languages/markdown";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import java from "highlight.js/lib/languages/java";
import armasm from "highlight.js/lib/languages/armasm";

hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("python", python);
hljs.registerLanguage("shell", shell);
hljs.registerLanguage("bash", shell);
hljs.registerLanguage("sh", shell);
hljs.registerLanguage("cmake", cmake);
hljs.registerLanguage("makefile", makefile);
hljs.registerLanguage("make", makefile);
hljs.registerLanguage("json", json);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("java", java);
hljs.registerLanguage("armasm", armasm);

// Map S2 language / file extension → hljs language name
const LANG_MAP: Record<string, string> = {
  c: "c", h: "c", hpp: "cpp", hh: "cpp", hxx: "cpp",
  cc: "cpp", cxx: "cpp", cpp: "cpp",
  py: "python", python: "python",
  sh: "bash", bash: "bash", shell: "bash",
  cmake: "cmake",
  make: "makefile", mk: "makefile",
  json: "json",
  yaml: "yaml", yml: "yaml",
  xml: "xml",
  md: "markdown", markdown: "markdown",
  js: "javascript", javascript: "javascript",
  ts: "typescript", typescript: "typescript",
  java: "java",
  s: "armasm", asm: "armasm",
};

/**
 * Highlight source code and return HTML string.
 * If language is known, uses it directly; otherwise falls back to auto-detection.
 */
export function highlightCode(code: string, language?: string): string {
  if (!code) return "";
  try {
    const mapped = language ? LANG_MAP[language.toLowerCase()] : undefined;
    if (mapped && hljs.getLanguage(mapped)) {
      return hljs.highlight(code, { language: mapped }).value;
    }
    // Auto-detect fallback
    return hljs.highlightAuto(code).value;
  } catch {
    return escapeHtml(code);
  }
}

/**
 * Highlight code and split into lines (for line-by-line rendering with line numbers).
 * Returns HTML strings per line.
 */
export function highlightLines(code: string, language?: string): string[] {
  const highlighted = highlightCode(code, language);
  // Split by newline, preserving open/close span tags across lines
  return rebalanceLines(highlighted.split("\n"));
}

/** Escape HTML entities for plain text fallback. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * hljs produces spans that can cross line boundaries.
 * Rebalance so each line is independently valid HTML.
 */
function rebalanceLines(lines: string[]): string[] {
  const result: string[] = [];
  let openTags: string[] = [];

  for (const line of lines) {
    // Prepend unclosed tags from previous line
    let balanced = openTags.join("") + line;

    // Track open/close spans
    const opens = balanced.match(/<span[^>]*>/g) ?? [];
    const closes = balanced.match(/<\/span>/g) ?? [];

    // Close any unclosed spans at end of line
    const unclosed = opens.length - closes.length;
    if (unclosed > 0) {
      for (let i = 0; i < unclosed; i++) balanced += "</span>";
    }

    result.push(balanced);

    // Carry forward open tags for next line
    openTags = [];
    if (unclosed > 0) {
      // Collect the last N unclosed opening tags
      openTags = opens.slice(opens.length - unclosed);
    }
  }

  return result;
}
