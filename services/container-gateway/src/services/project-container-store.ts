import fs from "fs";
import path from "path";
import type { ProjectContainerRecord } from "../contracts/container-contract";

interface StoreShape { version: 1; containers: Record<string, ProjectContainerRecord>; }

export class ProjectContainerStore {
  constructor(private readonly storeFile: string) {}

  find(projectId: string): ProjectContainerRecord | undefined { return this.loadAll()[projectId]; }
  save(record: ProjectContainerRecord): void {
    const store = this.load();
    store.containers[record.projectId] = record;
    this.write(store);
  }
  remove(projectId: string): void {
    const store = this.load();
    delete store.containers[projectId];
    this.write(store);
  }
  private loadAll(): Record<string, ProjectContainerRecord> { return this.load().containers; }
  private load(): StoreShape {
    if (!fs.existsSync(this.storeFile)) return { version: 1, containers: {} };
    const raw = fs.readFileSync(this.storeFile, 'utf-8');
    if (!raw.trim()) return { version: 1, containers: {} };
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    return { version: 1, containers: parsed.containers ?? {} };
  }
  private write(store: StoreShape): void {
    fs.mkdirSync(path.dirname(this.storeFile), { recursive: true });
    const temp = `${this.storeFile}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(store, null, 2));
    fs.renameSync(temp, this.storeFile);
  }
}
