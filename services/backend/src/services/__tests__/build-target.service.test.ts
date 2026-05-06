import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { BuildTargetService } from "../build-target.service";
import type { IBuildTargetDAO } from "../../dao/interfaces";
import { makeBuildTarget } from "../../test/factories";
import { InvalidInputError, NotFoundError } from "../../lib/errors";

function createMockDAO(): IBuildTargetDAO {
  return {
    save: vi.fn(),
    findById: vi.fn(),
    findByProjectId: vi.fn().mockReturnValue([]),
    update: vi.fn(),
    updatePipelineState: vi.fn(),
    delete: vi.fn().mockReturnValue(true),
    deleteByProjectId: vi.fn().mockReturnValue(0),
  };
}

function createMockSettings(): any {
  return {
    get: vi.fn().mockReturnValue({ sdkId: "custom", compiler: "gcc", targetArch: "x86_64", languageStandard: "c11", headerLanguage: "auto" }),
    resolveBuildProfile: vi.fn((p: any) => ({
      sdkId: p?.sdkId ?? "custom",
      compiler: p?.compiler ?? "gcc",
      targetArch: p?.targetArch ?? "x86_64",
      languageStandard: p?.languageStandard ?? "c11",
      headerLanguage: p?.headerLanguage ?? "auto",
    })),
  };
}

describe("BuildTargetService", () => {
  let service: BuildTargetService;
  let dao: IBuildTargetDAO;
  let settings: any;
  let tempDirs: string[];

  beforeEach(() => {
    dao = createMockDAO();
    settings = createMockSettings();
    service = new BuildTargetService(dao, settings);
    tempDirs = [];
  });

  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function createTempProjectRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-script-hint-"));
    tempDirs.push(root);
    return root;
  }

  function serviceWithProjectRoot(projectRoot: string, projectId = "proj-1"): BuildTargetService {
    return new BuildTargetService(dao, settings, {
      getProjectPath: vi.fn((requestedProjectId: string) => requestedProjectId === projectId ? projectRoot : undefined),
      copyToBuildTargetSource: vi.fn((_requestedProjectId: string, targetId: string) => path.join(projectRoot, targetId)),
    } as any);
  }

  describe("create", () => {
    it("should create a build target with generated ID", () => {
      const target = service.create("proj-1", "gateway", "gateway/");
      expect(target.id).toMatch(/^target-/);
      expect(target.projectId).toBe("proj-1");
      expect(target.name).toBe("gateway");
      expect(target.relativePath).toBe("gateway/");
      expect(dao.save).toHaveBeenCalledWith(target);
    });

    it("should append trailing slash to relativePath", () => {
      const target = service.create("proj-1", "test", "src/test");
      expect(target.relativePath).toBe("src/test/");
    });

    it("should resolve buildProfile from settings when not provided", () => {
      service.create("proj-1", "test", "test/");
      expect(settings.resolveBuildProfile).toHaveBeenCalled();
    });

    it("should use provided buildProfile", () => {
      const bp = { sdkId: "ti-am335x" as const, compiler: "arm-gcc", targetArch: "arm", languageStandard: "c99", headerLanguage: "c" as const };
      const target = service.create("proj-1", "test", "test/", bp);
      expect(settings.resolveBuildProfile).toHaveBeenCalledWith(bp);
    });

    it("validates and normalizes a BuildTarget-root-relative scriptHintPath", () => {
      const projectRoot = createTempProjectRoot();
      service = serviceWithProjectRoot(projectRoot);
      fs.mkdirSync(path.join(projectRoot, "src", "scripts"), { recursive: true });
      fs.writeFileSync(path.join(projectRoot, "src", "scripts", "build.sh"), "#!/bin/sh\nmake\n");

      const target = service.create("proj-1", "test", "src/", undefined, undefined, undefined, "scripts/./build.sh");

      expect(target.scriptHintPath).toBe("scripts/build.sh");
      expect(dao.save).toHaveBeenCalledWith(expect.objectContaining({
        scriptHintPath: "scripts/build.sh",
      }));
    });

    it.each([
      ["/tmp/build.sh", "absolute path"],
      ["C:/build.sh", "Windows drive path"],
      ["//server/share/build.sh", "UNC path"],
      ["scripts\\build.sh", "backslash path"],
      ["bad\0path", "NUL in path"],
      ["../build.sh", "parent traversal"],
    ])("rejects unsafe scriptHintPath syntax: %s (%s)", (scriptHintPath) => {
      const projectRoot = createTempProjectRoot();
      service = serviceWithProjectRoot(projectRoot);
      fs.mkdirSync(path.join(projectRoot, "src"), { recursive: true });

      expect(() => service.create("proj-1", "test", "src/", undefined, undefined, undefined, scriptHintPath))
        .toThrow(InvalidInputError);
      expect(dao.save).not.toHaveBeenCalled();
    });

    it("rejects scriptHintPath when the selected path is a directory", () => {
      const projectRoot = createTempProjectRoot();
      service = serviceWithProjectRoot(projectRoot);
      fs.mkdirSync(path.join(projectRoot, "src", "scripts"), { recursive: true });

      expect(() => service.create("proj-1", "test", "src/", undefined, undefined, undefined, "scripts"))
        .toThrow(InvalidInputError);
    });

    it("rejects scriptHintPath symlinks that escape the BuildTarget root", () => {
      const projectRoot = createTempProjectRoot();
      const externalRoot = createTempProjectRoot();
      service = serviceWithProjectRoot(projectRoot);
      fs.mkdirSync(path.join(projectRoot, "src"), { recursive: true });
      fs.writeFileSync(path.join(externalRoot, "build.sh"), "#!/bin/sh\nmake\n");
      fs.symlinkSync(path.join(externalRoot, "build.sh"), path.join(projectRoot, "src", "build.sh"));

      expect(() => service.create("proj-1", "test", "src/", undefined, undefined, undefined, "build.sh"))
        .toThrow(InvalidInputError);
    });

    it("rejects oversized, NUL-containing, and invalid UTF-8 script hint files", () => {
      const cases: Array<[string, Buffer]> = [
        ["big.sh", Buffer.alloc(20_001, "a")],
        ["nul.sh", Buffer.from("#!/bin/sh\nmake\0\n")],
        ["invalid-utf8.sh", Buffer.from([0xff, 0xfe])],
      ];

      for (const [filename, content] of cases) {
        const projectRoot = createTempProjectRoot();
        service = serviceWithProjectRoot(projectRoot);
        fs.mkdirSync(path.join(projectRoot, "src"), { recursive: true });
        fs.writeFileSync(path.join(projectRoot, "src", filename), content);

        expect(() => service.create("proj-1", "test", "src/", undefined, undefined, undefined, filename))
          .toThrow(InvalidInputError);
      }
    });
  });

  describe("update", () => {
    it("should update and return target", () => {
      const existing = makeBuildTarget({ id: "t1" });
      vi.mocked(dao.findById).mockReturnValue(existing);
      vi.mocked(dao.update).mockReturnValue({ ...existing, name: "new-name" });
      const result = service.update("t1", { name: "new-name" });
      expect(result.name).toBe("new-name");
    });

    it("should throw NotFoundError if target missing", () => {
      vi.mocked(dao.update).mockReturnValue(undefined);
      expect(() => service.update("missing", { name: "x" })).toThrow(NotFoundError);
    });

    it("revalidates an existing scriptHintPath when relativePath changes", () => {
      const projectRoot = createTempProjectRoot();
      service = serviceWithProjectRoot(projectRoot);
      fs.mkdirSync(path.join(projectRoot, "old"), { recursive: true });
      fs.mkdirSync(path.join(projectRoot, "new"), { recursive: true });
      fs.writeFileSync(path.join(projectRoot, "old", "build.sh"), "#!/bin/sh\nmake old\n");
      fs.writeFileSync(path.join(projectRoot, "new", "build.sh"), "#!/bin/sh\nmake new\n");
      const existing = makeBuildTarget({
        id: "t-script",
        projectId: "proj-1",
        relativePath: "old/",
        scriptHintPath: "build.sh",
      });
      vi.mocked(dao.findById).mockReturnValue(existing);
      vi.mocked(dao.update).mockReturnValue({ ...existing, relativePath: "new/" });

      expect(() => service.update("t-script", { relativePath: "new/" })).not.toThrow();
      expect(dao.update).toHaveBeenCalledWith("t-script", expect.objectContaining({
        relativePath: "new/",
      }));
    });

    it("rejects relativePath-only updates that would leave a stale scriptHintPath", () => {
      const projectRoot = createTempProjectRoot();
      service = serviceWithProjectRoot(projectRoot);
      fs.mkdirSync(path.join(projectRoot, "old"), { recursive: true });
      fs.mkdirSync(path.join(projectRoot, "new"), { recursive: true });
      fs.writeFileSync(path.join(projectRoot, "old", "build.sh"), "#!/bin/sh\nmake old\n");
      const existing = makeBuildTarget({
        id: "t-script",
        projectId: "proj-1",
        relativePath: "old/",
        scriptHintPath: "build.sh",
      });
      vi.mocked(dao.findById).mockReturnValue(existing);

      expect(() => service.update("t-script", { relativePath: "new/" })).toThrow(InvalidInputError);
      expect(dao.update).not.toHaveBeenCalled();
    });
  });

  describe("bulkCreateFromDiscovery", () => {
    it("should create targets for new paths", () => {
      vi.mocked(dao.findByProjectId).mockReturnValue([]);
      const discovered = [
        { name: "gw", relativePath: "gw/", buildSystem: "cmake" },
        { name: "ctrl", relativePath: "ctrl/", buildSystem: "make" },
      ];
      const created = service.bulkCreateFromDiscovery("proj-1", discovered);
      expect(created).toHaveLength(2);
      expect(dao.save).toHaveBeenCalledTimes(2);
    });

    it("should skip existing paths", () => {
      vi.mocked(dao.findByProjectId).mockReturnValue([
        makeBuildTarget({ projectId: "proj-1", relativePath: "gw/" }),
      ]);
      const discovered = [
        { name: "gw", relativePath: "gw/", buildSystem: "cmake" },
        { name: "ctrl", relativePath: "ctrl/", buildSystem: "make" },
      ];
      const created = service.bulkCreateFromDiscovery("proj-1", discovered);
      expect(created).toHaveLength(1);
      expect(created[0].name).toBe("ctrl");
    });
  });

  describe("delete", () => {
    it("should delete by id", () => {
      expect(service.delete("t1")).toBe(true);
      expect(dao.delete).toHaveBeenCalledWith("t1");
    });

    it("should deleteByProjectId", () => {
      vi.mocked(dao.deleteByProjectId).mockReturnValue(3);
      expect(service.deleteByProjectId("proj-1")).toBe(3);
    });
  });
});
