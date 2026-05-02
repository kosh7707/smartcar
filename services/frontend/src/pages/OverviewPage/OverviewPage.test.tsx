import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { OverviewPage } from "./OverviewPage";

const mockNavigate = vi.fn();
const mockFetchProjectOverview = vi.fn();
const mockFetchProjectFiles = vi.fn();
const mockFetchProjectActivity = vi.fn();
const mockFetchProjectSdks = vi.fn();
const mockFetchProjectGates = vi.fn();
const mockFetchApprovalCount = vi.fn();
const mockUseBuildTargets = vi.fn();
const mockToast = { error: vi.fn(), success: vi.fn(), info: vi.fn() };

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/common/api/client", () => ({
  fetchProjectOverview: (...args: unknown[]) => mockFetchProjectOverview(...args),
  fetchProjectFiles: (...args: unknown[]) => mockFetchProjectFiles(...args),
  logError: vi.fn(),
}));

vi.mock("@/common/api/projects", () => ({
  fetchProjectActivity: (...args: unknown[]) => mockFetchProjectActivity(...args),
}));

vi.mock("@/common/api/sdk", () => ({
  fetchProjectSdks: (...args: unknown[]) => mockFetchProjectSdks(...args),
}));

vi.mock("@/common/api/gate", () => ({
  fetchProjectGates: (...args: unknown[]) => mockFetchProjectGates(...args),
}));

vi.mock("@/common/api/approval", () => ({
  fetchApprovalCount: (...args: unknown[]) => mockFetchApprovalCount(...args),
}));

vi.mock("@/common/hooks/useBuildTargets", () => ({
  useBuildTargets: (...args: unknown[]) => mockUseBuildTargets(...args),
}));

vi.mock("@/common/contexts/ToastContext", () => ({
  useToast: () => mockToast,
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/projects/p-1/overview"]}>
      <Routes>
        <Route path="/projects/:projectId/overview" element={<OverviewPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function makeOverview(overrides: Record<string, unknown> = {}) {
  return {
    project: {
      id: "p-1",
      name: "Payments Platform",
      description: "Secure build and scan surface",
    },
    summary: {
      bySeverity: { critical: 1, high: 2, medium: 3, low: 0, info: 0 },
      totalVulnerabilities: 6,
    },
    recentAnalyses: [
      {
        id: "analysis-1",
        module: "static-analysis",
        status: "completed",
        vulnerabilities: [
          { id: "v-1", severity: "critical", title: "Critical auth bypass", location: "src/auth.ts:12" },
          { id: "v-2", severity: "high", title: "Weak crypto", location: "src/crypto.ts:22" },
        ],
      },
    ],
    trend: {
      newFindings: 2,
      resolvedFindings: 1,
      unresolvedTotal: 6,
    },
    targetSummary: {
      ready: 1,
      running: 0,
      failed: 0,
      discovered: 0,
    },
    fileCount: 2,
    ...overrides,
  } as any;
}

describe("OverviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchProjectOverview.mockResolvedValue(makeOverview({
      recentAnalyses: [],
      summary: { bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 }, totalVulnerabilities: 0 },
      trend: { newFindings: 0, resolvedFindings: 0, unresolvedTotal: 0 },
      targetSummary: undefined,
    }));
    mockFetchProjectFiles.mockResolvedValue([]);
    mockFetchProjectActivity.mockResolvedValue([]);
    mockFetchProjectSdks.mockResolvedValue({ builtIn: [], registered: [] });
    mockFetchProjectGates.mockResolvedValue([]);
    mockFetchApprovalCount.mockResolvedValue({ pending: 0, total: 0 });
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
  });

  it("shows loading feedback while overview data is resolving", () => {
    mockFetchProjectOverview.mockImplementation(() => new Promise(() => {}));
    mockFetchProjectFiles.mockImplementation(() => new Promise(() => {}));

    renderPage();

    expect(screen.getByText("데이터 로딩 중...")).toBeInTheDocument();
    expect(document.title).toBe("AEGIS — Overview");
  });

  it("renders the empty state and routes users to files/settings actions", async () => {
    renderPage();

    await waitFor(() => expect(mockFetchProjectOverview).toHaveBeenCalledWith("p-1"));
    expect(await screen.findByRole("heading", { name: "분석 준비 완료" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /파일 업로드/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/projects/p-1/files");

    fireEvent.click(screen.getByRole("button", { name: /프로젝트 설정/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/projects/p-1/settings");
  });

  it("renders populated overview sections and keeps navigation affordances working", async () => {
    mockFetchProjectOverview.mockResolvedValue(makeOverview());
    mockFetchProjectFiles.mockResolvedValue([
      { id: "file-1", name: "main.c", path: "src/main.c", size: 256, language: "C" },
      { id: "file-2", name: "auth.c", path: "src/auth.c", size: 128, language: "C" },
    ]);
    mockFetchProjectActivity.mockResolvedValue([
      { type: "run_completed", timestamp: "2026-04-10T01:00:00Z", summary: "정적 분석이 완료되었습니다", metadata: {} },
    ]);
    mockFetchProjectSdks.mockResolvedValue({
      builtIn: [],
      registered: [{ id: "sdk-1", name: "ARM SDK", status: "ready" }],
    });
    mockFetchProjectGates.mockResolvedValue([
      { id: "gate-1", projectId: "p-1", runId: "run-1", status: "pass", rules: [], evaluatedAt: "2026-04-10T01:00:00Z", createdAt: "2026-04-10T01:00:00Z" },
    ]);
    mockFetchApprovalCount.mockResolvedValue({ pending: 2, total: 3 });
    mockUseBuildTargets.mockReturnValue({
      targets: [{ id: "target-1", name: "Firmware", status: "ready" }],
      loading: false,
      discovering: false,
      load: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      discover: vi.fn(),
    });

    renderPage();

    expect(await screen.findByRole("heading", { name: "Payments Platform" })).toBeInTheDocument();
    expect(screen.getByText("보안 현황")).toBeInTheDocument();
    expect(screen.getByText("최근 활동")).toBeInTheDocument();
    expect(screen.getByText("프로젝트 메타데이터")).toBeInTheDocument();
    expect(screen.getByText("Quality Gate")).toBeInTheDocument();
    expect(screen.getByText("승인 요청")).toBeInTheDocument();
    expect(screen.getByText("ARM SDK")).toBeInTheDocument();
    expect(screen.getByText("main.c")).toBeInTheDocument();
    expect(screen.getByText("Critical auth bypass")).toBeInTheDocument();
    expect(screen.getByText("정적 분석이 완료되었습니다")).toBeInTheDocument();
    expect(screen.getByText("건 대기 중")).toBeInTheDocument();

    fireEvent.click(screen.getByText("총 Finding").closest("div") as HTMLElement);
    expect(mockNavigate).toHaveBeenCalledWith("/projects/p-1/vulnerabilities");

    fireEvent.click(screen.getByText("main.c"));
    expect(mockNavigate).toHaveBeenCalledWith("/projects/p-1/files/file-1");
  });

  it("uses the shared plain project-page header on overview load failure", async () => {
    mockFetchProjectOverview.mockRejectedValue(new Error("boom"));

    const { container } = renderPage();

    expect(await screen.findByRole("heading", { name: "데이터를 불러올 수 없습니다" })).toBeInTheDocument();
    expect(screen.getByText("프로젝트 상태와 최근 흐름을 불러오는 중 문제가 발생했습니다.")).toBeInTheDocument();
    expect(container.querySelector(".page-header--plain")).not.toBeNull();
  });

  it("stops loading and shows the failure state when no project id is present", async () => {
    render(
      <MemoryRouter initialEntries={["/overview"]}>
        <Routes>
          <Route path="/overview" element={<OverviewPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "데이터를 불러올 수 없습니다" })).toBeInTheDocument();
    expect(mockFetchProjectOverview).not.toHaveBeenCalled();
    expect(mockToast.error).not.toHaveBeenCalled();
  });
});
