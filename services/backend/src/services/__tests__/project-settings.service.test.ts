import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProjectSettingsService, type ISdkRegistryLookup } from "../project-settings.service";
import type { IProjectSettingsDAO } from "../../dao/interfaces";
import type { RegisteredSdk, SdkAnalyzedProfile } from "@aegis/shared";

function createMockSettingsDAO(): IProjectSettingsDAO {
  return {
    get: vi.fn().mockReturnValue(undefined),
    getAll: vi.fn().mockReturnValue({}),
    set: vi.fn(),
    deleteKey: vi.fn(),
    deleteByProjectId: vi.fn(),
  };
}

function createMockSdkRegistry(): ISdkRegistryLookup {
  return {
    findById: vi.fn().mockReturnValue(undefined),
  };
}

function makeRegisteredSdk(overrides?: Partial<RegisteredSdk>): RegisteredSdk {
  return {
    id: "sdk-abc12345",
    projectId: "p1",
    name: "Test SDK",
    path: "/uploads/p1/sdk/sdk-abc12345",
    status: "ready",
    profile: {
      compiler: "arm-none-eabi-gcc",
      targetArch: "armv7-a",
      languageStandard: "c99",
      includePaths: ["/sdk/include", "/sdk/lib/include"],
      defines: { __ARM_ARCH: "7" },
    },
    verified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("ProjectSettingsService — resolveBuildProfile", () => {
  let dao: IProjectSettingsDAO;
  let registry: ISdkRegistryLookup;
  let service: ProjectSettingsService;

  beforeEach(() => {
    dao = createMockSettingsDAO();
    registry = createMockSdkRegistry();
    service = new ProjectSettingsService(dao, registry);
  });

  it('sdkId: "none" → minimal profile (no includePaths/defines/flags)', () => {
    const result = service.resolveBuildProfile({ sdkId: "none" });

    expect(result.sdkId).toBe("none");
    expect(result.compiler).toBe("gcc");
    expect(result.targetArch).toBe("x86_64");
    expect(result.includePaths).toBeUndefined();
    expect(result.defines).toBeUndefined();
    expect(result.flags).toBeUndefined();
  });

  it('sdkId: "ti-am335x" → hardcoded profile defaults', () => {
    const result = service.resolveBuildProfile({ sdkId: "ti-am335x" });

    expect(result.sdkId).toBe("ti-am335x");
    expect(result.compiler).toBe("arm-none-eabi-gcc");
    expect(result.targetArch).toBe("armv7-a");
  });

  it("registered SDK (ready) → profile fields applied as defaults", () => {
    const sdk = makeRegisteredSdk();
    vi.mocked(registry.findById).mockReturnValue(sdk);

    const result = service.resolveBuildProfile({ sdkId: "sdk-abc12345" });

    expect(result.sdkId).toBe("sdk-abc12345");
    expect(result.compiler).toBe("arm-none-eabi-gcc");
    expect(result.targetArch).toBe("armv7-a");
    expect(result.languageStandard).toBe("c99");
    expect(result.includePaths).toEqual(["/sdk/include", "/sdk/lib/include"]);
    expect(result.defines).toEqual({ __ARM_ARCH: "7" });
    expect(registry.findById).toHaveBeenCalledWith("sdk-abc12345");
  });

  it("registered SDK (not found) → custom fallback", () => {
    vi.mocked(registry.findById).mockReturnValue(undefined);

    const result = service.resolveBuildProfile({ sdkId: "sdk-notfound" });

    expect(result.sdkId).toBe("sdk-notfound");
    expect(result.compiler).toBe("gcc");
    expect(result.targetArch).toBe("x86_64");
  });

  it("registered SDK (status != ready) → custom fallback", () => {
    const sdk = makeRegisteredSdk({ status: "analyzing" });
    vi.mocked(registry.findById).mockReturnValue(sdk);

    const result = service.resolveBuildProfile({ sdkId: "sdk-abc12345" });

    expect(result.compiler).toBe("gcc"); // default, not SDK
    expect(result.targetArch).toBe("x86_64");
  });

  it("registered SDK without profile field → custom fallback", () => {
    const sdk = makeRegisteredSdk({ status: "ready", profile: undefined });
    vi.mocked(registry.findById).mockReturnValue(sdk);

    const result = service.resolveBuildProfile({ sdkId: "sdk-abc12345" });

    expect(result.compiler).toBe("gcc");
  });

  it("user override takes precedence over SDK defaults", () => {
    const sdk = makeRegisteredSdk();
    vi.mocked(registry.findById).mockReturnValue(sdk);

    const result = service.resolveBuildProfile({
      sdkId: "sdk-abc12345",
      compiler: "clang",
      languageStandard: "c17",
    });

    expect(result.compiler).toBe("clang"); // user override
    expect(result.languageStandard).toBe("c17"); // user override
    expect(result.targetArch).toBe("armv7-a"); // SDK default
  });

  it("no sdkRegistryLookup → sdk-* falls through to custom", () => {
    const serviceNoRegistry = new ProjectSettingsService(dao);

    const result = serviceNoRegistry.resolveBuildProfile({ sdkId: "sdk-abc12345" });

    expect(result.compiler).toBe("gcc");
    expect(result.targetArch).toBe("x86_64");
  });

  it("omitted sdkId defaults to custom", () => {
    const result = service.resolveBuildProfile({});

    expect(result.sdkId).toBe("custom");
    expect(result.compiler).toBe("gcc");
  });
});
