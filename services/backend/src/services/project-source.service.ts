/**
 * 프로젝트 소스코드 파일시스템 관리
 *
 * ZIP/tar.gz 추출, Git clone, 파일 목록/읽기/삭제.
 * 저장 위치: uploads/{projectId}/
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";
import { createLogger } from "../lib/logger";
import { InvalidInputError, NotFoundError } from "../lib/errors";

const logger = createLogger("project-source");

const C_CPP_EXTENSIONS = new Set([
  ".c", ".cpp", ".cc", ".cxx",
  ".h", ".hpp", ".hh", ".hxx",
]);

export type FileType =
  | "source" | "config" | "build" | "script" | "doc" | "linker"
  | "executable" | "object" | "shared-lib"
  | "archive" | "image" | "unknown";

export interface SourceFileEntry {
  relativePath: string;
  size: number;
  language: string;
  fileType: FileType;
  previewable: boolean;
}

export interface ProjectSourceQuarantine {
  projectId: string;
  projectPath: string;
  quarantinedPath?: string;
}

interface ListFilesOptions {
  excludeManagedSdkSubtree?: boolean;
}

function isManagedSdkDirectory(baseDir: string, currentDir: string, entryName: string): boolean {
  return currentDir === path.join(baseDir, "sdk") && /^sdk-[\w-]+$/.test(entryName);
}

const FILE_TYPE_MAP: Record<string, FileType> = {
  // source
  ".c": "source", ".cpp": "source", ".cc": "source", ".cxx": "source",
  ".h": "source", ".hpp": "source", ".hh": "source", ".hxx": "source",
  ".s": "source", ".asm": "source", ".inl": "source",
  ".py": "source", ".java": "source", ".js": "source", ".ts": "source",
  ".jsx": "source", ".tsx": "source",
  // config
  ".json": "config", ".yaml": "config", ".yml": "config", ".toml": "config",
  ".xml": "config", ".cfg": "config", ".ini": "config", ".conf": "config",
  ".env": "config", ".crt": "config", ".key": "config", ".csr": "config",
  ".cnf": "config", ".pem": "config", ".tmpl": "config", ".meta": "config",
  ".dat": "config", ".config": "config", ".example": "config",
  ".lp": "config", ".riot": "config", ".contiki": "config",
  ".ci": "config", ".ssjs": "config", ".pwfile": "config",
  ".internal": "config", ".syms": "config", ".attr": "config", ".psk": "config",
  // build
  ".cmake": "build", ".mk": "build", ".make": "build", ".in": "build",
  ".vcxproj": "build", ".filters": "build", ".sln": "build",
  ".am": "build", ".ac": "build", ".m4": "build",
  // script
  ".sh": "script", ".bat": "script", ".ps1": "script", ".cmd": "script",
  ".lua": "script", ".cgi": "script", ".pl": "script", ".coffee": "script",
  // doc
  ".md": "doc", ".txt": "doc", ".rst": "doc", ".log": "doc", ".csv": "doc",
  ".html": "doc", ".htm": "doc", ".css": "doc", ".info": "doc",
  ".xhtml": "doc", ".xsl": "doc", ".dot": "doc",
  ".1": "doc", ".3": "doc", ".5": "doc", ".8": "doc",
  ".nsi": "script",
  // linker
  ".ld": "linker", ".lds": "linker", ".icf": "linker",
  // executable
  ".elf": "executable", ".exe": "executable", ".out": "executable", ".hex": "executable", ".srec": "executable", ".axf": "executable", ".bin": "executable",
  // object
  ".o": "object", ".obj": "object", ".a": "object", ".lib": "object", ".ko": "object",
  ".d": "object", ".map": "object", ".md5": "object", ".test-db": "object",
  // shared-lib
  ".so": "shared-lib", ".dll": "shared-lib", ".dylib": "shared-lib",
  // archive
  ".zip": "archive", ".tar": "archive", ".gz": "archive", ".tgz": "archive",
  ".bz2": "archive", ".xz": "archive", ".7z": "archive", ".rar": "archive",
  // image
  ".png": "image", ".jpg": "image", ".jpeg": "image", ".gif": "image",
  ".bmp": "image", ".ico": "image", ".svg": "image", ".webp": "image",
};

const PREVIEWABLE_TYPES: Set<FileType> = new Set([
  "source", "config", "build", "script", "doc", "linker",
]);

const FILENAME_TYPE_MAP: Record<string, FileType> = {
  "makefile": "build", "cmakelists.txt": "build", "kconfig": "build", "kbuild": "build",
  "dockerfile": "build", "doxyfile": "config",
  "license": "doc", "readme": "doc", "changelog": "doc", "authors": "doc",
  "todo": "doc", "copying": "doc", "news": "doc", "contribute": "doc", "building": "doc",
  ".gitignore": "config", ".dockerignore": "config",
  ".clang-format": "config", ".clang-tidy": "config", ".editorconfig": "config",
};

export class ProjectSourceService {
  private uploadsDir: string;

  constructor(uploadsDir: string) {
    this.uploadsDir = path.resolve(uploadsDir);
    fs.mkdirSync(this.uploadsDir, { recursive: true });
  }

  getProjectPath(projectId: string): string | null {
    const dir = path.join(this.uploadsDir, projectId);
    return fs.existsSync(dir) ? dir : null;
  }

  async extractArchive(projectId: string, archiveBuffer: Buffer, originalName?: string): Promise<string> {
    const projectDir = path.join(this.uploadsDir, projectId);

    // 기존 소스 삭제 후 재추출
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
    fs.mkdirSync(projectDir, { recursive: true });

    // 포맷 판별: 매직 바이트 우선, 파일명 폴백
    const format = this.detectArchiveFormat(archiveBuffer, originalName);

    const tmpFile = path.join(projectDir, `__upload${format === "zip" ? ".zip" : ".tar.gz"}`);
    fs.writeFileSync(tmpFile, archiveBuffer);

    try {
      if (format === "zip") {
        execSync(`unzip -o -q "${tmpFile}" -d "${projectDir}"`, {
          timeout: 60000,
          stdio: "pipe",
        });
      } else {
        // tar, tar.gz, tar.bz2, tgz
        execSync(`tar -xf "${tmpFile}" -C "${projectDir}"`, {
          timeout: 60000,
          stdio: "pipe",
        });
      }
    } catch (err) {
      fs.rmSync(projectDir, { recursive: true, force: true });
      throw new InvalidInputError(
        `Failed to extract archive (detected: ${format}). Supported formats: ZIP, tar, tar.gz, tar.bz2`,
        err,
      );
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }

    // 단일 디렉토리로 감싸져 있으면 한 단계 올림
    this.flattenSingleRoot(projectDir);

    const fileCount = this.listFiles(projectId).length;
    logger.info({ projectId, projectDir, fileCount, format }, "Source extracted");
    this.invalidateCompositionCache(projectId);
    return projectDir;
  }

  /** 하위 호환: 기존 extractZip 호출도 동작 */
  async extractZip(projectId: string, zipBuffer: Buffer): Promise<string> {
    return this.extractArchive(projectId, zipBuffer);
  }

  private detectArchiveFormat(buffer: Buffer, originalName?: string): "zip" | "tar" {
    // 매직 바이트 판별
    if (buffer.length >= 4) {
      // ZIP: PK\x03\x04
      if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
        return "zip";
      }
      // gzip: \x1f\x8b
      if (buffer[0] === 0x1F && buffer[1] === 0x8B) {
        return "tar";
      }
      // bzip2: BZ
      if (buffer[0] === 0x42 && buffer[1] === 0x5A) {
        return "tar";
      }
      // tar: "ustar" at offset 257
      if (buffer.length > 262 && buffer.toString("ascii", 257, 262) === "ustar") {
        return "tar";
      }
    }

    // 파일명 폴백
    if (originalName) {
      const lower = originalName.toLowerCase();
      if (lower.endsWith(".zip")) return "zip";
      if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz") || lower.endsWith(".tar.bz2") || lower.endsWith(".tar")) return "tar";
    }

    // 기본: tar (unzip보다 tar가 더 많은 포맷 지원)
    return "tar";
  }

  async cloneGit(
    projectId: string,
    gitUrl: string,
    branch?: string,
  ): Promise<string> {
    const projectDir = path.join(this.uploadsDir, projectId);

    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }

    const branchArg = branch ? `--branch ${branch}` : "";
    try {
      execSync(
        `git clone --depth 1 ${branchArg} "${gitUrl}" "${projectDir}"`,
        { timeout: 120000, stdio: "pipe" },
      );
    } catch (err) {
      throw new InvalidInputError(
        `Git clone failed: ${err instanceof Error ? err.message : "unknown error"}`,
        err,
      );
    }

    const fileCount = this.listFiles(projectId).length;
    logger.info({ projectId, gitUrl, branch, fileCount }, "Source cloned");
    this.invalidateCompositionCache(projectId);
    return projectDir;
  }

  /** 개별 소스파일을 프로젝트 디렉토리에 저장 */
  async saveFiles(
    projectId: string,
    files: Array<{ name: string; buffer: Buffer }>,
  ): Promise<number> {
    const projectDir = path.join(this.uploadsDir, projectId);
    fs.mkdirSync(projectDir, { recursive: true });

    let saved = 0;
    for (const file of files) {
      // 경로 탈출 방지
      const filePath = path.join(projectDir, file.name);
      const resolved = path.resolve(filePath);
      if (!resolved.startsWith(projectDir)) {
        logger.warn({ projectId, fileName: file.name }, "Skipped file: directory traversal");
        continue;
      }

      // 하위 디렉토리 생성
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(resolved, file.buffer);
      saved++;
    }

    logger.info({ projectId, saved, total: files.length }, "Source files saved");
    return saved;
  }

  /**
   * 선택된 파일/폴더를 서브 프로젝트 디렉토리로 물리적 복사.
   * uploads/{projectId}/{targetId}/ 에 완전 독립 복사본 생성.
   */
  copyToSubproject(
    projectId: string,
    targetId: string,
    includedPaths: string[],
  ): string {
    const projectDir = this.getProjectPath(projectId);
    if (!projectDir) throw new NotFoundError(`Project source not found: ${projectId}`);

    const subDir = path.join(this.uploadsDir, projectId, targetId);

    // 기존 서브 프로젝트 디렉토리 삭제 후 재생성
    if (fs.existsSync(subDir)) {
      fs.rmSync(subDir, { recursive: true, force: true });
    }
    fs.mkdirSync(subDir, { recursive: true });

    let copiedFiles = 0;
    for (const includedPath of includedPaths) {
      const srcPath = path.join(projectDir, includedPath);
      const resolved = path.resolve(srcPath);

      // 경로 탈출 방지
      if (!resolved.startsWith(projectDir)) {
        logger.warn({ projectId, targetId, includedPath }, "Skipped: directory traversal");
        continue;
      }

      if (!fs.existsSync(resolved)) {
        logger.warn({ projectId, targetId, includedPath }, "Skipped: not found");
        continue;
      }

      const destPath = path.join(subDir, includedPath);

      if (fs.statSync(resolved).isDirectory()) {
        // 디렉토리 재귀 복사
        this.copyDirRecursive(resolved, destPath);
        copiedFiles += this.countFiles(destPath);
      } else {
        // 단일 파일 복사
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(resolved, destPath);
        copiedFiles++;
      }
    }

    logger.info({ projectId, targetId, includedPaths: includedPaths.length, copiedFiles }, "Subproject source copied");
    return subDir;
  }

  private copyDirRecursive(src: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const srcChild = path.join(src, entry.name);
      const destChild = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        this.copyDirRecursive(srcChild, destChild);
      } else {
        fs.copyFileSync(srcChild, destChild);
      }
    }
  }

  private countFiles(dir: string): number {
    let count = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) count += this.countFiles(full);
      else count++;
    }
    return count;
  }

  /** 파일 목록. extensions=null이면 전체 파일, 기본값은 C/C++ 필터. */
  listFiles(projectId: string, extensions?: Set<string> | null): SourceFileEntry[] {
    return this.listFilesInternal(projectId, extensions);
  }

  /** 파일 탐색기/소스 목록 전용 파일 목록. managed SDK subtree는 제외한다. */
  listFilesForExplorer(projectId: string, extensions?: Set<string> | null): SourceFileEntry[] {
    return this.listFilesInternal(projectId, extensions, { excludeManagedSdkSubtree: true });
  }

  private listFilesInternal(
    projectId: string,
    extensions?: Set<string> | null,
    options?: ListFilesOptions,
  ): SourceFileEntry[] {
    const projectDir = this.getProjectPath(projectId);
    if (!projectDir) return [];

    const exts = extensions === null ? null : (extensions ?? C_CPP_EXTENSIONS);
    const entries: SourceFileEntry[] = [];
    this.walkDir(projectDir, projectDir, exts, entries, options);
    return entries;
  }

  readFile(projectId: string, relativePath: string): string {
    const projectDir = this.getProjectPath(projectId);
    if (!projectDir) throw new NotFoundError(`Project source not found: ${projectId}`);

    const filePath = path.join(projectDir, relativePath);
    const resolved = path.resolve(filePath);
    // 경로 탈출 방지
    if (!resolved.startsWith(projectDir)) {
      throw new InvalidInputError("Invalid file path: directory traversal");
    }

    if (!fs.existsSync(resolved)) {
      throw new NotFoundError(`File not found: ${relativePath}`);
    }
    return fs.readFileSync(resolved, "utf-8");
  }

  // ── composition 캐시 (프로젝트 디렉토리 mtime 기반 무효화) ──
  private compositionCache = new Map<string, {
    result: { composition: Record<string, { count: number; bytes: number }>; totalFiles: number; totalSize: number };
    mtimeMs: number;
  }>();

  /** 프로젝트 소스코드 구성 집계 (GitHub Linguist 스타일). mtime 기반 캐싱. */
  computeComposition(projectId: string): { composition: Record<string, { count: number; bytes: number }>; totalFiles: number; totalSize: number } {
    const projectDir = this.getProjectPath(projectId);
    if (!projectDir) return { composition: {}, totalFiles: 0, totalSize: 0 };

    // 프로젝트 디렉토리의 mtime으로 캐시 유효성 판별
    let dirMtime = 0;
    try { dirMtime = fs.statSync(projectDir).mtimeMs; } catch { /* noop */ }

    const cached = this.compositionCache.get(projectId);
    if (cached && cached.mtimeMs === dirMtime) {
      return cached.result;
    }

    const files = this.listFiles(projectId, null);
    const composition: Record<string, { count: number; bytes: number }> = {};
    let totalSize = 0;

    for (const f of files) {
      const group = this.languageToGroup(f.language);
      if (!composition[group]) composition[group] = { count: 0, bytes: 0 };
      composition[group].count++;
      composition[group].bytes += f.size;
      totalSize += f.size;
    }

    const result = { composition, totalFiles: files.length, totalSize };
    this.compositionCache.set(projectId, { result, mtimeMs: dirMtime });
    return result;
  }

  /** 파일 탐색기/소스 목록 전용 composition. managed SDK subtree는 제외한다. */
  computeCompositionForExplorer(projectId: string): { composition: Record<string, { count: number; bytes: number }>; totalFiles: number; totalSize: number } {
    const files = this.listFilesForExplorer(projectId, null);
    const composition: Record<string, { count: number; bytes: number }> = {};
    let totalSize = 0;

    for (const f of files) {
      const group = this.languageToGroup(f.language);
      if (!composition[group]) composition[group] = { count: 0, bytes: 0 };
      composition[group].count++;
      composition[group].bytes += f.size;
      totalSize += f.size;
    }

    return { composition, totalFiles: files.length, totalSize };
  }

  /** 특정 프로젝트의 composition 캐시 무효화 (업로드/삭제 후 호출) */
  invalidateCompositionCache(projectId: string): void {
    this.compositionCache.delete(projectId);
  }

  private languageToGroup(language: string): string {
    const map: Record<string, string> = {
      "c": "C/C++", "cpp": "C/C++",
      "assembly": "Assembly",
      "python": "Python", "java": "Java",
      "javascript": "JavaScript", "typescript": "TypeScript",
      "shell": "Shell", "powershell": "Shell",
      "lua": "Lua", "perl": "Perl",
      "cmake": "Build", "make": "Build",
      "json": "Config", "yaml": "Config", "toml": "Config",
      "xml": "Config", "config": "Config",
      "html": "HTML/CSS", "css": "HTML/CSS",
      "markdown": "Docs", "text": "Docs", "restructuredtext": "Docs",
      "linker-script": "Linker",
      "sql": "SQL",
    };
    return map[language] ?? "Other";
  }

  /** 개별 파일의 메타데이터 (size, language, fileType, previewable) */
  getFileMetadata(projectId: string, relativePath: string): { size: number; language: string; fileType: FileType; previewable: boolean; lineCount?: number } {
    const projectDir = this.getProjectPath(projectId);
    if (!projectDir) throw new NotFoundError(`Project source not found: ${projectId}`);

    const filePath = path.join(projectDir, relativePath);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(projectDir)) {
      throw new InvalidInputError("Invalid file path: directory traversal");
    }

    const stat = fs.statSync(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const filename = path.basename(resolved);
    const ft = this.classifyFile(ext, filename);
    const lang = this.detectLanguageByName(filename) ?? this.detectLanguage(ext);

    const result: { size: number; language: string; fileType: FileType; previewable: boolean; lineCount?: number } = {
      size: stat.size,
      language: lang,
      fileType: ft,
      previewable: PREVIEWABLE_TYPES.has(ft),
    };

    // 텍스트 파일이면 lineCount 계산
    if (PREVIEWABLE_TYPES.has(ft)) {
      try {
        const content = fs.readFileSync(resolved, "utf-8");
        result.lineCount = content.split("\n").length;
      } catch { /* 읽기 실패 시 lineCount 생략 */ }
    }

    return result;
  }

  deleteSource(projectId: string): void {
    const projectDir = path.join(this.uploadsDir, projectId);
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
      this.invalidateCompositionCache(projectId);
      logger.info({ projectId }, "Source deleted");
    }
  }

  quarantineProjectRoot(projectId: string): ProjectSourceQuarantine {
    const projectPath = path.join(this.uploadsDir, projectId);
    if (!fs.existsSync(projectPath)) {
      return { projectId, projectPath };
    }

    const quarantinedPath = path.join(
      this.uploadsDir,
      `.quarantine-${projectId}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    );

    fs.renameSync(projectPath, quarantinedPath);
    this.invalidateCompositionCache(projectId);
    logger.info({ projectId, quarantinedPath }, "Project root quarantined");
    return { projectId, projectPath, quarantinedPath };
  }

  restoreQuarantinedProjectRoot(state: ProjectSourceQuarantine): void {
    if (!state.quarantinedPath || !fs.existsSync(state.quarantinedPath)) return;
    if (fs.existsSync(state.projectPath)) {
      throw new InvalidInputError(`Project path already exists during restore: ${state.projectPath}`);
    }
    fs.renameSync(state.quarantinedPath, state.projectPath);
    this.invalidateCompositionCache(state.projectId);
    logger.warn({ projectId: state.projectId, quarantinedPath: state.quarantinedPath }, "Project root restored from quarantine");
  }

  removeQuarantinedProjectRoot(state: ProjectSourceQuarantine): void {
    if (!state.quarantinedPath || !fs.existsSync(state.quarantinedPath)) return;
    fs.rmSync(state.quarantinedPath, { recursive: true, force: true });
    this.invalidateCompositionCache(state.projectId);
    logger.info({ projectId: state.projectId, quarantinedPath: state.quarantinedPath }, "Quarantined project root removed");
  }

  private walkDir(
    baseDir: string,
    currentDir: string,
    extensions: Set<string> | null,
    result: SourceFileEntry[],
    options?: ListFilesOptions,
  ): void {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      // 숨김 파일/디렉토리, node_modules, .git, build 제외
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "build") continue;

      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (options?.excludeManagedSdkSubtree && isManagedSdkDirectory(baseDir, currentDir, entry.name)) {
          continue;
        }
        this.walkDir(baseDir, fullPath, extensions, result, options);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions === null || extensions.has(ext)) {
          const stat = fs.statSync(fullPath);
          let ft = this.classifyFile(ext, entry.name);
          // unknown + 확장자 없음 → 매직 바이트로 바이너리 감지
          if (ft === "unknown" && !ext) {
            ft = this.detectBinaryByMagic(fullPath) ?? "unknown";
          }
          result.push({
            relativePath: path.relative(baseDir, fullPath),
            size: stat.size,
            language: this.detectLanguageByName(entry.name) ?? this.detectLanguage(ext),
            fileType: ft,
            previewable: PREVIEWABLE_TYPES.has(ft),
          });
        }
      }
    }
  }

  private classifyFile(ext: string, filename: string): FileType {
    // 파일명 우선 (CMakeLists.txt → build, LICENSE → doc 등)
    const byName = FILENAME_TYPE_MAP[filename.toLowerCase()];
    if (byName) return byName;
    // 확장자 매핑
    const mapped = FILE_TYPE_MAP[ext];
    if (mapped) return mapped;
    // 확장자 없으면 unknown
    return "unknown";
  }

  /** 매직 바이트로 바이너리 판별 (확장자 없는 실행파일 감지) */
  private detectBinaryByMagic(fullPath: string): FileType | null {
    try {
      const fd = fs.openSync(fullPath, "r");
      const buf = Buffer.alloc(4);
      fs.readSync(fd, buf, 0, 4, 0);
      fs.closeSync(fd);
      // ELF: \x7fELF
      if (buf[0] === 0x7F && buf[1] === 0x45 && buf[2] === 0x4C && buf[3] === 0x46) return "executable";
      // Mach-O: \xCF\xFA\xED\xFE or \xFE\xED\xFA\xCF
      if ((buf[0] === 0xCF && buf[1] === 0xFA) || (buf[0] === 0xFE && buf[1] === 0xED)) return "executable";
      // PE/COFF (Windows): MZ
      if (buf[0] === 0x4D && buf[1] === 0x5A) return "executable";
    } catch { /* 읽기 실패 시 무시 */ }
    return null;
  }

  private detectLanguageByName(filename: string): string | null {
    const map: Record<string, string> = {
      "cmakelists.txt": "cmake", "makefile": "cmake", "kconfig": "make", "kbuild": "make",
      "dockerfile": "docker", "doxyfile": "config",
      "license": "text", "readme": "markdown", "changelog": "markdown", "authors": "text",
    };
    return map[filename.toLowerCase()] ?? null;
  }

  private detectLanguage(ext: string): string {
    const map: Record<string, string> = {
      ".c": "c", ".h": "c", ".cpp": "cpp", ".cc": "cpp", ".cxx": "cpp",
      ".hpp": "cpp", ".hh": "cpp", ".hxx": "cpp",
      ".s": "assembly", ".asm": "assembly",
      ".py": "python", ".java": "java", ".js": "javascript", ".ts": "typescript",
      ".jsx": "javascript", ".tsx": "typescript",
      ".sh": "shell", ".bat": "shell", ".ps1": "powershell", ".cmd": "shell",
      ".lua": "lua", ".cgi": "perl",
      ".json": "json", ".yaml": "yaml", ".yml": "yaml", ".toml": "toml",
      ".xml": "xml", ".html": "html", ".htm": "html", ".css": "css",
      ".cmake": "cmake", ".mk": "make", ".make": "make",
      ".md": "markdown", ".txt": "text", ".rst": "restructuredtext",
      ".ld": "linker-script", ".lds": "linker-script", ".icf": "linker-script",
      ".cfg": "config", ".ini": "config", ".conf": "config", ".cnf": "config",
      ".sql": "sql",
    };
    return map[ext] ?? "unknown";
  }

  private flattenSingleRoot(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    if (entries.length === 1 && entries[0].isDirectory()) {
      const innerDir = path.join(dir, entries[0].name);
      const tmpDir = dir + "__tmp";
      fs.renameSync(innerDir, tmpDir);
      // 내부 파일을 상위로 이동
      for (const item of fs.readdirSync(tmpDir)) {
        fs.renameSync(path.join(tmpDir, item), path.join(dir, item));
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}
