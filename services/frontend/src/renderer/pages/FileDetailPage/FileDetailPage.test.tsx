import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { FileDetailPage } from "./FileDetailPage";

const mockNavigate = vi.fn();
const mockFetchProjectFiles = vi.fn();
const mockFetchProjectOverview = vi.fn();
const mockFetchFileContent = vi.fn();
const mockFetchSourceFileContent = vi.fn();
const mockToast = { error: vi.fn(), warning: vi.fn(), success: vi.fn() };

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("../../api/client", () => ({
  fetchProjectFiles: (...args: unknown[]) => mockFetchProjectFiles(...args),
  fetchProjectOverview: (...args: unknown[]) => mockFetchProjectOverview(...args),
  fetchFileContent: (...args: unknown[]) => mockFetchFileContent(...args),
  fetchSourceFileContent: (...args: unknown[]) => mockFetchSourceFileContent(...args),
  fetchSourceFiles: vi.fn(),
  logError: vi.fn(),
}));
vi.mock("../../contexts/ToastContext", () => ({ useToast: () => mockToast }));
vi.mock("../../components/static/VulnerabilityDetailView", () => ({ VulnerabilityDetailView: () => <div>vuln-detail-view</div> }));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/projects/p-1/files/f-1?line=2"]}>
      <Routes>
        <Route path="/projects/:projectId/files/:fileId" element={<FileDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("FileDetailPage", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    vi.clearAllMocks();
    mockFetchProjectFiles.mockResolvedValue([{ id: "f-1", name: "main.c", path: "src/main.c", size: 128, language: "c" }]);
    mockFetchProjectOverview.mockResolvedValue({
      recentAnalyses: [{
        id: "run-1",
        module: "static_analysis",
        createdAt: "2026-04-10T01:00:00Z",
        summary: { total: 1, critical: 1, high: 0, medium: 0, low: 0 },
        vulnerabilities: [{ id: "v-1", severity: "critical", title: "Buffer overflow", location: "src/main.c:2", source: "rule" }],
      }],
    });
    mockFetchFileContent.mockResolvedValue({ content: "line1\nline2\n" });
    mockFetchSourceFileContent.mockResolvedValue(null);
  });

  it("renders file metadata and vulnerability list", async () => {
    renderPage();

    expect(await screen.findByText("main.c")).toBeInTheDocument();
    expect(screen.getAllByText(/취약점 1건/).length).toBeGreaterThan(0);
    expect(screen.getByText("Buffer overflow")).toBeInTheDocument();
    expect(screen.getByText("관련 분석 이력 (1)")).toBeInTheDocument();
  });

  it("opens vulnerability detail when a vulnerability is selected", async () => {
    renderPage();

    fireEvent.click(await screen.findByText("Buffer overflow"));
    expect(await screen.findByText("vuln-detail-view")).toBeInTheDocument();
  });
});
