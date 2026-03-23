import type { UploadedFile } from "@aegis/shared";

export const LANG_COLORS: Record<string, string> = {
  c: "#555599",
  cpp: "#004482",
  h: "#6a5acd",
  hpp: "#6a5acd",
  python: "#3572a5",
  java: "#b07219",
  javascript: "#f1e05a",
  typescript: "#3178c6",
};

export const LANG_GROUPS: Record<string, { group: string; color: string }> = {
  c: { group: "C/C++", color: "#555599" },
  cpp: { group: "C/C++", color: "#555599" },
  h: { group: "C/C++", color: "#6a5acd" },
  hpp: { group: "C/C++", color: "#6a5acd" },
  python: { group: "Python", color: "#3572a5" },
  java: { group: "Java", color: "#b07219" },
  javascript: { group: "JavaScript", color: "#f1e05a" },
  typescript: { group: "TypeScript", color: "#3178c6" },
};

export function getLangColor(file: UploadedFile): string {
  if (file.language && LANG_COLORS[file.language]) return LANG_COLORS[file.language];
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return LANG_COLORS[ext] ?? "var(--text-tertiary)";
}

/** Get color by language name string (for SourceFileEntry etc.) */
export function getLangColorByName(language: string): string {
  return LANG_COLORS[language] ?? "var(--text-tertiary)";
}
