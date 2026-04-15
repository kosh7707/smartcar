import { describe, expect, it } from "vitest";
import type { ExecRequest, ExecResponse } from "../../contracts/exec-contract";

describe("exec contract", () => {
  it("references workspaceId and command payload", () => {
    const req: ExecRequest = {
      workspaceId: "projA-ws-v1",
      command: "ls",
      args: ["-al"],
      cwd: ".",
      timeoutMs: 5000,
    };
    expect(req.workspaceId).toContain("ws");
    expect(req.command).toBe("ls");
  });

  it("returns structured command execution results", () => {
    const res: ExecResponse = {
      projectId: "projA",
      uploadId: "upload-1",
      workspaceId: "projA-ws-v1",
      workspaceVersion: 1,
      containerName: "aegis-s8-project-proja",
      containerId: "cid-1",
      success: true,
      exitCode: 0,
      stdout: "main.c",
      stderr: "",
      reused: true,
      workingDirectory: "/workspace/projects/projA/projA-ws-v1",
      command: "ls",
      args: ["-al"],
      durationMs: 10,
    };
    expect(res.command).toBe("ls");
    expect(res.stdout).toContain("main.c");
  });
});
