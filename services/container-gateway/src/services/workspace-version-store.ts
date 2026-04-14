import fs from "fs";
import path from "path";

export interface WorkspaceRecord {
  projectId: string;
  uploadId: string;
  workspaceId: string;
  workspaceVersion: number;
  workspacePath: string;
  fileCount: number;
  createdAt: string;
  quarantinedPath?: string;
}
interface StoreShape { version: 1; projects: Record<string, WorkspaceRecord[]>; }

export class WorkspaceVersionStore {
  constructor(private readonly storeFile: string) {}
  add(record: WorkspaceRecord): void {
    const store = this.load();
    const list = store.projects[record.projectId] ?? [];
    list.push(record);
    store.projects[record.projectId] = list;
    this.write(store);
  }
  latest(projectId: string): WorkspaceRecord | undefined {
    const list = this.load().projects[projectId] ?? [];
    return list[list.length - 1];
  }
  find(projectId: string, workspaceId: string): WorkspaceRecord | undefined {
    return (this.load().projects[projectId] ?? []).find((r) => r.workspaceId === workspaceId);
  }
  update(record: WorkspaceRecord): void {
    const store = this.load();
    const list = store.projects[record.projectId] ?? [];
    const idx = list.findIndex((r) => r.workspaceId === record.workspaceId);
    if (idx >= 0) list[idx] = record;
    else list.push(record);
    store.projects[record.projectId] = list;
    this.write(store);
  }
  removeProject(projectId: string): void {
    const store = this.load();
    delete store.projects[projectId];
    this.write(store);
  }
  private load(): StoreShape {
    if (!fs.existsSync(this.storeFile)) return { version: 1, projects: {} };
    const raw = fs.readFileSync(this.storeFile, 'utf-8');
    if (!raw.trim()) return { version: 1, projects: {} };
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    return { version: 1, projects: parsed.projects ?? {} };
  }
  private write(store: StoreShape): void {
    fs.mkdirSync(path.dirname(this.storeFile), { recursive: true });
    const temp = `${this.storeFile}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(store, null, 2));
    fs.renameSync(temp, this.storeFile);
  }
}
