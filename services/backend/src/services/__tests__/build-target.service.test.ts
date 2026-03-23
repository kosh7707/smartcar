import { describe, it, expect, vi, beforeEach } from "vitest";
import { BuildTargetService } from "../build-target.service";
import type { IBuildTargetDAO } from "../../dao/interfaces";
import type { ProjectSettingsService } from "../project-settings.service";
import { makeBuildTarget } from "../../test/factories";
import { NotFoundError } from "../../lib/errors";

function createMockDAO(): IBuildTargetDAO {
  return {
    save: vi.fn(),
    findById: vi.fn(),
    findByProjectId: vi.fn().mockReturnValue([]),
    update: vi.fn(),
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

  beforeEach(() => {
    dao = createMockDAO();
    settings = createMockSettings();
    service = new BuildTargetService(dao, settings);
  });

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
  });

  describe("update", () => {
    it("should update and return target", () => {
      const existing = makeBuildTarget({ id: "t1" });
      vi.mocked(dao.update).mockReturnValue({ ...existing, name: "new-name" });
      const result = service.update("t1", { name: "new-name" });
      expect(result.name).toBe("new-name");
    });

    it("should throw NotFoundError if target missing", () => {
      vi.mocked(dao.update).mockReturnValue(undefined);
      expect(() => service.update("missing", { name: "x" })).toThrow(NotFoundError);
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
