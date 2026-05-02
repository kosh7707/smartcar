import type { UploadedFile } from "@aegis/shared";

export const LANG_COLORS: Record<string, string> = {
  c: "#555599",
  cpp: "#004482",
  cc: "#004482",
  cxx: "#004482",
  h: "#6a5acd",
  hpp: "#6a5acd",
  hh: "#6a5acd",
  hxx: "#6a5acd",
  s: "#6e4c13",
  asm: "#6e4c13",
  python: "#3572a5",
  py: "#3572a5",
  java: "#b07219",
  javascript: "#f1e05a",
  js: "#f1e05a",
  typescript: "#3178c6",
  ts: "#3178c6",
  shell: "#89e051",
  sh: "#89e051",
  bash: "#89e051",
  cmake: "#064f8c",
  make: "#427819",
  json: "#292929",
  yaml: "#cb171e",
  yml: "#cb171e",
  xml: "#0060ac",
  toml: "#9c4221",
  markdown: "#083fa1",
  md: "#083fa1",
  txt: "#888888",
  ld: "#6e4c13",
  conf: "#888888",
  cfg: "#888888",
  ini: "#888888",
};

export const LANG_GROUPS: Record<string, { group: string; color: string }> = {
  c: { group: "C/C++", color: "#555599" },
  cpp: { group: "C/C++", color: "#555599" },
  cc: { group: "C/C++", color: "#555599" },
  cxx: { group: "C/C++", color: "#555599" },
  h: { group: "C/C++", color: "#6a5acd" },
  hpp: { group: "C/C++", color: "#6a5acd" },
  hh: { group: "C/C++", color: "#6a5acd" },
  hxx: { group: "C/C++", color: "#6a5acd" },
  s: { group: "Assembly", color: "#6e4c13" },
  asm: { group: "Assembly", color: "#6e4c13" },
  python: { group: "Python", color: "#3572a5" },
  py: { group: "Python", color: "#3572a5" },
  java: { group: "Java", color: "#b07219" },
  javascript: { group: "JavaScript", color: "#f1e05a" },
  js: { group: "JavaScript", color: "#f1e05a" },
  typescript: { group: "TypeScript", color: "#3178c6" },
  ts: { group: "TypeScript", color: "#3178c6" },
  shell: { group: "Shell", color: "#89e051" },
  sh: { group: "Shell", color: "#89e051" },
  bash: { group: "Shell", color: "#89e051" },
  cmake: { group: "Build", color: "#064f8c" },
  make: { group: "Build", color: "#427819" },
  json: { group: "Config", color: "#292929" },
  yaml: { group: "Config", color: "#cb171e" },
  yml: { group: "Config", color: "#cb171e" },
  xml: { group: "Config", color: "#0060ac" },
  toml: { group: "Config", color: "#9c4221" },
  conf: { group: "Config", color: "#888888" },
  cfg: { group: "Config", color: "#888888" },
  ini: { group: "Config", color: "#888888" },
  markdown: { group: "Docs", color: "#083fa1" },
  md: { group: "Docs", color: "#083fa1" },
  txt: { group: "Docs", color: "#888888" },
  ld: { group: "Linker", color: "#6e4c13" },
};

export function getLangColor(file: UploadedFile): string {
  if (file.language && LANG_COLORS[file.language]) return LANG_COLORS[file.language];
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return LANG_COLORS[ext] ?? "var(--foreground-subtle)";
}

/** Get color by language name string (for SourceFileEntry etc.) */
export function getLangColorByName(language: string): string {
  return LANG_COLORS[language] ?? "var(--foreground-subtle)";
}

/** Infer language from filename when S2 doesn't provide one. */
export function inferLanguage(fileName: string): string {
  const lower = fileName.toLowerCase();
  // Special filenames
  if (lower === "cmakelists.txt" || lower.endsWith(".cmake")) return "cmake";
  if (lower === "makefile" || lower.endsWith(".mk")) return "make";
  if (lower === "dockerfile") return "shell";
  // Extension-based
  const ext = lower.split(".").pop() ?? "";
  if (ext in LANG_GROUPS) return ext;
  return "";
}
