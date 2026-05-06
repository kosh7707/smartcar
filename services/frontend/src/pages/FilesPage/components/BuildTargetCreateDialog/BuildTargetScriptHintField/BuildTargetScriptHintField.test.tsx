import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BuildTargetScriptHintField, deriveRootRelative } from "./BuildTargetScriptHintField";

const sourceFiles = [
  { relativePath: "gateway/scripts/build.sh", size: 200, language: "Shell" },
  { relativePath: "gateway/main.c", size: 120, language: "C" },
  { relativePath: "lib/utils.sh", size: 80, language: "Shell" },
];

describe("deriveRootRelative", () => {
  it("returns null when path is null", () => {
    expect(deriveRootRelative(null, "gateway/")).toBeNull();
  });
  it("returns the path unchanged when root is empty", () => {
    expect(deriveRootRelative("scripts/build.sh", "")).toBe("scripts/build.sh");
  });
  it("strips matching root prefix", () => {
    expect(deriveRootRelative("gateway/scripts/build.sh", "gateway/")).toBe("scripts/build.sh");
  });
  it("appends trailing slash to root if missing", () => {
    expect(deriveRootRelative("gateway/scripts/build.sh", "gateway")).toBe("scripts/build.sh");
  });
  it("returns null when path does not start with root (mismatch)", () => {
    expect(deriveRootRelative("lib/utils.sh", "gateway/")).toBeNull();
  });
});

describe("BuildTargetScriptHintField", () => {
  it("renders placeholder when nothing is selected", () => {
    render(
      <BuildTargetScriptHintField
        sourceFiles={sourceFiles as any}
        selectedPath={null}
        onSelect={vi.fn()}
        buildTargetRoot="gateway/"
      />,
    );
    expect(screen.getByText("선택된 파일 없음")).toBeInTheDocument();
    expect(screen.queryByTestId("script-hint-selected")).not.toBeInTheDocument();
  });

  it("renders selected uploaded path + computed root-relative path", () => {
    render(
      <BuildTargetScriptHintField
        sourceFiles={sourceFiles as any}
        selectedPath="gateway/scripts/build.sh"
        onSelect={vi.fn()}
        buildTargetRoot="gateway/"
      />,
    );
    const card = screen.getByTestId("script-hint-selected");
    expect(card).toHaveTextContent("gateway/scripts/build.sh");
    expect(card).toHaveTextContent("scripts/build.sh");
  });

  it("shows root-mismatch warning when selection is outside the BuildTarget root", () => {
    render(
      <BuildTargetScriptHintField
        sourceFiles={sourceFiles as any}
        selectedPath="lib/utils.sh"
        onSelect={vi.fn()}
        buildTargetRoot="gateway/"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/BuildTarget 루트.*밖에 있어/);
  });

  it("clear button calls onSelect(null)", () => {
    const onSelect = vi.fn();
    render(
      <BuildTargetScriptHintField
        sourceFiles={sourceFiles as any}
        selectedPath="gateway/main.c"
        onSelect={onSelect}
        buildTargetRoot="gateway/"
      />,
    );
    fireEvent.click(screen.getByLabelText("선택 해제"));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("forwards file selection from inner tree to onSelect", () => {
    const onSelect = vi.fn();
    render(
      <BuildTargetScriptHintField
        sourceFiles={sourceFiles as any}
        selectedPath={null}
        onSelect={onSelect}
        buildTargetRoot="gateway/"
      />,
    );
    fireEvent.click(screen.getByText("utils.sh"));
    expect(onSelect).toHaveBeenCalledWith("lib/utils.sh");
  });
});
