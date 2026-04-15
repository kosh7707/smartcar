import path from "path";
import type { Express } from "express";
import type { UploadWorkspaceSummary } from "../contracts/upload-contract";
import { ArchiveExtractor } from "./archive-extractor";
import { ProjectSourceStore } from "./project-source-store";

export class WorkspaceMaterializer {
  constructor(private readonly store: ProjectSourceStore, private readonly archiveExtractor = new ArchiveExtractor()) {}

  materialize(projectId: string, files: Express.Multer.File[]): UploadWorkspaceSummary {
    if (files.length === 0) throw new Error("No file uploaded");
    if (files.length === 1 && this.looksLikeArchive(files[0])) {
      return this.store.createWorkspaceFromArchive(projectId, files[0].buffer, this.decodeName(files[0].originalname), this.archiveExtractor);
    }
    return this.store.createWorkspace(projectId, files.map((f) => ({ relativePath: this.decodeName(f.originalname), buffer: f.buffer })));
  }

  private looksLikeArchive(file: Express.Multer.File): boolean {
    const lower = (file.originalname ?? "").toLowerCase();
    return /\.(zip|tar|tar\.gz|tgz|tar\.bz2)$/i.test(lower);
  }

  private decodeName(name: string): string {
    return Buffer.from(name, "latin1").toString("utf-8").split(path.sep).join("/");
  }
}
