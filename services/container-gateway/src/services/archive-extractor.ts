import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { normalizeArchiveEntryPath } from "../utils/path-boundary";

export type ArchiveFormat = "zip" | "tar";

export class ArchiveExtractor {
  detect(buffer: Buffer, originalName?: string): ArchiveFormat {
    if (buffer.length >= 4) {
      if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) return "zip";
      if (buffer[0] === 0x1f && buffer[1] === 0x8b) return "tar";
      if (buffer[0] === 0x42 && buffer[1] === 0x5a) return "tar";
      if (buffer.length > 262 && buffer.toString("ascii", 257, 262) === "ustar") return "tar";
    }
    const lower = originalName?.toLowerCase() ?? "";
    if (lower.endsWith(".zip")) return "zip";
    return "tar";
  }

  extract(buffer: Buffer, workspacePath: string, originalName?: string): void {
    fs.mkdirSync(workspacePath, { recursive: true });
    const format = this.detect(buffer, originalName);
    const tmpFile = path.join(workspacePath, format === "zip" ? "__upload.zip" : "__upload.tar");
    fs.writeFileSync(tmpFile, buffer);
    try {
      this.validateEntries(tmpFile, format);
      if (format === "zip") execFileSync("unzip", ["-o", "-q", tmpFile, "-d", workspacePath], { stdio: "pipe", timeout: 60000 });
      else execFileSync("tar", ["-xf", tmpFile, "-C", workspacePath], { stdio: "pipe", timeout: 60000 });
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
    this.flattenSingleRoot(workspacePath);
  }

  private flattenSingleRoot(workspacePath: string): void {
    const entries = fs.readdirSync(workspacePath, { withFileTypes: true }).filter((e) => !e.name.startsWith("."));
    if (entries.length !== 1 || !entries[0].isDirectory()) return;
    const inner = path.join(workspacePath, entries[0].name);
    for (const name of fs.readdirSync(inner)) {
      fs.renameSync(path.join(inner, name), path.join(workspacePath, name));
    }
    fs.rmSync(inner, { recursive: true, force: true });
  }

  private validateEntries(archivePath: string, format: ArchiveFormat): void {
    const args = format === "zip" ? ["-Z1", archivePath] : ["-tf", archivePath];
    const command = format === "zip" ? "unzip" : "tar";
    const stdout = execFileSync(command, args, { stdio: "pipe", timeout: 60000, encoding: "utf8" });
    for (const entry of stdout.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)) {
      normalizeArchiveEntryPath(entry);
    }
  }
}
