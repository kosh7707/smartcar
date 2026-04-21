export type FileClass =
  | "text"
  | "archive"
  | "executable"
  | "image"
  | "media"
  | "document"
  | "font"
  | "unknown-binary";

const ARCHIVE = new Set([
  "zip", "tar", "gz", "tgz", "bz2", "tbz2", "xz", "txz", "7z", "rar", "zst",
]);
const EXECUTABLE = new Set([
  "exe", "dll", "so", "dylib", "bin", "a", "o", "lib", "ko", "elf", "out",
]);
const IMAGE = new Set([
  "png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp", "tiff", "tif", "avif", "heic",
]);
const MEDIA = new Set([
  "mp3", "mp4", "wav", "mov", "avi", "flac", "mkv", "webm", "m4a", "m4v", "ogg", "opus",
]);
const DOCUMENT = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "rtf",
]);
const FONT = new Set([
  "ttf", "otf", "woff", "woff2", "eot",
]);

function lastExt(path: string): string {
  const name = path.split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return "";
  return name.slice(dot + 1).toLowerCase();
}

export function getFileClass(path: string, language?: string | null): FileClass {
  const ext = lastExt(path);
  if (ARCHIVE.has(ext)) return "archive";
  if (EXECUTABLE.has(ext)) return "executable";
  if (IMAGE.has(ext)) return "image";
  if (MEDIA.has(ext)) return "media";
  if (DOCUMENT.has(ext)) return "document";
  if (FONT.has(ext)) return "font";
  // Fallback: extension-less files with an unknown/blank language are almost
  // always binary (Linux executables, stripped artifacts, unknown blobs).
  const lang = (language ?? "").trim().toLowerCase();
  if (!ext && (lang === "" || lang === "unknown" || lang === "binary")) {
    return "unknown-binary";
  }
  return "text";
}

export const FILE_CLASS_LABEL: Record<Exclude<FileClass, "text">, string> = {
  archive: "아카이브",
  executable: "실행 파일",
  image: "이미지",
  media: "미디어",
  document: "문서",
  font: "폰트",
  "unknown-binary": "바이너리",
};
