import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SdkUploadForm } from "./SdkUploadForm";

vi.mock("../../../api/sdk", () => ({
  registerSdkByUpload: vi.fn(),
}));
vi.mock("../../../api/core", () => ({ logError: vi.fn() }));
vi.mock("../../../contexts/ToastContext", () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

const defaultProps = {
  projectId: "proj-1",
  onRegistered: vi.fn(),
  onCancel: vi.fn(),
};

describe("SdkUploadForm", () => {
  it("renders three mode tabs (archive, binary, folder)", () => {
    render(<SdkUploadForm {...defaultProps} />);
    expect(screen.getByRole("button", { name: /아카이브/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /바이너리/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /폴더/ })).toBeTruthy();
  });

  it("mode tab switching changes active state", () => {
    render(<SdkUploadForm {...defaultProps} />);
    const binaryButton = screen.getByRole("button", { name: /바이너리/ });
    fireEvent.click(binaryButton);
    expect(binaryButton.className).toContain("active");
  });

  it("submit button is disabled when name is empty", () => {
    render(<SdkUploadForm {...defaultProps} />);
    const submitButton = screen.getByRole("button", { name: "등록" });
    expect((submitButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("cancel button calls onCancel", () => {
    const onCancel = vi.fn();
    render(<SdkUploadForm {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("renders name and description fields", () => {
    render(<SdkUploadForm {...defaultProps} />);
    expect(screen.getByText("SDK 이름")).toBeTruthy();
    expect(screen.getByText("설명 (선택)")).toBeTruthy();
  });
});
