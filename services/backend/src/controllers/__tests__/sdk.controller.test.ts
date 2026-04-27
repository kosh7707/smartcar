import { describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import { emitUploadFailure } from "../sdk.controller";

describe("sdk.controller", () => {
  it("emits websocket and project notification payloads for pre-registration upload failures", () => {
    const sdkWs = { broadcast: vi.fn() };
    const notificationService = { emit: vi.fn() };
    const req = {
      sdkUploadContext: {
        projectId: "project-1",
        sdkId: "sdk-1234abcd",
        uploadRoot: "/tmp/uploads/project-1/sdk",
        totalBytes: 1024,
        uploadedBytes: 512,
        lastPercent: 50,
        startedAt: 1777100000000,
      },
    } as unknown as Request;

    emitUploadFailure(req, sdkWs as any, notificationService as any, "Multipart transfer failed");

    expect(sdkWs.broadcast).toHaveBeenCalledWith("project-1", {
      type: "sdk-error",
      payload: expect.objectContaining({
        sdkId: "sdk-1234abcd",
        phase: "upload_failed",
        error: "Multipart transfer failed",
        code: "UPLOAD_INVALID_INPUT",
        retryable: false,
        recoverable: false,
        userMessage: "SDK 업로드 요청을 확인해 주세요.",
      }),
    });
    expect(notificationService.emit).toHaveBeenCalledWith({
      projectId: "project-1",
      type: "sdk_failed",
      title: "SDK 업로드 실패",
      body: "Multipart transfer failed",
      jobKind: "sdk",
      correlationId: "sdk-1234abcd",
    });
  });
});
