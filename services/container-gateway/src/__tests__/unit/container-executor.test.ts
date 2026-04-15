import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { ContainerExecutor } from "../../services/container-executor";
import { ProjectSourceStore } from "../../services/project-source-store";
import { WorkspaceVersionStore } from "../../services/workspace-version-store";
import { ProjectContainerStore } from "../../services/project-container-store";
import { ProjectContainerManager } from "../../services/project-container-manager";
import { FakeDockerRunner } from "../../test/fake-docker-runner";

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });

describe("container executor", () => {
  it("executes a command against a specific workspace", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "s8-exec-"));
    dirs.push(dir);
    const versions = new WorkspaceVersionStore(path.join(dir, "versions.json"));
    const sources = new ProjectSourceStore(path.join(dir, "uploads"), versions);
    const ws = sources.createWorkspace("projA", [{ relativePath: "src/main.c", buffer: Buffer.from("int main(){return 0;}") }]);
    const runner = new FakeDockerRunner();
    const manager = new ProjectContainerManager(new ProjectContainerStore(path.join(dir, "containers.json")), runner, "img", "/workspace");
    const executor = new ContainerExecutor(manager, sources, runner, "/workspace");

    const res = await executor.execute("projA", { workspaceId: ws.workspaceId, command: "ls", args: ["-al"] });
    expect(res.success).toBe(true);
    expect(res.command).toBe("ls");
  });

  it("rejects cwd escaping outside the workspace", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "s8-exec-"));
    dirs.push(dir);
    const versions = new WorkspaceVersionStore(path.join(dir, "versions.json"));
    const sources = new ProjectSourceStore(path.join(dir, "uploads"), versions);
    const ws = sources.createWorkspace("projA", [{ relativePath: "src/main.c", buffer: Buffer.from("int main(){return 0;}") }]);
    const runner = new FakeDockerRunner();
    const manager = new ProjectContainerManager(new ProjectContainerStore(path.join(dir, "containers.json")), runner, "img", "/workspace");
    const executor = new ContainerExecutor(manager, sources, runner, "/workspace");

    await expect(executor.execute("projA", { workspaceId: ws.workspaceId, command: "ls", cwd: "../../.." })).rejects.toThrow("cwd must remain inside the uploaded workspace");
  });
});
