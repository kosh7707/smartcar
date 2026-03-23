/**
 * 프로젝트 소스코드 파일시스템 관리
 *
 * ZIP/tar.gz 추출, Git clone, 파일 목록/읽기/삭제.
 * 저장 위치: uploads/{projectId}/
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { createLogger } from "../lib/logger";
import { InvalidInputError, NotFoundError } from "../lib/errors";

const logger = createLogger("project-source");

const C_CPP_EXTENSIONS = new Set([
  ".c", ".cpp", ".cc", ".cxx",
  ".h", ".hpp", ".hh", ".hxx",
]);

export interface SourceFileEntry {
  relativePath: string;
  size: number;
  language: string;
}

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

  async extractZip(projectId: string, zipBuffer: Buffer): Promise<string> {
    const projectDir = path.join(this.uploadsDir, projectId);

    // 기존 소스 삭제 후 재추출
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
    fs.mkdirSync(projectDir, { recursive: true });

    // ZIP을 임시 파일로 저장 후 추출
    const tmpZip = path.join(projectDir, "__upload.zip");
    fs.writeFileSync(tmpZip, zipBuffer);

    try {
      execSync(`unzip -o -q "${tmpZip}" -d "${projectDir}"`, {
        timeout: 60000,
        stdio: "pipe",
      });
    } catch (err) {
      // tar.gz 시도
      try {
        execSync(`tar -xzf "${tmpZip}" -C "${projectDir}"`, {
          timeout: 60000,
          stdio: "pipe",
        });
      } catch {
        fs.rmSync(projectDir, { recursive: true, force: true });
        throw new InvalidInputError(
          "Failed to extract archive. Supported formats: ZIP, tar.gz",
          err,
        );
      }
    } finally {
      // 임시 파일 삭제
      if (fs.existsSync(tmpZip)) fs.unlinkSync(tmpZip);
    }

    // 단일 디렉토리로 감싸져 있으면 한 단계 올림
    this.flattenSingleRoot(projectDir);

    const fileCount = this.listFiles(projectId).length;
    logger.info({ projectId, projectDir, fileCount }, "Source extracted");
    return projectDir;
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
    return projectDir;
  }

  listFiles(projectId: string, extensions?: Set<string>): SourceFileEntry[] {
    const projectDir = this.getProjectPath(projectId);
    if (!projectDir) return [];

    const exts = extensions ?? C_CPP_EXTENSIONS;
    const entries: SourceFileEntry[] = [];
    this.walkDir(projectDir, projectDir, exts, entries);
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

  deleteSource(projectId: string): void {
    const projectDir = path.join(this.uploadsDir, projectId);
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
      logger.info({ projectId }, "Source deleted");
    }
  }

  private walkDir(
    baseDir: string,
    currentDir: string,
    extensions: Set<string>,
    result: SourceFileEntry[],
  ): void {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      // 숨김 파일/디렉토리, node_modules, .git 제외
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        this.walkDir(baseDir, fullPath, extensions, result);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.has(ext)) {
          const stat = fs.statSync(fullPath);
          result.push({
            relativePath: path.relative(baseDir, fullPath),
            size: stat.size,
            language: this.detectLanguage(ext),
          });
        }
      }
    }
  }

  private detectLanguage(ext: string): string {
    switch (ext) {
      case ".c": return "c";
      case ".h": return "c-or-cpp";
      case ".cpp": case ".cc": case ".cxx": return "cpp";
      case ".hpp": case ".hh": case ".hxx": return "cpp";
      default: return "unknown";
    }
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
