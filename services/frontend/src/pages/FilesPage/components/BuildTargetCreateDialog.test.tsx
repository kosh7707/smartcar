import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BuildTargetCreateDialog } from "./BuildTargetCreateDialog";
import type { SourceFileEntry } from "../../../api/client";

// Mock dependencies
vi.mock("../../../hooks/useBuildTargets", () => ({
  useBuildTargets: () => ({
    targets: [],
    loading: false,
    add: vi.fn(),
    remove: vi.fn(),
    update: vi.fn(),
    discover: vi.fn(),
  }),
}));
vi.mock("../../../contexts/ToastContext", () => ({
  useToast: () => ({
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock("../../../api/client", () => ({
  logError: vi.fn(),
}));

vi.mock("../../../api/sdk", () => ({
  fetchProjectSdks: vi.fn().mockResolvedValue({ builtIn: [], registered: [] }),
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

describe("BuildTargetCreateDialog", () => {
  it("renders nothing when open=false", () => {
    const { container } = render(
      <BuildTargetCreateDialog {...defaultProps} open={false} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders name input and file tree when open", async () => {
    render(<BuildTargetCreateDialog {...defaultProps} />);

    await waitFor(() => expect(screen.getByText("src")).toBeTruthy());
    expect(screen.getAllByText("BuildTarget 생성").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByPlaceholderText("예: gateway-module")).toBeTruthy();
    expect(screen.getByText("포함할 파일/폴더 선택")).toBeTruthy();
    // File tree should show folder names
    expect(screen.getByText("src")).toBeTruthy();
    expect(screen.getByText("include")).toBeTruthy();
  });

  it("keeps cancel scoped to explicit cancel actions and the overlay", () => {
    const onCancel = vi.fn();
    render(<BuildTargetCreateDialog {...defaultProps} onCancel={onCancel} />);

    fireEvent.click(screen.getByText("BuildTarget 이름"));
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("취소"));
    expect(onCancel).toHaveBeenCalledTimes(1);

    onCancel.mockClear();
    fireEvent.click(document.querySelector(".confirm-overlay")!);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("keeps submit disabled until at least one source path is selected", async () => {
    render(<BuildTargetCreateDialog {...defaultProps} />);

    const submit = screen.getByRole("button", { name: "BuildTarget 생성" });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByText("main.c"));
    await waitFor(() => expect(submit).not.toBeDisabled());
  });

  it("shows selected file count", async () => {
    render(<BuildTargetCreateDialog {...defaultProps} />);

    await waitFor(() => expect(screen.getByText(/0개 파일/)).toBeTruthy());
    // Initially 0 selected
    expect(screen.getByText(/0개 파일/)).toBeTruthy();

    // Click on a file to select it
    fireEvent.click(screen.getByText("main.c"));
    await waitFor(() => expect(screen.getByText(/1개 파일/)).toBeTruthy());
  });

  it("preloads includedPaths in edit mode and submits updated payload", () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <BuildTargetCreateDialog
        {...defaultProps}
        title="BuildTarget 수정"
        submitLabel="저장"
        initialName="gateway"
        initialIncludedPaths={["src/"]}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByText(/2개 파일/)).toBeTruthy();

    fireEvent.click(screen.getByText("utils.h"));
    fireEvent.click(screen.getByText("저장"));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      name: "gateway",
      includedPaths: expect.arrayContaining(["src/main.c", "src/utils.c", "include/utils.h"]),
    }));
  });

  it("locks includedPaths selection when edit support is disabled", () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <BuildTargetCreateDialog
        {...defaultProps}
        title="BuildTarget 수정"
        submitLabel="저장"
        initialName="gateway"
        initialIncludedPaths={["src/"]}
        includedPathsEditable={false}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole("note").textContent).toContain("includedPaths는 수정 API에서 갱신되지 않습니다");
    expect(screen.getByText(/2개 파일/)).toBeTruthy();

    fireEvent.click(screen.getByText("utils.h"));
    expect(screen.getByText(/2개 파일/)).toBeTruthy();

    fireEvent.click(screen.getByText("저장"));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      name: "gateway",
      includedPaths: expect.arrayContaining(["src/main.c", "src/utils.c"]),
    }));
    expect(onSubmit.mock.calls[0]?.[0].includedPaths).not.toContain("include/utils.h");
  });
});
