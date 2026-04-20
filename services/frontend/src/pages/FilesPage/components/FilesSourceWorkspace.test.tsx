import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { TreeNode } from "../../../utils/tree";
import { FilesSourceWorkspace } from "./FilesSourceWorkspace";

const fileNode: TreeNode<any> = {
  name: "main.c",
  path: "src/main.c",
  children: [],
  data: { relativePath: "src/main.c", size: 120, language: "C" },
};
const folderNode: TreeNode<any> = {
  name: "src",
  path: "src",
  children: [fileNode],
};
const tree: TreeNode<any> = { name: "", path: "", children: [folderNode] };

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    search: "",
    onSearchChange: vi.fn(),
    onExpandAll: vi.fn(),
    onCollapseAll: vi.fn(),
    displayTree: tree,
    selectedPath: null,
    handleFileClick: vi.fn(),
    renderFileIcon: () => <span data-testid="icon">i</span>,
    renderFileMeta: () => <span data-testid="meta">m</span>,
    renderFolderBadge: () => <span data-testid="badge">1</span>,
    previewLoading: false,
    previewLang: "C",
    previewContent: null,
    highlightLines: new Set<number>(),
    selectedFileFindings: [],
    onSelectFinding: vi.fn(),
    openPaths: new Set<string>(["src"]),
    onToggleFolder: vi.fn(),
    layoutRef: { current: null },
    treePanelWidth: 320,
    isResizing: false,
    onStartResize: vi.fn(),
    onNudgeResize: vi.fn(),
    ...overrides,
  };
}

describe("FilesSourceWorkspace", () => {
  it("renders tree state and empty preview copy", () => {
    render(<FilesSourceWorkspace {...(makeProps() as any)} />);
    expect(screen.getByText("파일을 선택하면 내용을 미리 볼 수 있습니다")).toBeInTheDocument();
    expect(screen.getByText("main.c")).toBeInTheDocument();
  });

  it("renders loading preview and findings list when a file is selected", () => {
    const onSelectFinding = vi.fn();
    const finding = { id: "finding-1", title: "Unsafe copy", location: "src/main.c:2" } as any;
    const { rerender } = render(
      <FilesSourceWorkspace {...(makeProps({ selectedPath: "src/main.c", previewLoading: true }) as any)} />,
    );
    expect(screen.getByText("로딩 중...")).toBeInTheDocument();

    rerender(
      <FilesSourceWorkspace
        {...(makeProps({
          selectedPath: "src/main.c",
          previewLoading: false,
          previewContent: "int main() {}",
          selectedFileFindings: [finding],
          onSelectFinding,
        }) as any)}
      />,
    );

    fireEvent.click(screen.getByText("Unsafe copy"));
    expect(onSelectFinding).toHaveBeenCalledWith("finding-1");
  });
});
