import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FilesManifestInsights } from "./FilesManifestInsights";

const targets = [
  { id: "target-1", name: "gateway", relativePath: "src/gateway/", status: "ready" },
  { id: "target-2", name: "body-control", relativePath: "src/body/", status: "discovered" },
] as any;

const sourceFiles = [
  { relativePath: "src/gateway/main.c", size: 100, language: "c" },
  { relativePath: "src/gateway/util.c", size: 50, language: "c" },
  { relativePath: "src/body/control.c", size: 200, language: "c" },
  { relativePath: "src/orphan.py", size: 80, language: "python" },
];

const targetMapping = {
  "src/gateway/main.c": { targetId: "target-1", targetName: "gateway" },
  "src/gateway/util.c": { targetId: "target-1", targetName: "gateway" },
  "src/body/control.c": { targetId: "target-2", targetName: "body-control" },
};

describe("FilesManifestInsights", () => {
  it("renders four numbered sections in Korean", () => {
    render(
      <FilesManifestInsights
        sourceFiles={sourceFiles}
        targetMapping={targetMapping}
        targets={targets}
        findingsByFile={new Map()}
        composition={{}}
        onSelectFile={vi.fn()}
      />,
    );

    expect(screen.getByText("1. 빌드 타겟 커버리지")).toBeInTheDocument();
    expect(screen.getByText("2. 취약점 분포 by 빌드 타겟")).toBeInTheDocument();
    expect(screen.getByText("3. 언어 구성 (composition)")).toBeInTheDocument();
    expect(screen.getByText("4. Top hotspot files")).toBeInTheDocument();
  });

  it("shows the no-target nudge when there are no build targets", () => {
    render(
      <FilesManifestInsights
        sourceFiles={sourceFiles}
        targetMapping={{}}
        targets={[]}
        findingsByFile={new Map()}
        composition={{}}
        onSelectFile={vi.fn()}
      />,
    );

    expect(screen.getByText("아직 빌드 타겟이 없습니다.")).toBeInTheDocument();
  });

  it("shows the no-findings nudge in section 4 and triggers onSelectFile when a hotspot is clicked", () => {
    const findingsByFile = new Map<string, { total: number; topSeverity: any }>([
      ["src/gateway/main.c", { total: 4, topSeverity: "high" }],
      ["src/body/control.c", { total: 1, topSeverity: "medium" }],
    ]);
    const onSelectFile = vi.fn();
    render(
      <FilesManifestInsights
        sourceFiles={sourceFiles}
        targetMapping={targetMapping}
        targets={targets}
        findingsByFile={findingsByFile}
        composition={{}}
        onSelectFile={onSelectFile}
      />,
    );

    fireEvent.click(screen.getByText("src/gateway/main.c"));
    expect(onSelectFile).toHaveBeenCalledWith("src/gateway/main.c");
  });
});
