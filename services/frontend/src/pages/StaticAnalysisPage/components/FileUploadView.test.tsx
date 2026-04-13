import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FileUploadView } from "./FileUploadView";

describe("FileUploadView", () => {
  it("renders the shared plain header and selected-file summary", () => {
    const onAddFiles = vi.fn();

    render(
      <FileUploadView
        existingFiles={[]}
        selectedExisting={[]}
        onToggleExisting={vi.fn()}
        files={[]}
        onAddFiles={onAddFiles}
        onRemoveFile={vi.fn()}
        onStartAnalysis={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "소스 코드 업로드" })).toBeInTheDocument();
    expect(screen.getByText("정적 분석")).toBeInTheDocument();
    expect(screen.getByText("기존 프로젝트 파일을 선택하거나 새 소스를 추가해 분석을 시작합니다.")).toBeInTheDocument();
  });

  it("shows the combined selection summary when existing and new files are present", () => {
    render(
      <FileUploadView
        existingFiles={[]}
        selectedExisting={[{ id: "f-1", name: "main.c", size: 20, path: "src/main.c", language: "c" }]}
        onToggleExisting={vi.fn()}
        files={[{
          file: new File(["abc"], "new.c"),
          name: "new.c",
          size: 3,
          info: { id: "local-1", name: "new.c", size: 3, language: "c" },
        } as any]}
        onAddFiles={vi.fn()}
        onRemoveFile={vi.fn()}
        onStartAnalysis={vi.fn()}
      />,
    );

    expect(screen.getByText(/총 2개 파일 선택됨/)).toBeInTheDocument();
    expect(screen.getByText(/\(기존 1 \+ 새 파일 1\)/)).toBeInTheDocument();
  });
});
