import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { FileTreeNode } from "./FileTreeNode";
import { buildTree } from "../../utils/tree";
import type { TreeNode } from "../../utils/tree";

interface TestFile { path: string; lang: string }

const files: TestFile[] = [
  { path: "src/main.c", lang: "c" },
  { path: "src/util.c", lang: "c" },
  { path: "include/header.h", lang: "h" },
];

const tree = buildTree(files, (f) => f.path);

describe("FileTreeNode", () => {
  it("renders folder with name and file count", () => {
    const srcNode = tree.children.find((c) => c.name === "src")!;
    render(
      <FileTreeNode<TestFile>
        node={srcNode}
        depth={0}
        searchOpen={false}
        onClickFile={vi.fn()}
      />,
    );
    expect(screen.getByText("src")).toBeInTheDocument();
    expect(screen.getByText("2개")).toBeInTheDocument();
  });

  it("renders file with name", () => {
    const fileNode: TreeNode<TestFile> = {
      name: "test.c",
      path: "test.c",
      children: [],
      data: { path: "test.c", lang: "c" },
    };
    render(
      <FileTreeNode<TestFile>
        node={fileNode}
        depth={0}
        searchOpen={false}
        onClickFile={vi.fn()}
      />,
    );
    expect(screen.getByText("test.c")).toBeInTheDocument();
  });

  it("expands folder on click", () => {
    const srcNode = tree.children.find((c) => c.name === "src")!;
    render(
      <FileTreeNode<TestFile>
        node={srcNode}
        depth={0}
        searchOpen={false}
        defaultOpen={false}
        onClickFile={vi.fn()}
      />,
    );

    // Children not visible initially (defaultOpen=false, depth=0 but we override)
    expect(screen.queryByText("main.c")).not.toBeInTheDocument();

    // Click folder to expand
    fireEvent.click(screen.getByText("src"));
    expect(screen.getByText("main.c")).toBeInTheDocument();
    expect(screen.getByText("util.c")).toBeInTheDocument();
  });

  it("forces open when searchOpen=true", () => {
    const srcNode = tree.children.find((c) => c.name === "src")!;
    render(
      <FileTreeNode<TestFile>
        node={srcNode}
        depth={0}
        searchOpen={true}
        defaultOpen={false}
        onClickFile={vi.fn()}
      />,
    );
    // Even with defaultOpen=false, searchOpen forces children visible
    expect(screen.getByText("main.c")).toBeInTheDocument();
  });

  it("calls onClickFile when file clicked", () => {
    const onClickFile = vi.fn();
    const fileNode: TreeNode<TestFile> = {
      name: "test.c",
      path: "test.c",
      children: [],
      data: { path: "test.c", lang: "c" },
    };
    render(
      <FileTreeNode<TestFile>
        node={fileNode}
        depth={0}
        searchOpen={false}
        onClickFile={onClickFile}
      />,
    );

    fireEvent.click(screen.getByText("test.c"));
    expect(onClickFile).toHaveBeenCalledWith(
      { path: "test.c", lang: "c" },
      fileNode,
    );
  });

  it("highlights selected file", () => {
    const fileNode: TreeNode<TestFile> = {
      name: "test.c",
      path: "test.c",
      children: [],
      data: { path: "test.c", lang: "c" },
    };
    const { container } = render(
      <FileTreeNode<TestFile>
        node={fileNode}
        depth={0}
        searchOpen={false}
        onClickFile={vi.fn()}
        selectedPath="test.c"
      />,
    );
    expect(container.querySelector(".ftree-row--selected")).toBeInTheDocument();
  });

  it("renders custom file meta", () => {
    const fileNode: TreeNode<TestFile> = {
      name: "test.c",
      path: "test.c",
      children: [],
      data: { path: "test.c", lang: "c" },
    };
    render(
      <FileTreeNode<TestFile>
        node={fileNode}
        depth={0}
        searchOpen={false}
        onClickFile={vi.fn()}
        renderFileMeta={(data) => <span data-testid="meta">{data.lang}</span>}
      />,
    );
    expect(screen.getByTestId("meta")).toHaveTextContent("c");
  });

  it("renders folder badge", () => {
    const srcNode = tree.children.find((c) => c.name === "src")!;
    render(
      <FileTreeNode<TestFile>
        node={srcNode}
        depth={0}
        searchOpen={false}
        defaultOpen={false}
        onClickFile={vi.fn()}
        renderFolderBadge={() => <span data-testid="badge">3</span>}
      />,
    );
    expect(screen.getByTestId("badge")).toHaveTextContent("3");
  });

  it("supports keyboard navigation on folders", () => {
    const srcNode = tree.children.find((c) => c.name === "src")!;
    render(
      <FileTreeNode<TestFile>
        node={srcNode}
        depth={0}
        searchOpen={false}
        defaultOpen={false}
        onClickFile={vi.fn()}
      />,
    );

    const folderRow = screen.getByText("src").closest(".ftree-row")!;
    expect(folderRow).toHaveAttribute("role", "button");
    expect(folderRow).toHaveAttribute("aria-expanded", "false");

    fireEvent.keyDown(folderRow, { key: "Enter" });
    expect(screen.getByText("main.c")).toBeInTheDocument();
  });
});
