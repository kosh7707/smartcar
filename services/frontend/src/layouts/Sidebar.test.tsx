import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "./Sidebar";

const mockGetProject = vi.fn();
const mockFetchApprovalCount = vi.fn();

vi.mock("../contexts/ProjectContext", () => ({
  useProjects: () => ({ getProject: mockGetProject }),
}));

vi.mock("../contexts/AnalysisGuardContext", () => ({
  useAnalysisGuard: () => ({ isBlocking: false }),
}));

vi.mock("../api/approval", () => ({
  fetchApprovalCount: (...args: unknown[]) => mockFetchApprovalCount(...args),
}));

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    mockGetProject.mockReturnValue({ id: "p-1", name: "Payments Platform" });
    mockFetchApprovalCount.mockResolvedValue({ pending: 2, total: 2 });
  });

  it("renders the project shell subtitle and keeps settings in the main nav list", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/projects/p-1/overview"]}>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByText("Payments Platform")).toBeInTheDocument();
    expect(screen.getByText("프로젝트 작업 공간")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /개요/i })).toHaveAttribute("href", "/projects/p-1/overview");
    expect(screen.getByRole("link", { name: "설정" })).toHaveAttribute("href", "/projects/p-1/settings");
    await waitFor(() => expect(mockFetchApprovalCount).toHaveBeenCalledWith("p-1"));
    expect(await screen.findByText("2")).toBeInTheDocument();
    expect(container.querySelector(".sidebar-divider")).toBeNull();
    expect(container.querySelector(".sidebar-nav-bottom")).toBeNull();
  });

  it("renders the global shell subtitle outside project routes", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByText("AEGIS")).toBeInTheDocument();
    expect(screen.getByText("보안 분석 워크스페이스")).toBeInTheDocument();
  });
});
