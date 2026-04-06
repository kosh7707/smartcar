import { describe, it, expect, vi, beforeEach } from "vitest";
import { SdkService } from "../sdk.service";

describe("SdkService", () => {
  const dao = {
    save: vi.fn(),
    findByProjectId: vi.fn(),
    findById: vi.fn(),
    updateStatus: vi.fn(),
    updateProfile: vi.fn(),
    delete: vi.fn(),
  };
  const sastClient = {
    registerSdk: vi.fn(),
    deleteSdk: vi.fn(),
  };
  const buildAgentClient = {
    submitTask: vi.fn(),
    isSuccess: vi.fn(),
  };
  const sdkWs = {
    broadcast: vi.fn(),
  };

  let service: SdkService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SdkService(
      dao as any,
      sastClient as any,
      buildAgentClient as any,
      "/tmp/uploads",
      sdkWs as any,
    );
  });

  it("forwards analyzed environmentSetup to SAST SDK registration", async () => {
    const sdkProfile = {
      sysroot: "/opt/sdk/sysroot",
      compilerPrefix: "arm-none-eabi-",
      gccVersion: "13.2.0",
      environmentSetup: "source /opt/sdk/environment-setup",
    };

    buildAgentClient.submitTask.mockResolvedValue({
      success: true,
      result: { sdkProfile },
    });
    buildAgentClient.isSuccess.mockReturnValue(true);
    sastClient.registerSdk.mockResolvedValue({ success: true });

    await (service as any).runPipeline("p-sdk", "sdk-123", "/opt/sdk", undefined, "req-sdk-1");

    expect(sastClient.registerSdk).toHaveBeenCalledWith(
      expect.objectContaining({
        sdkId: "sdk-123",
        path: "/opt/sdk",
        sysroot: "/opt/sdk/sysroot",
        compilerPrefix: "arm-none-eabi-",
        gccVersion: "13.2.0",
        environmentSetup: "source /opt/sdk/environment-setup",
      }),
      "req-sdk-1",
    );
    expect(dao.updateProfile).toHaveBeenCalledWith("sdk-123", sdkProfile);
    expect(dao.updateStatus).toHaveBeenCalledWith("sdk-123", "ready");
  });
});
