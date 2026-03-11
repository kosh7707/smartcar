import type { AnalysisWarning } from "@smartcar/shared";
import type { StoredFile } from "../dao/file-store";

const CHARS_PER_TOKEN = 3.5;
const MAX_TOKENS_PER_CHUNK = 6000;
const MAX_CHARS_PER_CHUNK = MAX_TOKENS_PER_CHUNK * CHARS_PER_TOKEN; // ~21,000

export interface FileChunk {
  files: StoredFile[];
  sourceCode: string;
  estimatedTokens: number;
}

export interface ChunkResult {
  chunks: FileChunk[];
  warnings: AnalysisWarning[];
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function formatFile(file: StoredFile): string {
  return `// === ${file.path || file.name} ===\n${file.content}`;
}

export function chunkFiles(files: StoredFile[]): ChunkResult {
  const chunks: FileChunk[] = [];
  const warnings: AnalysisWarning[] = [];

  let currentFiles: StoredFile[] = [];
  let currentParts: string[] = [];
  let currentChars = 0;

  for (const file of files) {
    const formatted = formatFile(file);
    const fileChars = formatted.length;

    // 단일 파일이 예산 초과 → 단독 청크 + warning
    if (fileChars > MAX_CHARS_PER_CHUNK) {
      // 현재 청크가 있으면 먼저 flush
      if (currentFiles.length > 0) {
        chunks.push({
          files: currentFiles,
          sourceCode: currentParts.join("\n\n"),
          estimatedTokens: estimateTokens(currentParts.join("\n\n")),
        });
        currentFiles = [];
        currentParts = [];
        currentChars = 0;
      }

      chunks.push({
        files: [file],
        sourceCode: formatted,
        estimatedTokens: estimateTokens(formatted),
      });
      warnings.push({
        code: "CHUNK_TOO_LARGE",
        message: `File "${file.path || file.name}" exceeds chunk budget (${estimateTokens(formatted)} tokens)`,
        details: file.id,
      });
      continue;
    }

    // 현재 청크에 추가하면 초과 → flush 후 새 청크
    if (currentChars + fileChars > MAX_CHARS_PER_CHUNK && currentFiles.length > 0) {
      chunks.push({
        files: currentFiles,
        sourceCode: currentParts.join("\n\n"),
        estimatedTokens: estimateTokens(currentParts.join("\n\n")),
      });
      currentFiles = [];
      currentParts = [];
      currentChars = 0;
    }

    currentFiles.push(file);
    currentParts.push(formatted);
    currentChars += fileChars;
  }

  // 남은 파일 flush
  if (currentFiles.length > 0) {
    chunks.push({
      files: currentFiles,
      sourceCode: currentParts.join("\n\n"),
      estimatedTokens: estimateTokens(currentParts.join("\n\n")),
    });
  }

  return { chunks, warnings };
}
