import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { UploadWorkspaceSummary } from "../contracts/upload-contract";
import { WorkspaceVersionStore, type WorkspaceRecord } from "./workspace-version-store";
import type { ArchiveExtractor } from "./archive-extractor";
import { canonicalizeProjectId } from "../utils/project-id";
import { resolvePathWithin } from "../utils/path-boundary";

export class ProjectSourceStore {
  constructor(private readonly uploadsDir: string, private readonly versions: WorkspaceVersionStore) {
    fs.mkdirSync(this.uploadsDir, { recursive: true });
  }

  createWorkspace(projectId: string, files: Array<{ relativePath: string; buffer: Buffer }>): UploadWorkspaceSummary {
    projectId = canonicalizeProjectId(projectId);
    const { record, workspacePath } = this.prepareWorkspace(projectId);
    let fileCount = 0;
    for (const file of files) {
      const resolved = resolvePathWithin(workspacePath, file.relativePath, `Invalid file path: ${file.relativePath}`);
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(resolved, file.buffer);
      fileCount += 1;
    }
    record.fileCount = fileCount;
    this.versions.update(record);
    return this.toSummary(record);
  }

  createWorkspaceFromArchive(projectId: string, archiveBuffer: Buffer, originalName: string | undefined, extractor: ArchiveExtractor): UploadWorkspaceSummary {
    projectId = canonicalizeProjectId(projectId);
    const { record, workspacePath } = this.prepareWorkspace(projectId);
    extractor.extract(archiveBuffer, workspacePath, originalName);
    record.fileCount = this.listFiles(workspacePath).length;
    this.versions.update(record);
    return this.toSummary(record);
  }

  getWorkspace(projectId: string, workspaceId?: string): WorkspaceRecord {
    projectId = canonicalizeProjectId(projectId);
    const record = workspaceId ? this.versions.find(projectId, workspaceId) : this.versions.latest(projectId);
    if (!record) throw new Error(`Workspace not found for ${projectId}`);
    return record;
  }

  quarantineWorkspace(projectId: string): WorkspaceRecord | undefined {
    projectId = canonicalizeProjectId(projectId);
    const latest = this.versions.latest(projectId);
    if (!latest || !fs.existsSync(latest.workspacePath)) return latest;
    const quarantinedPath = path.join(path.dirname(latest.workspacePath), `.quarantine-${path.basename(latest.workspacePath)}-${Date.now()}-${crypto.randomUUID().slice(0,8)}`);
    fs.renameSync(latest.workspacePath, quarantinedPath);
    latest.quarantinedPath = quarantinedPath;
    this.versions.update(latest);
    return latest;
  }

  restoreQuarantine(record: WorkspaceRecord): void {
    if (!record.quarantinedPath || !fs.existsSync(record.quarantinedPath)) return;
    if (fs.existsSync(record.workspacePath)) throw new Error(`Workspace already exists: ${record.workspacePath}`);
    fs.renameSync(record.quarantinedPath, record.workspacePath);
    record.quarantinedPath = undefined;
    this.versions.update(record);
  }

  finalizeDelete(record: WorkspaceRecord): void {
    if (record.quarantinedPath && fs.existsSync(record.quarantinedPath)) fs.rmSync(record.quarantinedPath, { recursive: true, force: true });
    this.versions.removeProject(record.projectId);
  }

  private prepareWorkspace(projectId: string): { record: WorkspaceRecord; workspacePath: string } {
    projectId = canonicalizeProjectId(projectId);
    const uploadId = `upload-${crypto.randomUUID().slice(0,8)}`;
    const prev = this.versions.latest(projectId);
    const workspaceVersion = (prev?.workspaceVersion ?? 0) + 1;
    const workspaceId = `${projectId}-ws-v${workspaceVersion}`;
    const workspacePath = path.join(this.uploadsDir, projectId, workspaceId);
    fs.rmSync(workspacePath, { recursive: true, force: true });
    fs.mkdirSync(workspacePath, { recursive: true });
    const record: WorkspaceRecord = { projectId, uploadId, workspaceId, workspaceVersion, workspacePath, fileCount: 0, createdAt: new Date().toISOString() };
    this.versions.add(record);
    return { record, workspacePath };
  }

  private toSummary(record: WorkspaceRecord): UploadWorkspaceSummary {
    return { projectId: record.projectId, uploadId: record.uploadId, workspaceId: record.workspaceId, workspaceVersion: record.workspaceVersion, workspacePath: record.workspacePath, fileCount: record.fileCount, files: this.listFiles(record.workspacePath) };
  }

  private listFiles(root: string): Array<{ relativePath: string; size: number }> {
    const results: Array<{ relativePath: string; size: number }> = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile()) results.push({ relativePath: path.relative(root, full).split(path.sep).join('/'), size: fs.statSync(full).size });
      }
    };
    walk(root);
    return results.sort((a,b)=>a.relativePath.localeCompare(b.relativePath));
  }
}
