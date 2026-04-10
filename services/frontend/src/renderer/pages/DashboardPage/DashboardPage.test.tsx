import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ProjectListItem } from "@aegis/shared";
import { DashboardPage } from "./DashboardPage";

const mockNavigate = vi.fn();
const mockCreateProject = vi.fn();
const mockUseProjects = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../contexts/ProjectContext", () => ({
  useProjects: () => mockUseProjects(),
}));

function makeProject(index: number, overrides: Partial<ProjectListItem> = {}): ProjectListItem {
  return {
    id: `p-${index}`,
    name: `Project ${index}`,
    description: `Description ${index}`,
    createdAt: `2026-04-${String(index).padStart(2, "0")}T00:00:00Z`,
    updatedAt: `2026-04-${String(index).padStart(2, "0")}T01:00:00Z`,
    lastAnalysisAt: `2026-04-${String(index).padStart(2, "0")}T02:00:00Z`,
    gateStatus: index % 2 === 0 ? "fail" : "pass",
    unresolvedDelta: index,
    severitySummary: {
      critical: index === 1 ? 1 : 0,
      high: index,
      medium: index + 1,
      low: index + 2,
    },
    ...overrides,
  };
}

const projects = Array.from({ length: 5 }, (_, i) => makeProject(i + 1));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateProject.mockResolvedValue({ id: "p-created" });
    mockUseProjects.mockReturnValue({
      projects,
      loading: false,
      createProject: mockCreateProject,
    });
  });

  it("renders dashboard sections and uses whole activity cards as links", async () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Project explorer" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Needs attention" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recent activity" })).toBeInTheDocument();
    expect(screen.queryByText("Open")).not.toBeInTheDocument();

    const attentionSection = screen.getByRole("heading", { name: "Needs attention" }).closest("section");
    const activitySection = screen.getByRole("heading", { name: "Recent activity" }).closest("section");

    expect(attentionSection).not.toBeNull();
    expect(activitySection).not.toBeNull();

    expect(within(attentionSection as HTMLElement).getAllByRole("link")).toHaveLength(4);
    expect(within(activitySection as HTMLElement).getAllByRole("link")).toHaveLength(10);

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(within(activitySection as HTMLElement).getAllByRole("link")).toHaveLength(15);
  });

  it("filters project explorer by search query", async () => {
    renderPage();

    const explorer = screen.getByLabelText("Project explorer");
    fireEvent.change(screen.getByPlaceholderText("Search projects"), { target: { value: "Project 3" } });

    expect(within(explorer).getByRole("link", { name: /Project 3/i })).toBeInTheDocument();
    expect(within(explorer).queryByRole("link", { name: /Project 1/i })).not.toBeInTheDocument();
  });

  it("creates a project from the inline create form", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "New" }));
    fireEvent.change(screen.getByPlaceholderText("Project name"), { target: { value: "  New Dashboard Project  " } });
    fireEvent.change(screen.getByPlaceholderText("Description (optional)"), { target: { value: "  My desc  " } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(mockCreateProject).toHaveBeenCalledWith("New Dashboard Project", "My desc"));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/projects/p-created/overview"));
  });
});
