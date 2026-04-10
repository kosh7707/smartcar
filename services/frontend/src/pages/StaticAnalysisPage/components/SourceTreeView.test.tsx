import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SourceTreeView } from "./SourceTreeView";
import type { SourceFileEntry, SourceFileContentResponse } from "../../../api/client";
import type { Finding } from "@aegis/shared";

// Mock CSS
vi.mock("./SourceTreeView.css", () => ({}));

vi.mock("../../../api/client", () => ({
  fetchSourceFileContent: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../../../contexts/ToastContext", () => ({
  useToast: () => ({
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  }),
}));

// Mock highlight.ts since it requires highlight.js
vi.mock("../../../utils/highlight", () => ({
  highlightLines: (code: string) => code.split("\n").map((l) => l),
  highlightCode: (code: string) => code,
}));

import { fetchSourceFileContent } from "../../../api/client";

const mockFiles: SourceFileEntry[] = [
  { relativePath: "src/main.c", size: 1024, language: "C" },
  { relativePath: "src/utils.c", size: 512, language: "C" },
  { relativePath: "include/utils.h", size: 256, language: "C" },
];

const mockFindings: Finding[] = [
  {
    id: "f-1",
    title: "Buffer overflow",
    severity: "high",
    location: "src/main.c:10",
    status: "open",
  } as unknown as Finding,
];

describe("SourceTreeView", () => {
  it("renders file count and total size header", () => {
    render(
      <SourceTreeView
        projectId="p-1"
        sourceFiles={mockFiles}
        findings={mockFindings}
      />,
    );

    expect(screen.getByText(/3개 파일/)).toBeTruthy();
  });

  it("renders tree with folder names", () => {
    render(
      <SourceTreeView
        projectId="p-1"
        sourceFiles={mockFiles}
        findings={mockFindings}
      />,
    );

    expect(screen.getByText("src")).toBeTruthy();
    expect(screen.getByText("include")).toBeTruthy();
  });

  it("search filters tree nodes", () => {
    render(
      <SourceTreeView
        projectId="p-1"
        sourceFiles={mockFiles}
        findings={mockFindings}
      />,
    );

    const searchInput = screen.getByPlaceholderText(/검색/);
    fireEvent.change(searchInput, { target: { value: "utils" } });

    // Both utils.c and utils.h should be visible
    expect(screen.getByText("utils.c")).toBeTruthy();
    expect(screen.getByText("utils.h")).toBeTruthy();
  });

  it("clicking a file loads content via API", async () => {
    vi.mocked(fetchSourceFileContent).mockResolvedValue({
      path: "src/main.c",
      content: "int main() {}",
      language: "C",
      size: 1024,
      lineCount: 1,
    } as SourceFileContentResponse);

    render(
      <SourceTreeView
        projectId="p-1"
        sourceFiles={mockFiles}
        findings={mockFindings}
      />,
    );

    fireEvent.click(screen.getByText("main.c"));

    await waitFor(() =>
      expect(fetchSourceFileContent).toHaveBeenCalledWith("p-1", "src/main.c"),
    );
  });
});
