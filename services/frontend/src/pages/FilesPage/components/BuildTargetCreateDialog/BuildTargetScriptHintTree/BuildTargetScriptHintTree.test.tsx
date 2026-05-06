import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BuildTargetScriptHintTree } from "./BuildTargetScriptHintTree";

const sourceFiles = [
  { relativePath: "gateway/scripts/build.sh", size: 200, language: "Shell" },
  { relativePath: "gateway/main.c", size: 120, language: "C" },
  { relativePath: "lib/utils.sh", size: 80, language: "Shell" },
];

describe("BuildTargetScriptHintTree", () => {
  it("renders folder + file nodes with radio affordance", () => {
    render(
      <BuildTargetScriptHintTree
        sourceFiles={sourceFiles as any}
        selectedPath={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("gateway")).toBeInTheDocument();
    expect(screen.getByText("lib")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
  });

  it("calls onSelect with file path when a file row is clicked", () => {
    const onSelect = vi.fn();
    render(
      <BuildTargetScriptHintTree
        sourceFiles={sourceFiles as any}
        selectedPath={null}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText("utils.sh"));
    expect(onSelect).toHaveBeenCalledWith("lib/utils.sh");
  });

  it("toggles selection off when the same file is clicked while selected", () => {
    const onSelect = vi.fn();
    render(
      <BuildTargetScriptHintTree
        sourceFiles={sourceFiles as any}
        selectedPath="lib/utils.sh"
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText("utils.sh"));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("clicking a folder row only toggles expansion, not selection", () => {
    const onSelect = vi.fn();
    render(
      <BuildTargetScriptHintTree
        sourceFiles={sourceFiles as any}
        selectedPath={null}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText("lib"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("marks the selected file row with aria-checked=true", () => {
    render(
      <BuildTargetScriptHintTree
        sourceFiles={sourceFiles as any}
        selectedPath="gateway/main.c"
        onSelect={vi.fn()}
      />,
    );
    const radios = screen.getAllByRole("radio");
    const checked = radios.find((r) => r.getAttribute("aria-checked") === "true");
    expect(checked).toBeDefined();
  });

  it("does not call onSelect when disabled", () => {
    const onSelect = vi.fn();
    render(
      <BuildTargetScriptHintTree
        sourceFiles={sourceFiles as any}
        selectedPath={null}
        onSelect={onSelect}
        disabled
      />,
    );
    fireEvent.click(screen.getByText("utils.sh"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("renders empty state when sourceFiles is empty", () => {
    render(
      <BuildTargetScriptHintTree
        sourceFiles={[]}
        selectedPath={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/업로드된 파일이 없습니다/)).toBeInTheDocument();
  });
});
