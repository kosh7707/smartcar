import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { TreeNode } from "@/common/utils/tree";
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
    previewLoading: false,
    previewLang: "C",
    previewContent: null,
    previewFileClass: "text",
    previewSize: 120,
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
    sourceFiles: [{ relativePath: "src/main.c", size: 120, language: "C" }],
    targetMapping: {},
    targets: [],
    findings: [],
    findingsByFile: new Map(),
    composition: {},
    previewDrawerOpen: false,
    onPreviewFile: vi.fn(),
    onClosePreview: vi.fn(),
    onOpenInDetail: vi.fn(),
    onInsightHotspotClick: vi.fn(),
    ...overrides,
  };
}

describe("FilesSourceWorkspace", () => {
  it("renders manifest insights as the default right pane", () => {
    render(<FilesSourceWorkspace {...(makeProps() as any)} />);
    expect(screen.getByText("1. 빌드 타겟 커버리지")).toBeInTheDocument();
    expect(screen.getByText("4. Top hotspot files")).toBeInTheDocument();
    expect(screen.getByText("main.c")).toBeInTheDocument();
  });

  it("renders loading preview and findings list when the drawer is open", () => {
    const onSelectFinding = vi.fn();
    const finding = { id: "finding-1", title: "Unsafe copy", location: "src/main.c:2" } as any;
    const { rerender } = render(
      <FilesSourceWorkspace
        {...(makeProps({
          selectedPath: "src/main.c",
          previewDrawerOpen: true,
          previewLoading: true,
        }) as any)}
      />,
    );
    expect(screen.getByText("로딩 중...")).toBeInTheDocument();

    rerender(
      <FilesSourceWorkspace
        {...(makeProps({
          selectedPath: "src/main.c",
          previewDrawerOpen: true,
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
