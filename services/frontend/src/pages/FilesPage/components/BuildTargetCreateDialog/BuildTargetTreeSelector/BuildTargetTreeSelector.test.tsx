import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BuildTargetTreeSelector } from "./BuildTargetTreeSelector";

const sourceFiles = [
  { relativePath: "src/main.c", size: 120, language: "C" },
  { relativePath: "src/utils.c", size: 80, language: "C" },
  { relativePath: "include/utils.h", size: 40, language: "C" },
];

describe("BuildTargetTreeSelector", () => {
  it("renders folder and file nodes", () => {
    render(
      <BuildTargetTreeSelector
        sourceFiles={sourceFiles as any}
        checked={new Set()}
        onToggle={vi.fn()}
      />,
    );

    expect(screen.getByText("src")).toBeInTheDocument();
    expect(screen.getByText("include")).toBeInTheDocument();
    expect(screen.getByText("main.c")).toBeInTheDocument();
  });

  it("toggles an individual file when clicked", () => {
    const onToggle = vi.fn();
    render(
      <BuildTargetTreeSelector
        sourceFiles={sourceFiles as any}
        checked={new Set()}
        onToggle={onToggle}
      />,
    );

    fireEvent.click(screen.getByText("main.c"));
    expect(onToggle).toHaveBeenCalledWith(["src/main.c"], true);
  });

  it("toggles a folder checkbox for all descendant paths", () => {
    const onToggle = vi.fn();
    render(
      <BuildTargetTreeSelector
        sourceFiles={sourceFiles as any}
        checked={new Set()}
        onToggle={onToggle}
      />,
    );

    const srcRow = screen.getByText("src").closest("div") as HTMLElement;
    const srcCheckbox = srcRow.querySelector('[role="checkbox"]') as HTMLElement;
    fireEvent.click(srcCheckbox);
    expect(onToggle).toHaveBeenCalledWith(
      expect.arrayContaining(["src/main.c", "src/utils.c"]),
      true,
    );
  });

  it("does not toggle when disabled", () => {
    const onToggle = vi.fn();
    render(
      <BuildTargetTreeSelector
        sourceFiles={sourceFiles as any}
        checked={new Set()}
        onToggle={onToggle}
        disabled
      />,
    );

    fireEvent.click(screen.getByText("main.c"));
    expect(onToggle).not.toHaveBeenCalled();
  });
});
