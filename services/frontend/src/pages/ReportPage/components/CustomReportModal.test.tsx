import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CustomReportModal } from "./CustomReportModal";

const mockGenerateCustomReport = vi.fn();
const mockLogError = vi.fn();
const mockToast = { error: vi.fn(), success: vi.fn(), info: vi.fn() };

vi.mock("../../../api/report", () => ({
  generateCustomReport: (...args: unknown[]) => mockGenerateCustomReport(...args),
}));

vi.mock("../../../api/core", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}));

vi.mock("../../../contexts/ToastContext", () => ({
  useToast: () => mockToast,
}));

describe("CustomReportModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateCustomReport.mockResolvedValue(undefined);
  });

  it("closes when the overlay or cancel action is clicked", () => {
    const onClose = vi.fn();
    const { rerender } = render(<CustomReportModal projectId="project-1" onClose={onClose} />);

    fireEvent.click(document.querySelector(".custom-report-overlay")!);
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    rerender(<CustomReportModal projectId="project-1" onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("submits trimmed optional fields and closes after successful generation", async () => {
    const onClose = vi.fn();
    render(<CustomReportModal projectId="project-1" onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText("프로젝트명 + 보안 분석 보고서"), { target: { value: "  Security Report  " } });
    fireEvent.change(screen.getByPlaceholderText("보고서 서두에 포함할 요약문"), { target: { value: "  Executive summary  " } });
    fireEvent.change(screen.getByPlaceholderText("보고서에 표시할 회사명"), { target: { value: "  AEGIS Inc.  " } });
    fireEvent.change(screen.getByPlaceholderText("https://example.com/logo.png"), { target: { value: "  https://example.com/logo.png  " } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "en" } });

    fireEvent.click(screen.getByRole("button", { name: "보고서 생성" }));

    await waitFor(() =>
      expect(mockGenerateCustomReport).toHaveBeenCalledWith("project-1", {
        reportTitle: "Security Report",
        executiveSummary: "Executive summary",
        companyName: "AEGIS Inc.",
        logoUrl: "https://example.com/logo.png",
        language: "en",
      }),
    );
    expect(mockToast.success).toHaveBeenCalledWith("커스텀 보고서가 생성되었습니다.");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("logs and toasts when custom report generation fails", async () => {
    const error = new Error("generate failed");
    mockGenerateCustomReport.mockRejectedValue(error);
    const onClose = vi.fn();
    render(<CustomReportModal projectId="project-1" onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "보고서 생성" }));

    await waitFor(() => expect(mockLogError).toHaveBeenCalledWith("CustomReport.generate", error));
    expect(mockToast.error).toHaveBeenCalledWith("보고서 생성에 실패했습니다.");
    expect(onClose).not.toHaveBeenCalled();
  });
});
