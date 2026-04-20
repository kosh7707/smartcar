import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { UploadedFile } from "@aegis/shared";
import { FileDetailHeader } from "./FileDetailHeader";

const file: UploadedFile = {
  id: "file-1",
  projectId: "project-1",
  name: "main.c",
  path: "src/main.c",
  size: 128,
  language: "c",
  createdAt: "2026-04-10T00:00:00Z",
};

describe("FileDetailHeader", () => {
  it("renders metadata badges and file identity", () => {
    render(
      <FileDetailHeader
        file={file}
        lineCount={42}
        vulnerabilityCount={3}
        onDownload={vi.fn()}
      />,
    );

    expect(screen.getByText("main.c")).toBeInTheDocument();
    expect(screen.getByText("src/main.c")).toBeInTheDocument();
    expect(screen.getByText("c")).toBeInTheDocument();
    expect(screen.getByText("128 B")).toBeInTheDocument();
    expect(screen.getByText("42줄")).toBeInTheDocument();
    expect(screen.getByText("취약점 3건")).toBeInTheDocument();
  });

  it("calls onDownload when the download button is clicked", () => {
    const onDownload = vi.fn();
    render(
      <FileDetailHeader
        file={file}
        lineCount={42}
        vulnerabilityCount={0}
        onDownload={onDownload}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /다운로드/i }));
    expect(onDownload).toHaveBeenCalledTimes(1);
  });
});
