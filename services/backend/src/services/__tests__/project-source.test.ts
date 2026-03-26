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
});
