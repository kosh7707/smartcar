import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { FilesPage } from "./FilesPage";

const mockNavigate = vi.fn();
const mockFetchSourceFilesWithComposition = vi.fn();
const mockFetchSourceFileContent = vi.fn();
const mockFetchProjectFindings = vi.fn();
const mockUploadSource = vi.fn();
const mockLogError = vi.fn();
const mockUseBuildTargets = vi.fn();
const mockUseUploadProgress = vi.fn();
const mockToast = { error: vi.fn(), success: vi.fn(), info: vi.fn() };

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../api/client", () => ({
  fetchSourceFilesWithComposition: (...args: unknown[]) => mockFetchSourceFilesWithComposition(...args),
  fetchSourceFileContent: (...args: unknown[]) => mockFetchSourceFileContent(...args),
  fetchProjectFindings: (...args: unknown[]) => mockFetchProjectFindings(...args),
  uploadSource: (...args: unknown[]) => mockUploadSource(...args),
  logError: (...args: unknown[]) => mockLogError(...args),
}));

vi.mock("../../hooks/useBuildTargets", () => ({
  useBuildTargets: (...args: unknown[]) => mockUseBuildTargets(...args),
}));

vi.mock("../../hooks/useUploadProgress", () => ({
  useUploadProgress: (...args: unknown[]) => mockUseUploadProgress(...args),
}));

vi.mock("../../contexts/ToastContext", () => ({
  useToast: () => mockToast,
}));

vi.mock("../../components/static/SubprojectCreateDialog", () => ({
  SubprojectCreateDialog: () => null,
}));

vi.mock("../../components/static/BuildLogViewer", () => ({
  BuildLogViewer: () => null,
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/projects/p-1/files"]}>
      <Routes>
        <Route path="/projects/:projectId/files" element={<FilesPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("FilesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchSourceFilesWithComposition.mockResolvedValue({ success: true, data: [], targetMapping: {} });
    mockFetchProjectFindings.mockResolvedValue([]);
    mockFetchSourceFileContent.mockResolvedValue({
      path: "src/main.c",
      content: "int main() {\n  return 0;\n}\n",
      language: "C",
      size: 27,
    });
    mockUseBuildTargets.mockReturnValue({
      targets: [],
      loading: false,
      discovering: false,
      load: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      discover: vi.fn(),
    });
    mockUseUploadProgress.mockReturnValue({
      phase: "idle",
      message: "",
      fileCount: null,
      error: null,
      connectionState: "disconnected",
      isActive: false,
      setUploading: vi.fn(),
      startTracking: vi.fn(),
      reset: vi.fn(),
    });
  });

  it("renders the empty upload state when no files are available", async () => {
    renderPage();

    await waitFor(() => expect(mockFetchSourceFilesWithComposition).toHaveBeenCalledWith("p-1"));
    expect(await screen.findByText("아직 업로드된 소스코드가 없습니다")).toBeInTheDocument();
    expect(screen.getByText(/소스코드 아카이브/)).toBeInTheDocument();
  });

  it("shows file previews and finding navigation for populated projects", async () => {
    mockFetchSourceFilesWithComposition.mockResolvedValue({
      success: true,
      data: [
        { relativePath: "src/main.c", size: 120, language: "C" },
        { relativePath: "README.md", size: 40, language: "Markdown" },
      ],
      targetMapping: {
        "src/main.c": { targetId: "target-1", targetName: "Firmware" },
      },
    });
    mockFetchProjectFindings.mockResolvedValue([
      {
        id: "finding-1",
        severity: "high",
        title: "Unsafe copy",
        location: "src/main.c:2",
      },
    ]);

    renderPage();

    await waitFor(() => expect(mockFetchProjectFindings).toHaveBeenCalledWith("p-1"));
    expect(await screen.findByRole("heading", { name: "Files" })).toBeInTheDocument();
    expect(screen.getByText(/2개 파일/)).toBeInTheDocument();
    expect(screen.getByText("README.md")).toBeInTheDocument();
    expect(screen.getByText("Firmware")).toBeInTheDocument();

    fireEvent.click(screen.getAllByText("main.c")[0]);

    await waitFor(() => expect(mockFetchSourceFileContent).toHaveBeenCalledWith("p-1", "src/main.c"));
    expect(await screen.findByText("Unsafe copy")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Unsafe copy"));
    expect(mockNavigate).toHaveBeenCalledWith("/projects/p-1/static-analysis?finding=finding-1");
  });
});
