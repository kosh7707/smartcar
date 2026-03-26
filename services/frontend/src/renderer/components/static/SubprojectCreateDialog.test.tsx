import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SubprojectCreateDialog } from "./SubprojectCreateDialog";
import type { SourceFileEntry } from "../../api/client";

// Mock dependencies
vi.mock("./SubprojectCreateDialog.css", () => ({}));
vi.mock("../../hooks/useBuildTargets", () => ({
  useBuildTargets: () => ({
    targets: [],
    loading: false,
    add: vi.fn(),
    remove: vi.fn(),
    update: vi.fn(),
    discover: vi.fn(),
  }),
}));
vi.mock("../../contexts/ToastContext", () => ({
  useToast: () => ({
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  }),
}));

const mockFiles: SourceFileEntry[] = [
  { relativePath: "src/main.c", size: 1024, language: "C" },
  { relativePath: "src/utils.c", size: 512, language: "C" },
  { relativePath: "include/utils.h", size: 256, language: "C" },
];

const defaultProps = {
  open: true,
  projectId: "p-1",
  sourceFiles: mockFiles,
  onCreated: vi.fn(),
  onCancel: vi.fn(),
};

describe("SubprojectCreateDialog", () => {
  it("renders nothing when open=false", () => {
    const { container } = render(
      <SubprojectCreateDialog {...defaultProps} open={false} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders name input and file tree when open", () => {
    render(<SubprojectCreateDialog {...defaultProps} />);

    expect(screen.getAllByText("서브 프로젝트 생성").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByPlaceholderText("gateway-webserver")).toBeTruthy();
    expect(screen.getByText("포함할 파일/폴더 선택")).toBeTruthy();
    // File tree should show folder names
    expect(screen.getByText("src")).toBeTruthy();
    expect(screen.getByText("include")).toBeTruthy();
  });

  it("shows selected file count", () => {
    render(<SubprojectCreateDialog {...defaultProps} />);

    // Initially 0 selected
    expect(screen.getByText(/0개 파일/)).toBeTruthy();

    // Click on a file to select it
    fireEvent.click(screen.getByText("main.c"));
    expect(screen.getByText(/1개 파일/)).toBeTruthy();
  });
});
