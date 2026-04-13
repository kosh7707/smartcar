import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { ProjectSourceService } from "../project-source.service";

describe("ProjectSourceService.copyToSubproject", () => {
  let tmpDir: string;
  let service: ProjectSourceService;
  const projectId = "test-project";

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-test-"));
    service = new ProjectSourceService(tmpDir);

    // getProjectPath는 uploads/{projectId} 디렉토리를 반환
    const projectDir = path.join(tmpDir, projectId);
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, "main.c"), "int main() {}");
    fs.mkdirSync(path.join(projectDir, "lib"), { recursive: true });
    fs.writeFileSync(path.join(projectDir, "lib", "util.c"), "void util() {}");
    fs.writeFileSync(path.join(projectDir, "lib", "util.h"), "#pragma once");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("copies files and directories preserving structure", () => {
    const subDir = service.copyToSubproject(projectId, "t1", ["main.c", "lib"]);

    expect(fs.existsSync(path.join(subDir, "main.c"))).toBe(true);
    expect(fs.existsSync(path.join(subDir, "lib", "util.c"))).toBe(true);
    expect(fs.existsSync(path.join(subDir, "lib", "util.h"))).toBe(true);
    expect(fs.readFileSync(path.join(subDir, "main.c"), "utf-8")).toBe("int main() {}");
  });

  it("skips directory traversal paths", () => {
    const subDir = service.copyToSubproject(projectId, "t2", ["../../../etc/passwd", "main.c"]);

    expect(fs.existsSync(path.join(subDir, "main.c"))).toBe(true);
    expect(fs.existsSync(path.join(subDir, "etc"))).toBe(false);
  });

  it("skips non-existent paths without error", () => {
    const subDir = service.copyToSubproject(projectId, "t3", ["nonexistent.c", "main.c"]);

    expect(fs.existsSync(path.join(subDir, "main.c"))).toBe(true);
    expect(fs.existsSync(path.join(subDir, "nonexistent.c"))).toBe(false);
  });

  it("overwrites existing subproject directory", () => {
    service.copyToSubproject(projectId, "t4", ["main.c"]);
    const subDir = service.copyToSubproject(projectId, "t4", ["lib"]);

    expect(fs.existsSync(path.join(subDir, "main.c"))).toBe(false);
    expect(fs.existsSync(path.join(subDir, "lib", "util.c"))).toBe(true);
  });

  it("quarantines and removes a project root", () => {
    const state = service.quarantineProjectRoot(projectId);

    expect(fs.existsSync(path.join(tmpDir, projectId))).toBe(false);
    expect(state.quarantinedPath).toBeTruthy();
    expect(fs.existsSync(state.quarantinedPath!)).toBe(true);

    service.removeQuarantinedProjectRoot(state);
    expect(fs.existsSync(state.quarantinedPath!)).toBe(false);
  });

  it("restores a quarantined project root", () => {
    const state = service.quarantineProjectRoot(projectId);

    service.restoreQuarantinedProjectRoot(state);

    expect(fs.existsSync(path.join(tmpDir, projectId))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, projectId, "main.c"))).toBe(true);
  });

  it("excludes only the managed sdk subtree from explorer listings", () => {
    fs.mkdirSync(path.join(tmpDir, projectId, "sdk", "sdk-1", "installed"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, projectId, "sdk", "sdk-1", "installed", "sdk-file.c"), "int sdk(void) { return 0; }");
    fs.mkdirSync(path.join(tmpDir, projectId, "sdk", "core"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, projectId, "sdk", "core", "real.c"), "int real_sdk(void) { return 2; }");
    fs.mkdirSync(path.join(tmpDir, projectId, "src", "sdk"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, projectId, "src", "sdk", "feature.c"), "int feature(void) { return 1; }");

    const explorerFiles = service.listFilesForExplorer(projectId, null).map((file) => file.relativePath).sort();
    const allFiles = service.listFiles(projectId, null).map((file) => file.relativePath).sort();

    expect(explorerFiles).toContain("sdk/core/real.c");
    expect(explorerFiles).toContain("src/sdk/feature.c");
    expect(explorerFiles).not.toContain("sdk/sdk-1/installed/sdk-file.c");
    expect(allFiles).toContain("sdk/sdk-1/installed/sdk-file.c");
  });

  it("computes explorer composition without counting managed sdk subtree files", () => {
    fs.mkdirSync(path.join(tmpDir, projectId, "sdk", "sdk-1", "installed"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, projectId, "sdk", "sdk-1", "installed", "sdk-file.c"), "int sdk(void) { return 0; }");
    fs.mkdirSync(path.join(tmpDir, projectId, "sdk", "core"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, projectId, "sdk", "core", "real.c"), "int real_sdk(void) { return 1; }");

    const explorerComposition = service.computeCompositionForExplorer(projectId);
    const fullComposition = service.computeComposition(projectId);

    expect(explorerComposition.totalFiles).toBe(4);
    expect(fullComposition.totalFiles).toBe(5);
  });
});
